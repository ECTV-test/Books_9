/**
 * bookmarks.js — хранение закладок в localStorage.
 * Только storage. Без DOM. Без state.
 * Использование: BookmarkManager.load(bookId)
 *                BookmarkManager.add({bookId, paraIdx, raw, tr, ...})
 *                BookmarkManager.remove(bookId, entryId)
 *                BookmarkManager.findByContext(bookId, ctx)
 *                BookmarkManager.hasAny(bookId)
 * Подключать после config.js
 */
(function(global){

// ── Ключ хранения ─────────────────────────────────────────────────

function bmKey(bookId){
  return `bm:${bookId}`;
}

// ── Загрузка / сохранение ─────────────────────────────────────────

function load(bookId){
  try{
    const s = localStorage.getItem(bmKey(bookId)) || sessionStorage.getItem(bmKey(bookId));
    if(!s) return [];
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}

function save(bookId, arr){
  try{
    localStorage.setItem(bmKey(bookId), JSON.stringify(arr||[]));
  }catch(e){
    try{ sessionStorage.setItem(bmKey(bookId), JSON.stringify(arr||[])); }catch(_e){}
  }
}

// ── Добавить закладку ─────────────────────────────────────────────

function add({ bookId, paraIdx, raw, tr, lineIndex, level, sourceLang, targetLang, mode, wordIndex, wordKey }){
  if(!bookId) return null;
  const r = String(raw||"").trim();
  const t = String(tr||"").trim();
  if(!r && !t) return null;

  const entry = {
    id:         `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    paraIdx:    Number.isFinite(paraIdx)    ? Number(paraIdx)    : 0,
    lineIndex:  Number.isFinite(lineIndex)  ? Number(lineIndex)  : (Number.isFinite(paraIdx) ? Number(paraIdx) : 0),
    level:      String(level||"original"),
    sourceLang: String(sourceLang||"").trim().toLowerCase(),
    targetLang: String(targetLang||"").trim().toLowerCase(),
    mode:       String(mode||"read"),
    wordIndex:  Number.isFinite(wordIndex)  ? Number(wordIndex)  : -1,
    wordKey:    String(wordKey||""),
    raw:        r,
    tr:         t,
    createdAt:  Date.now()
  };

  const all = load(bookId);
  all.push(entry);
  save(bookId, all);
  return entry;
}

// ── Удалить закладку ──────────────────────────────────────────────

function remove(bookId, entryId){
  if(!bookId || !entryId) return;
  const list = load(bookId).filter(x => x && x.id !== entryId);
  save(bookId, list);
}

// ── Найти закладку по контексту (для toggle UI) ───────────────────

function _normalizeWord(w){
  return String(w||"").toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "").trim();
}

function findByContext(bookId, ctx){
  try{
    if(!bookId) return null;
    const level     = String(ctx.level||"original");
    const src       = String(ctx.sourceLang||"").trim().toLowerCase();
    const trg       = String(ctx.targetLang||"").trim().toLowerCase();
    const mode      = String(ctx.mode||"read");
    const lineIndex = Number.isFinite(ctx.lineIndex) ? Number(ctx.lineIndex) : 0;
    const wordIndex = Number.isFinite(ctx.wordIndex) ? Number(ctx.wordIndex) : -1;
    const wordKey   = String(ctx.wordKey||"");
    const rawNorm   = _normalizeWord(String(ctx.raw||""));

    const list = load(bookId) || [];
    const rel  = list.filter(b => {
      if(!b) return false;
      return String(b.level||"original") === level
          && String(b.sourceLang||"").toLowerCase() === src
          && String(b.targetLang||"").toLowerCase() === trg
          && String(b.mode||"read") === mode;
    });

    if(wordIndex >= 0){
      return rel.find(b => {
        if(!b) return false;
        if(Number(b.lineIndex) !== lineIndex) return false;
        if(Number(b.wordIndex) >= 0){
          if(wordKey && String(b.wordKey||"") === wordKey) return true;
          if(Number(b.wordIndex) === wordIndex) return true;
        }
        const bn = _normalizeWord(String(b.raw||""));
        return bn && rawNorm && bn === rawNorm;
      }) || null;
    }

    // Закладка строки
    return rel.find(b => Number(b.lineIndex) === lineIndex && (Number(b.wordIndex)||-1) < 0) || null;
  }catch(e){ return null; }
}

// ── Есть ли хоть одна закладка ───────────────────────────────────

function hasAny(bookId){
  if(!bookId) return false;
  try{ return load(bookId).length > 0; }catch(e){ return false; }
}

// ── Экспорт ───────────────────────────────────────────────────────
global.BookmarkManager = {
  bmKey,
  load,
  save,
  add,
  remove,
  findByContext,
  hasAny,
};

})(window);
