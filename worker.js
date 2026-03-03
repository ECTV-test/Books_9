/**
 * Cloudflare Worker v2.1
 * Исправления vs v2:
 *  - убран дублирующий параметр format (OpenAI принимает только response_format)
 *  - добавлена поддержка поля instructions для TTS
 *  - CORS ограничен конкретными доменами (настрой под себя)
 *
 * Endpoints:
 *  POST /translate  { text, sourceLang, targetLang, provider?, noCache? }
 *  POST /tts        { text, voice?, format?, speed?, instructions?, noCache? }
 *
 * Secrets: OPENAI_API_KEY, LIBRETRANSLATE_API_KEY, CLIENT_KEY
 * Vars:    LIBRETRANSLATE_URL, OPENAI_MODEL, OPENAI_TTS_MODEL,
 *          CACHE_VER, ALLOWED_ORIGIN
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") return corsPreflight(request, env);

      // CORS проверка origin
      const originErr = checkOrigin(request, env);
      if (originErr) return originErr;

      // Опциональная авторизация по CLIENT_KEY
      if (env.CLIENT_KEY) {
        const ck = request.headers.get("x-client-key") || "";
        if (ck !== env.CLIENT_KEY) return corsJson({ error: "Unauthorized" }, 401, request, env);
      }

      if (url.pathname === "/translate" && request.method === "POST") {
        return await handleTranslate(request, env, ctx);
      }
      if (url.pathname === "/tts" && request.method === "POST") {
        return await handleTts(request, env, ctx);
      }

      return corsJson({ error: "Not found" }, 404, request, env);
    } catch (e) {
      return corsJson({ error: "Worker error", details: String(e?.message || e) }, 500, request, env);
    }
  },
};

// ── /translate ────────────────────────────────────────────────────
async function handleTranslate(request, env, ctx) {
  const body = await safeJson(request);

  const textRaw    = (body?.text ?? body?.q ?? "").toString();
  const sourceLang = (body?.sourceLang ?? body?.source ?? "auto").toString().trim();
  const targetLang = (body?.targetLang ?? body?.target ?? body?.to ?? "").toString().trim();
  const provider   = (body?.provider ?? "openai").toString().toLowerCase();
  const noCache    = !!body?.noCache;
  const action     = (body?.action ?? "").toString().toLowerCase();

  if (action === "clear") {
    return corsJson({ ok: true, note: "Bump CACHE_VER to hard-reset cache." }, 200, request, env);
  }

  const text = normalizeText(textRaw);
  if (!text)                       return corsJson({ error: "Empty text" }, 400, request, env);
  if (!sourceLang || !targetLang)  return corsJson({ error: "Missing sourceLang/targetLang" }, 400, request, env);
  if (text.length > 800)           return corsJson({ error: "Text too long (max 800 chars)" }, 400, request, env);

  const cache    = caches.default;
  const cacheKey = await buildCacheKey(env, "translate", { provider, sl: sourceLang, tl: targetLang, text });

  if (!noCache) {
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached, request, env);
  }

  let translation = "";
  if (provider === "libre") {
    translation = await translateWithLibre(env, text, sourceLang, targetLang);
  } else if (provider === "openai") {
    translation = await translateWithOpenAI(env, text, sourceLang, targetLang);
  } else {
    return corsJson({ error: `Unknown provider: ${provider}` }, 400, request, env);
  }

  const resp = corsJson({ translation }, 200, request, env);
  if (!noCache) ctx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

// ── /tts ──────────────────────────────────────────────────────────
async function handleTts(request, env, ctx) {
  const body   = await safeJson(request);
  const action = (body?.action ?? "").toString().toLowerCase();

  if (action === "clear") {
    return corsJson({ ok: true, note: "Bump CACHE_VER to hard-reset cache." }, 200, request, env);
  }

  const noCache = !!body?.noCache;
  const text    = normalizeText((body?.text ?? body?.q ?? "").toString());

  if (!text)              return corsJson({ error: "Empty text" }, 400, request, env);
  if (text.length > 1500) return corsJson({ error: "Text too long (max 1500 chars)" }, 400, request, env);

  const voice        = (body?.voice ?? "alloy").toString();
  const format       = (body?.format ?? "mp3").toString().toLowerCase();
  const speed        = typeof body?.speed === "number" ? body.speed : 1.0;
  const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";

  const cache    = caches.default;
  const cacheKey = await buildCacheKey(env, "tts", { voice, format, speed: String(speed), instructions, text });

  if (!noCache) {
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached, request, env);
  }

  // FIX: передаём instructions, убран дублирующий параметр format
  const audioResp = await openAiTts(env, { text, voice, format, speed, instructions });

  if (!noCache) ctx.waitUntil(cache.put(cacheKey, audioResp.clone()));
  return withCors(audioResp, request, env);
}

// ── Провайдеры ────────────────────────────────────────────────────
async function translateWithLibre(env, text, sourceLang, targetLang) {
  const base   = (env.LIBRETRANSLATE_URL || "https://libretranslate.com").replace(/\/$/, "");
  const apiKey = env.LIBRETRANSLATE_API_KEY || "";
  const payload = { q: text, source: sourceLang, target: targetLang, format: "text" };
  if (apiKey) payload.api_key = apiKey;

  const r = await fetch(`${base}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`LibreTranslate error ${r.status}: ${await safeText(r)}`);

  const data = await r.json().catch(() => ({}));
  const tr   = (data?.translatedText ?? "").toString();
  if (!tr) throw new Error("LibreTranslate: empty translatedText");
  return tr;
}

async function translateWithOpenAI(env, text, sourceLang, targetLang) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a professional translator. Return ONLY the translation, no quotes, no explanations." },
        { role: "user",   content: `Translate from ${sourceLang} to ${targetLang}:\n\n${text}` },
      ],
      temperature: 0.1,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI translate error ${r.status}: ${await safeText(r)}`);

  const data = await r.json().catch(() => ({}));
  const out  = (data?.choices?.[0]?.message?.content ?? "").toString().trim();
  if (!out) throw new Error("OpenAI: empty translation");
  return out;
}

async function openAiTts(env, { text, voice, format, speed, instructions }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const model = env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

  // Собираем тело запроса
  const body = { model, voice, input: text, response_format: format, speed };
  // FIX: добавляем instructions только если они есть (OpenAI игнорирует пустую строку, но чище так)
  if (instructions) body.instructions = instructions;

  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI TTS error ${r.status}: ${await safeText(r)}`);

  const headers = new Headers(r.headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (!headers.get("Content-Type")) {
    const ct = format === "wav" ? "audio/wav" : format === "aac" ? "audio/aac" : "audio/mpeg";
    headers.set("Content-Type", ct);
  }
  return new Response(r.body, { status: 200, headers });
}

// ── CORS ──────────────────────────────────────────────────────────
function getAllowedOrigins(env) {
  // Настрой ALLOWED_ORIGIN в vars Cloudflare Worker,
  // например: "https://ectv-test.github.io,http://localhost:8080"
  const raw = env.ALLOWED_ORIGIN || "*";
  if (raw === "*") return null; // null = разрешить всем
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function checkOrigin(request, env) {
  const allowed = getAllowedOrigins(env);
  if (!allowed) return null; // разрешить всем
  const origin = request.headers.get("Origin") || "";
  if (!allowed.includes(origin)) {
    return new Response(JSON.stringify({ error: "Forbidden origin" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

function corsHeaders(request, env) {
  const allowed  = getAllowedOrigins(env);
  const origin   = request ? (request.headers.get("Origin") || "*") : "*";
  const allowOrigin = (!allowed || allowed.includes(origin)) ? origin : "null";
  return {
    "Access-Control-Allow-Origin":  allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-client-key",
    "Access-Control-Max-Age":       "86400",
  };
}

function corsPreflight(request, env) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function corsJson(obj, status, request, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders(request, env),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function withCors(resp, request, env) {
  const h  = new Headers(resp.headers);
  const ch = corsHeaders(request, env);
  for (const [k, v] of Object.entries(ch)) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}

// ── Хелперы ───────────────────────────────────────────────────────
function normalizeText(s) {
  return (s || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}
async function safeJson(request) {
  try { return await request.json(); } catch { return {}; }
}
async function safeText(resp) {
  try { return await resp.text(); } catch { return ""; }
}
async function buildCacheKey(env, kind, params) {
  const ver      = env.CACHE_VER || "v2";
  const textHash = params.text ? await sha256(params.text) : "";
  const keyObj   = { ver, kind, ...params, textHash };
  delete keyObj.text;
  return new Request(`https://cache.local/${kind}?k=${encodeURIComponent(JSON.stringify(keyObj))}`, { method: "GET" });
}
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}