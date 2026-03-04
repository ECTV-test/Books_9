/**
 * progress.js — хранение и чтение прогресса чтения.
 * Только localStorage/sessionStorage. Без DOM. Без state.
 * Использование: ProgressManager.save(bookId, ...), ProgressManager.get(bookId, ...)
 * Подключать после config.js
 */
(function(global){

// ── Ключи ─────────────────────────────────────────────────────────

function progressKey(bookId, mode){
  return `book_progress::${bookId}::${mode}`;
}

function pkgMode(routeName){
  if(routeName === "reader")   return "listen";
  if(routeName === "bireader") return "read";
  return String(routeName||"");
}

function pkgProgressKey(bookId, sourceLang, targetLang, level){
  const s  = String(sourceLang||"en").trim().toLowerCase();
  const t  = String(targetLang||"uk").trim().toLowerCase();
  const lv = Config.normalizeLevel(level||"original");
  if(lv === "original") return `book_pkg_progress::${String(bookId||"")}::${s}::${t}`;
  return `book_pkg_progress::${String(bookId||"")}::${s}::${t}::${lv}`;
}

function lastPkgKey(bookId){
  return `book_last_pkg::${bookId}`;
}

function globalLastInteractionKey(){
  return "app_last_interaction";
}

// ── Глобальное последнее взаимодействие ───────────────────────────

function setGlobalLastInteraction(bookId, mode, sourceLang, targetLang, level){
  try{
    const payload = {
      bookId:     String(bookId||""),
      mode:       String(mode||"").trim().toLowerCase(),
      level:      Config.normalizeLevel(level||"original"),
      sourceLang: String(sourceLang||"en").trim().toLowerCase(),
      targetLang: String(targetLang||"uk").trim().toLowerCase(),
      ts:         Date.now()
    };
    localStorage.setItem(globalLastInteractionKey(), JSON.stringify(payload));
  }catch(e){}
}

function getGlobalLastInteraction(){
  try{
    const s = localStorage.getItem(globalLastInteractionKey());
    if(!s) return null;
    const o = JSON.parse(s);
    if(!o || typeof o !== "object") return null;
    return o;
  }catch(e){ return null; }
}

// ── Последний пакет (язык+режим) для книги ────────────────────────

function saveLastPkg(bookId, routeName, sourceLang, targetLang, level){
  try{
    const payload = {
      mode:       pkgMode(routeName),
      level:      Config.normalizeLevel(level||"original"),
      sourceLang: String(sourceLang||"en").trim().toLowerCase(),
      targetLang: String(targetLang||"uk").trim().toLowerCase(),
      ts:         Date.now()
    };
    localStorage.setItem(lastPkgKey(bookId), JSON.stringify(payload));
    setGlobalLastInteraction(bookId, payload.mode, payload.sourceLang, payload.targetLang, payload.level);
  }catch(e){}
}

function getLastPkg(bookId){
  try{
    const s = localStorage.getItem(lastPkgKey(bookId));
    if(!s) return null;
    const o = JSON.parse(s);
    if(!o || typeof o !== "object") return null;
    return o;
  }catch(e){ return null; }
}

// ── Прогресс по пакету (sourceLang → targetLang + level) ──────────

function getPkgProgress(bookId, sourceLang, targetLang, level){
  try{
    const s   = String(sourceLang||"en").trim().toLowerCase();
    const t   = String(targetLang||"uk").trim().toLowerCase();
    const key = pkgProgressKey(bookId, s, t, level);
    let raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if(raw) return JSON.parse(raw);

    const lv = Config.normalizeLevel(level||"original");
    if(lv !== "original") return null;

    // Backward-compat: старые ключи per-mode → мигрируем
    const legacyKeys = [
      `book_pkg_progress::${bookId}::listen::${s}::${t}`,
      `book_pkg_progress::${bookId}::read::${s}::${t}`
    ];
    let best = null;
    for(const lk of legacyKeys){
      try{
        const v = localStorage.getItem(lk) || sessionStorage.getItem(lk);
        if(!v) continue;
        const o = JSON.parse(v);
        if(o && typeof o === "object"){
          if(!best || Number(o.ts||0) > Number(best.ts||0)) best = o;
        }
      }catch(_e){}
    }
    if(best){
      const migrated = {
        sourceLang: s, targetLang: t,
        progress:    Number(best.progress||0),
        activeIndex: Number.isFinite(best.activeIndex) ? Number(best.activeIndex) : 0,
        ts:          Number(best.ts||Date.now())
      };
      try{ localStorage.setItem(key, JSON.stringify(migrated)); }catch(e){
        try{ sessionStorage.setItem(key, JSON.stringify(migrated)); }catch(_e){}
      }
      return migrated;
    }
    return null;
  }catch(e){ return null; }
}

function listPkgProgress(bookId){
  const out    = [];
  const prefix = `book_pkg_progress::${bookId}::`;
  try{
    const scan = (storage) => {
      if(!storage) return;
      for(let i = 0; i < storage.length; i++){
        const k = storage.key(i);
        if(!k || !k.startsWith(prefix)) continue;
        try{
          const v = storage.getItem(k);
          if(!v) continue;
          const o = JSON.parse(v);
          if(o && typeof o === "object") out.push(o);
        }catch(_e){}
      }
    };
    scan(localStorage);
    scan(sessionStorage);
  }catch(e){}

  // Уникальные по level+src+trg+mode, оставляем самый свежий
  const map = new Map();
  for(const o of out){
    const s  = String(o.sourceLang||"").toLowerCase();
    const t  = String(o.targetLang||"").toLowerCase();
    const lv = Config.normalizeLevel(o.level||"original");
    const m  = String(o.mode||"").toLowerCase() || "read";
    const id = `${lv}::${s}::${t}::${m}`;
    const prev = map.get(id);
    if(!prev || Number(o.ts||0) > Number(prev.ts||0)) map.set(id, o);
  }
  return Array.from(map.values()).sort((a,b) => Number(b.ts||0) - Number(a.ts||0));
}

// ── Экспорт ───────────────────────────────────────────────────────
global.ProgressManager = {
  progressKey,
  pkgMode,
  pkgProgressKey,
  lastPkgKey,
  setGlobalLastInteraction,
  getGlobalLastInteraction,
  saveLastPkg,
  getLastPkg,
  getPkgProgress,
  listPkgProgress,
};

})(window);
