/**
 * config.js — все константы в одном месте.
 * Меняй только здесь — остальное подхватит автоматически.
 * Подключать ВТОРЫМ, после i18n.js
 */
(function(global){

// ── Worker endpoints ──────────────────────────────────────────────
const WORKER_TRANSLATE_URL = "https://books-git-hab.englishclubsales.workers.dev/translate";
const WORKER_TTS_URL       = "https://books-git-hab.englishclubsales.workers.dev/tts";

// ── LibreTranslate ────────────────────────────────────────────────
const LIBRETRANSLATE_URL     = "https://libretranslate.com/translate";
const LIBRETRANSLATE_API_KEY = ""; // вставь ключ если есть

// ── Каталог книг ──────────────────────────────────────────────────
const BOOKS_INDEX_URL = "books/index.json";

// ── Поддерживаемые языки ──────────────────────────────────────────
const TARGET_LANGS = [
  { code:"en", label:"English (EN)"    },
  { code:"uk", label:"Українська (UK)" },
  { code:"ru", label:"Русский (RU)"    },
  { code:"pl", label:"Polski (PL)"     },
  { code:"de", label:"Deutsch (DE)"    },
  { code:"es", label:"Español (ES)"    },
  { code:"fr", label:"Français (FR)"   },
  { code:"it", label:"Italiano (IT)"   },
  { code:"pt", label:"Português (PT)"  },
];

const SOURCE_LANGS = (function(){
  const seen = new Set();
  return [{ code:"en", label:"English (EN)" }, ...TARGET_LANGS].filter(it => {
    if (!it || !it.code) return false;
    const c = it.code.toLowerCase();
    if (seen.has(c)) return false;
    seen.add(c); return true;
  });
})();

// ── Флаги ─────────────────────────────────────────────────────────
const FLAG_BY_LANG = {
  en:"🇬🇧", uk:"🇺🇦", ru:"🇷🇺", pl:"🇵🇱",
  de:"🇩🇪", es:"🇪🇸", fr:"🇫🇷", it:"🇮🇹", pt:"🇵🇹",
};
function flagFor(code){
  return FLAG_BY_LANG[String(code||"").toLowerCase()] || "🏳️";
}

// ── Уровни текста ─────────────────────────────────────────────────
const LEVELS = [
  { code:"original", label:"Original" },
  { code:"A1",       label:"A1"       },
  { code:"A2",       label:"A2"       },
  { code:"B1",       label:"B1"       },
];

function normalizeLevel(x){
  const v = String(x||"original").trim().toUpperCase();
  if(v==="A1"||v==="A2"||v==="B1") return v;
  return "original";
}

function formatLevelLabel(code){
  const c = String(code||"original").trim();
  if(c.toLowerCase()==="original") return I18n.t("level_original");
  const found = LEVELS.find(x => x.code.toLowerCase()===c.toLowerCase());
  return found ? found.label : c.toUpperCase();
}

function formatPkgLabel(sourceLang, targetLang, mode){
  const src = String(sourceLang||"").toLowerCase();
  const trg = String(targetLang||"").toLowerCase();
  const m   = String(mode||"").toLowerCase();
  const modeLabel = I18n.t(m==="listen" ? "mode_listen" : "mode_read");
  return `${flagFor(src)} ${src.toUpperCase()}→${flagFor(trg)} ${trg.toUpperCase()} (${modeLabel})`;
}

// ── OpenAI TTS голоса ─────────────────────────────────────────────
const OPENAI_TTS_VOICES = [
  { id:"alloy",   gender:"male"   },
  { id:"ash",     gender:"male"   },
  { id:"ballad",  gender:"male"   },
  { id:"coral",   gender:"female" },
  { id:"echo",    gender:"male"   },
  { id:"fable",   gender:"male"   },
  { id:"onyx",    gender:"male"   },
  { id:"nova",    gender:"female" },
  { id:"sage",    gender:"male"   },
  { id:"shimmer", gender:"female" },
  { id:"verse",   gender:"male"   },
];

// ── Локали для browser TTS (fallback) ─────────────────────────────
const LANG_LOCALE = {
  en:"en-US", uk:"uk-UA", ru:"ru-RU",
  pl:"pl-PL", de:"de-DE", es:"es-ES", fr:"fr-FR",
};
function langToLocale(code){
  return LANG_LOCALE[String(code||"").toLowerCase()] || "en-US";
}

// ── Дефолты ───────────────────────────────────────────────────────
const TTS_DEFAULTS = {
  gender:       "male",
  voice:        "onyx",
  instructions: "Deep calm narrator. Slow pace. Warm tone. Clear articulation. Pause briefly between sentences and a longer pause between paragraphs.",
  speed:        1.0,
  format:       "mp3",
};

const READING_DEFAULTS = {
  fontSize:        22,
  showTranslation: true,
  lineTranslation: true,
  swapLang:        false,
  night:           false,
  highlight:       true,
  highlightTheme:  "default",
  sourceLang:      "en",
  targetLang:      "uk",
  level:           "original",
  speed:           1.0,
};

// ── экспорт ───────────────────────────────────────────────────────
global.Config = {
  WORKER_TRANSLATE_URL, WORKER_TTS_URL,
  LIBRETRANSLATE_URL, LIBRETRANSLATE_API_KEY,
  BOOKS_INDEX_URL,
  TARGET_LANGS, SOURCE_LANGS,
  FLAG_BY_LANG, flagFor,
  LEVELS, normalizeLevel, formatLevelLabel, formatPkgLabel,
  OPENAI_TTS_VOICES,
  LANG_LOCALE, langToLocale,
  TTS_DEFAULTS, READING_DEFAULTS,
};

})(window);
