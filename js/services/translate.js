/**
 * translate.js — сервис перевода.
 * Провайдеры: OpenAI (через Worker) | LibreTranslate (прямо или через Worker)
 * Использование: TranslateService.translateWord(text, src, trg)
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
let _inFlight = false;

function _isCoolingDown(){
  return Date.now() < _cooldownUntil;
}

// ── Основной метод перевода ───────────────────────────────────────
/**
 * @param {string} text       — текст для перевода
 * @param {string} src        — язык источника (en, uk, ...)
 * @param {string} trg        — язык перевода
 * @param {object} opts
 * @param {string} opts.provider  — "openai" | "libre" (default: из devState)
 * @param {boolean} opts.noCache  — игнорировать Worker кэш
 * @returns {Promise<string>}
 */
async function translate(text, src, trg, opts){
  opts = opts || {};
  text = String(text||"").trim();
  if(!text) return "";
  if(src === trg) return text;

  const provider = opts.provider || _getProvider();
  const noCache  = !!opts.noCache;
  const key = _cacheKey(text, src, trg, provider);

  // 1. Проверяем in-memory кэш
  if(!noCache && _cache.has(key)) return _cache.get(key);

  // 2. Проверяем rate limit
  if(_isCoolingDown()){
    const wait = Math.ceil((_cooldownUntil - Date.now()) / 1000);
    throw new RateLimitError(`Rate limit active. Wait ${wait}s.`, wait);
  }

  // 3. Делаем запрос
  let result = "";
  try {
    if(provider === "libre"){
      result = await _translateLibre(text, src, trg);
    } else {
      result = await _translateWorker(text, src, trg, { noCache });
    }
  } catch(e) {
    // Если 429 от LibreTranslate — ставим cooldown
    if(e && String(e.message||"").includes("429")){
      _cooldownUntil = Date.now() + 60_000; // 60 секунд пауза
      throw new RateLimitError("LibreTranslate rate limit (429). Wait 60s.", 60);
    }
    throw e;
  }

  // 4. Сохраняем в in-memory кэш
  if(result) _cache.set(key, result);
  return result;
}

// ── Через Cloudflare Worker (OpenAI или Libre) ────────────────────
async function _translateWorker(text, src, trg, opts){
  opts = opts || {};
  const url = Config.WORKER_TRANSLATE_URL;
  const provider = _getProvider();

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text, sourceLang: src, targetLang: trg,
      provider, noCache: !!opts.noCache
    }),
  });

  if(!resp.ok){
    const body = await resp.text().catch(()=>"");
    throw new Error(`Worker translate error ${resp.status}: ${body}`);
  }

  const data = await resp.json().catch(()=>({}));
  const out = String(data.translation || "").trim();
  if(!out) throw new Error("Worker: empty translation response");
  return out;
}

// ── Напрямую через LibreTranslate (публичный) ────────────────────
async function _translateLibre(text, src, trg){
  const url    = Config.LIBRETRANSLATE_URL;
  const apiKey = Config.LIBRETRANSLATE_API_KEY;

  const payload = { q: text, source: src, target: trg, format: "text" };
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
  if(!out) throw new Error("LibreTranslate: empty translatedText");
  return out;
}

// ── Утилиты ───────────────────────────────────────────────────────
function _getProvider(){
  // Читаем из глобального DevState если есть, иначе openai
  try{
    return (window.DevState && window.DevState.translationProvider) || "openai";
  }catch(e){ return "openai"; }
}

/** Очистить in-memory кэш переводов */
function clearCache(){
  _cache.clear();
}

/** Сколько секунд осталось cooldown (0 если нет) */
function getCooldownSeconds(){
  const left = _cooldownUntil - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

// ── Специальный класс ошибки для rate limit ───────────────────────
class RateLimitError extends Error {
  constructor(message, seconds){
    super(message);
    this.name = "RateLimitError";
    this.seconds = seconds || 60;
  }
}

// ── Экспорт ───────────────────────────────────────────────────────
global.TranslateService = {
  translate,
  clearCache,
  getCooldownSeconds,
  RateLimitError,
};

})(window);