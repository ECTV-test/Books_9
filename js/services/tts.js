/**
 * tts.js — сервис озвучивания текста (TTS).
 * Основной: OpenAI через Cloudflare Worker.
 * Fallback: браузерный SpeechSynthesis.
 * Использование: TtsService.speak(text, opts)
 *                TtsService.stop()
 * Подключать после config.js
 */
(function(global){

// ── Кэш аудио (in-memory, blob URL) ──────────────────────────────
const _audioCache = new Map();

// ── Текущее воспроизведение ───────────────────────────────────────
let _currentAudio = null;    // HTMLAudioElement
let _currentUtter = null;    // SpeechSynthesisUtterance (fallback)
let _isPlaying    = false;

// ── Основной метод ────────────────────────────────────────────────
/**
 * @param {string} text
 * @param {object} opts
 * @param {string}   opts.voice        — OpenAI voice id (onyx, nova, ...)
 * @param {string}   opts.gender       — "male" | "female" (если voice не задан)
 * @param {number}   opts.speed        — 0.3 – 2.0 (default 1.0)
 * @param {string}   opts.format       — "mp3" | "wav" | "aac" (default mp3)
 * @param {string}   opts.instructions — voice prompt для OpenAI TTS
 * @param {string}   opts.lang         — язык для fallback (en, uk, ...)
 * @param {boolean}  opts.noCache      — не использовать кэш Worker
 * @param {Function} opts.onStart      — callback когда началось воспроизведение
 * @param {Function} opts.onEnd        — callback когда закончилось
 * @param {Function} opts.onError      — callback при ошибке
 * @returns {Promise<void>}
 */
async function speak(text, opts){
  opts = opts || {};
  text = String(text||"").trim();
  if(!text) return;

  // Останавливаем предыдущее
  stop();

  const voice        = opts.voice        || _resolveVoice(opts.gender);
  const speed        = typeof opts.speed === "number" ? opts.speed : _getSpeed();
  const format       = opts.format       || Config.TTS_DEFAULTS.format;
  const instructions = opts.instructions || _getInstructions();
  const noCache      = !!opts.noCache    || _getNoCache();
  const onStart      = typeof opts.onStart === "function" ? opts.onStart : null;
  const onEnd        = typeof opts.onEnd   === "function" ? opts.onEnd   : null;
  const onError      = typeof opts.onError === "function" ? opts.onError : null;

  // ── Пробуем Worker (OpenAI) ──────────────────────────────────
  try {
    const blobUrl = await _fetchTts({ text, voice, speed, format, instructions, noCache });
    await _playAudio(blobUrl, { onStart, onEnd, onError });
    return;
  } catch(e) {
    console.warn("[TTS] Worker failed, falling back to browser TTS:", e.message);
  }

  // ── Fallback: браузерный SpeechSynthesis ──────────────────────
  try {
    await _browserSpeak(text, {
      lang: opts.lang || _resolveLang(),
      speed,
      onStart, onEnd, onError
    });
  } catch(e) {
    if(onError) onError(e);
    else console.error("[TTS] Browser fallback also failed:", e);
  }
}

// ── Запрос к Worker ───────────────────────────────────────────────
async function _fetchTts({ text, voice, speed, format, instructions, noCache }){
  const cacheKey = `${voice}::${speed}::${format}::${text}`;

  // In-memory кэш (blob URL)
  if(!noCache && _audioCache.has(cacheKey)){
    return _audioCache.get(cacheKey);
  }

  const resp = await fetch(Config.WORKER_TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice,
      format,
      speed,
      instructions,   // поле instructions — Worker передаёт в OpenAI
      noCache,
      response_format: format,  // только этот ключ нужен OpenAI
    }),
  });

  if(!resp.ok){
    const body = await resp.text().catch(()=>"");
    throw new Error(`TTS Worker error ${resp.status}: ${body}`);
  }

  const blob = await resp.blob();
  if(!blob || blob.size === 0) throw new Error("TTS: empty audio response");

  const blobUrl = URL.createObjectURL(blob);

  // Сохраняем в кэш, но ограничиваем размер (макс 120 записей)
  if(_audioCache.size >= 120){
    const firstKey = _audioCache.keys().next().value;
    const oldUrl = _audioCache.get(firstKey);
    try { URL.revokeObjectURL(oldUrl); } catch(e){}
    _audioCache.delete(firstKey);
  }
  _audioCache.set(cacheKey, blobUrl);

  return blobUrl;
}

