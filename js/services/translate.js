/**
 * translate.js — сервис перевода.
 * Провайдеры: OpenAI (через Worker) | LibreTranslate (прямо или через Worker)
 * Использование: TranslateService.translate(text, src, trg, opts)
 *                TranslateService.translateWord(word, src, trg)
 *                TranslateService.translateLine(text, src, trg)
 * Подключать после config.js
 */
(function(global){

// ── Кэш переводов (in-memory, живёт пока открыта вкладка) ─────────
const _cache = new Map();

function _cacheKey(text, src, trg, provider){
  return `${provider}::${src}::${trg}::${text}`;
}

// ── Rate limit защита ─────────────────────────────────────────────
let _cooldownUntil = 0;

function _isCoolingDown(){
  return Date.now() < _cooldownUntil;
}

function getCooldownSeconds(){
  const left = _cooldownUntil - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

function _setCooldown(ms){
  _cooldownUntil = Date.now() + ms;
}

// ── Утилиты ───────────────────────────────────────────────────────
function _getProvider(){
  try{
    return (window.DevState && window.DevState.translationProvider) || "openai";
  }catch(e){ return "openai"; }
}

function _getNoCache(){
  try{ return !!(window.DevState && window.DevState.noCache); }catch(e){ return false; }
}

function _getSourceLang(){
  try{ return (window.DevState && window.DevState.sourceLang) || "auto"; }catch(e){ return "auto"; }
}

function _normalizeWord(w){
  return String(w||"").toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "").trim();
}

// ── Основной метод перевода ───────────────────────────────────────
/**
 * @param {string} text
 * @param {string} src        — язык источника
 * @param {string} trg        — язык перевода
 * @param {object} [opts]
 * @param {string}  opts.provider  — "openai" | "libre"
 * @param {boolean} opts.noCache   — игнорировать Worker кэш
 * @returns {Promise<string>}
 */
async function translate(text, src, trg, opts){
  opts = opts || {};
  text = String(text||"").trim();
  if(!text) return "—";
  if(src && trg && src === trg) return text;

  const provider = opts.provider || _getProvider();
  const noCache  = opts.noCache !== undefined ? !!opts.noCache : _getNoCache();
  const key = _cacheKey(text, src, trg, provider);

  // 1. In-memory кэш
  if(!noCache && _cache.has(key)) return _cache.get(key);

  // 2. Rate limit
  if(_isCoolingDown()){
    const wait = getCooldownSeconds();
    return `⏳ Ліміт. Зачекай ${wait} с.`;
  }

  // 3. Запрос
  let result = "";
  try{
    result = await _translateWorker(text, src, trg, { noCache, provider });
  }catch(e){
    // Fallback: прямой LibreTranslate если есть ключ
    if(provider === "libre"){
      try{
        result = await _translateLibre(text, src, trg);
      }catch(e2){
        const msg = String(e2.message||"");
        if(msg.includes("429")){
          _setCooldown(60_000);
          return "⏳ Ліміт. Зачекай 60 с.";
        }
        return "— (помилка перекладу)";
      }
    } else {
      const msg = String(e.message||"");
      if(msg.includes("429")){
        _setCooldown(20_000);
        return "⏳ Ліміт. Зачекай 20 с.";
      }
      return "— (не вдалося підключитися до воркера)";
    }
  }

  if(result) _cache.set(key, result);
  return result || "—";
}

// ── Перевод слова (с нормализацией) ──────────────────────────────
/**
 * Переводит одно слово. Нормализует перед кэшированием.
 */
async function translateWord(word, src, trg){
  const w = _normalizeWord(word);
  if(!w) return "—";
  src = src || _getSourceLang() || "auto";
  trg = trg || "uk";
  return await translate(w, src, trg);
}

// ── Перевод строки ────────────────────────────────────────────────
async function translateLine(text, src, trg){
  const s = String(text||"").trim();
  if(!s) return "—";
  src = src || _getSourceLang() || "auto";
  trg = trg || "uk";
  return await translate(s, src, trg);
}

// ── Через Cloudflare Worker ───────────────────────────────────────
async function _translateWorker(text, src, trg, opts){
  opts = opts || {};
  const url = Config.WORKER_TRANSLATE_URL;
  const provider = opts.provider || _getProvider();

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text, sourceLang: src, targetLang: trg,
      provider, noCache: !!opts.noCache
    }),
  });

  if(resp.status === 429){
    _setCooldown(20_000);
    throw new Error("429");
  }
  if(!resp.ok){
    const body = await resp.text().catch(()=>"");
    throw new Error(`Worker error ${resp.status}: ${body}`);
  }

  const data = await resp.json().catch(()=>({}));
  const out = String(data.translatedText || data.translation || "").trim();
  if(!out) throw new Error("Worker: empty response");
  return out;
}

// ── Напрямую через LibreTranslate ─────────────────────────────────
async function _translateLibre(text, src, trg){
  const url    = Config.LIBRETRANSLATE_URL;
  const apiKey = Config.LIBRETRANSLATE_API_KEY;

  const payload = { q: text, source: src, target: trg, format: "text", alternatives: 3 };
  if(apiKey) payload.api_key = apiKey;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if(!resp.ok){
    const body = await resp.text().catch(()=>"");
    throw new Error(`LibreTranslate error ${resp.status}: ${body}`);
  }

  const data = await resp.json().catch(()=>({}));
  const out = String(data.translatedText || "").trim();
  if(!out) throw new Error("LibreTranslate: empty response");
  return out;
}

// ── Управление кэшем ──────────────────────────────────────────────
function clearCache(){
  _cache.clear();
}

function getCacheSize(){
  return _cache.size;
}

// ── Экспорт ───────────────────────────────────────────────────────
global.TranslateService = {
  translate,
  translateWord,
  translateLine,
  clearCache,
  getCacheSize,
  getCooldownSeconds,
};

})(window);
