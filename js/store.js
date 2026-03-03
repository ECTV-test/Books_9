/**
 * store.js — единый глобальный state приложения.
 * Заменяет разрозненный state из app.js.
 * Использование: Store.get()
 *                Store.set({ reading: { night: true } })
 *                Store.onChange(fn)
 * Подключать после config.js
 */
(function(global){

// ── Начальный state ───────────────────────────────────────────────
function _buildInitial(){
  return {
    // Роутинг
    route: { name:"catalog", bookId:null },
    navStack: [],

    // Каталог
    catalog: [],

    // Текущая открытая книга
    book: null,

    // UI язык
    ui: {
      lang: I18n.getUiLang(),
      libraryTab: "inProgress",  // inProgress | finished | bookmarks
    },

    // Настройки чтения (персистентные)
    reading: _loadReadingPrefs(),

    // Dev / Admin панель
    dev: _loadDevPrefs(),
  };
}

// ── Персистентность настроек ──────────────────────────────────────
const READING_STORAGE_KEY = "app_reading_prefs";
const DEV_STORAGE_KEY     = "app_dev_prefs";

function _loadReadingPrefs(){
  const defaults = {
    fontSize:        Config.READING_DEFAULTS.fontSize,
    showTranslation: Config.READING_DEFAULTS.showTranslation,
    lineTranslation: Config.READING_DEFAULTS.lineTranslation,
    swapLang:        Config.READING_DEFAULTS.swapLang,
    night:           Config.READING_DEFAULTS.night,
    highlight:       Config.READING_DEFAULTS.highlight,
    highlightTheme:  Config.READING_DEFAULTS.highlightTheme,
    sourceLang:      Config.READING_DEFAULTS.sourceLang,
    targetLang:      Config.READING_DEFAULTS.targetLang,
    level:           Config.READING_DEFAULTS.level,
    speed:           Config.READING_DEFAULTS.speed,
    isPlaying:       false,
  };
  try{
    const saved = JSON.parse(localStorage.getItem(READING_STORAGE_KEY) || "{}");
    return Object.assign({}, defaults, saved, { isPlaying: false });
  }catch(e){ return defaults; }
}

function _loadDevPrefs(){
  const defaults = {
    enabled:             true,
    open:                false,
    translationProvider: "openai",
    ttsGender:           Config.TTS_DEFAULTS.gender,
    ttsVoice:            Config.TTS_DEFAULTS.voice,
    ttsInstructions:     Config.TTS_DEFAULTS.instructions,
    speed:               Config.TTS_DEFAULTS.speed,
    noCache:             false,
  };
  try{
    const saved = JSON.parse(localStorage.getItem(DEV_STORAGE_KEY) || "{}");
    return Object.assign({}, defaults, saved, { open: false });
  }catch(e){ return defaults; }
}

function _saveReadingPrefs(reading){
  try{
    // Не сохраняем runtime-поля
    const { isPlaying, ...toSave } = reading;
    localStorage.setItem(READING_STORAGE_KEY, JSON.stringify(toSave));
  }catch(e){}
}

function _saveDevPrefs(dev){
  try{
    const { open, enabled, ...toSave } = dev;
    localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(toSave));
  }catch(e){}
}

// ── Ядро store ────────────────────────────────────────────────────
let _state = _buildInitial();
const _listeners = new Set();

function _emit(){
  _listeners.forEach(fn => { try{ fn(_state); }catch(e){} });
}

/**
 * Получить копию текущего state.
 */
function get(){
  return _state;
}

/**
 * Обновить state (глубокий merge для вложенных объектов).
 * Store.set({ reading: { night: true } })
 * Store.set({ route: { name:"reader", bookId:"my-book" } })
 */
function set(patch){
  if(!patch || typeof patch !== "object") return;

  let readingChanged = false;
  let devChanged     = false;

  for(const key in patch){
    const val = patch[key];
    if(val && typeof val === "object" && !Array.isArray(val) && _state[key] && typeof _state[key] === "object"){
      // Глубокий merge для объектов
      _state[key] = Object.assign({}, _state[key], val);
    } else {
      _state[key] = val;
    }

    if(key === "reading") readingChanged = true;
    if(key === "dev")     devChanged     = true;
  }

  // Персистим нужные части
  if(readingChanged) _saveReadingPrefs(_state.reading);
  if(devChanged)     _saveDevPrefs(_state.dev);

  // Синхронизируем DevState (используется в tts.js и translate.js)
  _syncDevState();

  _emit();
}

/**
 * Подписаться на изменения state.
 * @param {Function} fn — вызывается с новым state
 * @returns {Function} — unsubscribe
 */
function onChange(fn){
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * Сбросить reading state к дефолтам.
 */
function resetReading(){
  set({ reading: _loadReadingPrefs() });
}

// ── Синхронизация DevState ────────────────────────────────────────
// TtsService и TranslateService читают window.DevState
// Держим его актуальным при каждом изменении store
function _syncDevState(){
  const d = _state.dev;
  const r = _state.reading;
  global.DevState = {
    translationProvider: d.translationProvider,
    ttsGender:           d.ttsGender,
    ttsVoice:            d.ttsVoice,
    ttsInstructions:     d.ttsInstructions,
    speed:               r.speed,
    noCache:             d.noCache,
    sourceLang:          r.sourceLang,
  };
}

// Инициализируем DevState сразу
_syncDevState();

// ── Экспорт ───────────────────────────────────────────────────────
global.Store = { get, set, onChange, resetReading };

})(window);