// ── Воспроизведение через HTMLAudioElement ────────────────────────
function _playAudio(blobUrl, { onStart, onEnd, onError }){
  return new Promise((resolve, reject) => {
    const audio = new Audio(blobUrl);
    _currentAudio = audio;
    _isPlaying = true;

    audio.onplay  = () => { if(onStart) onStart(); };
    audio.onended = () => {
      _isPlaying = false;
      _currentAudio = null;
      if(onEnd) onEnd();
      resolve();
    };
    audio.onerror = (e) => {
      _isPlaying = false;
      _currentAudio = null;
      const err = new Error("Audio playback error");
      if(onError) onError(err);
      reject(err);
    };

    audio.play().catch(err => {
      _isPlaying = false;
      _currentAudio = null;
      if(onError) onError(err);
      reject(err);
    });
  });
}

// ── Браузерный SpeechSynthesis (fallback) ─────────────────────────
function _browserSpeak(text, { lang, speed, onStart, onEnd, onError }){
  return new Promise((resolve, reject) => {
    if(!window.speechSynthesis){
      const err = new Error("SpeechSynthesis not supported");
      if(onError) onError(err);
      return reject(err);
    }

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = Config.langToLocale(lang || "en");
    utter.rate  = typeof speed === "number" ? speed : 1.0;
    _currentUtter = utter;
    _isPlaying = true;

    utter.onstart = () => { if(onStart) onStart(); };
    utter.onend   = () => {
      _isPlaying = false;
      _currentUtter = null;
      if(onEnd) onEnd();
      resolve();
    };
    utter.onerror = (e) => {
      _isPlaying = false;
      _currentUtter = null;
      const err = new Error("SpeechSynthesis error: " + (e.error || "unknown"));
      if(onError) onError(err);
      reject(err);
    };

    window.speechSynthesis.speak(utter);
  });
}

// ── Остановить воспроизведение ────────────────────────────────────
function stop(){
  try{
    if(_currentAudio){
      _currentAudio.pause();
      _currentAudio.currentTime = 0;
      _currentAudio = null;
    }
  }catch(e){}
  try{
    if(window.speechSynthesis) window.speechSynthesis.cancel();
    _currentUtter = null;
  }catch(e){}
  _isPlaying = false;
}

// ── Очистить кэш ──────────────────────────────────────────────────
function clearCache(){
  _audioCache.forEach(url => { try{ URL.revokeObjectURL(url); }catch(e){} });
  _audioCache.clear();
}

function isPlaying(){ return _isPlaying; }

// ── Хелперы — читают из DevState ─────────────────────────────────
function _resolveVoice(gender){
  try{
    // Если задан конкретный голос в DevState — используем его
    const ds = window.DevState;
    if(ds && ds.ttsVoice) return ds.ttsVoice;
    // Иначе выбираем по полу
    const g = gender || (ds && ds.ttsGender) || Config.TTS_DEFAULTS.gender;
    const voices = Config.OPENAI_TTS_VOICES.filter(v => v.gender === g);
    return voices.length ? voices[0].id : Config.TTS_DEFAULTS.voice;
  }catch(e){
    return Config.TTS_DEFAULTS.voice;
  }
}

function _resolveLang(){
  try{ return (window.DevState && window.DevState.sourceLang) || "en"; }
  catch(e){ return "en"; }
}

function _getSpeed(){
  try{ return (window.DevState && typeof window.DevState.speed==="number") ? window.DevState.speed : Config.TTS_DEFAULTS.speed; }
  catch(e){ return Config.TTS_DEFAULTS.speed; }
}

function _getInstructions(){
  try{ return (window.DevState && window.DevState.ttsInstructions) || Config.TTS_DEFAULTS.instructions; }
  catch(e){ return Config.TTS_DEFAULTS.instructions; }
}

function _getNoCache(){
  try{ return !!(window.DevState && window.DevState.noCache); }
  catch(e){ return false; }
}

// ── Экспорт ───────────────────────────────────────────────────────
global.TtsService = { speak, stop, clearCache, isPlaying };

})(window);