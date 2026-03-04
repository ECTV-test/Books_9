/**
 * books.js — загрузка каталога и книг.
 * Без DOM. Без state. Кэш внутри сервиса.
 * Использование:
 *   BooksService.loadCatalog(fallbackList, normalizeFn)
 *   BooksService.loadBook(id, sourceLang, level, uiLang, fallbackList, normalizeFn)
 *   BooksService.clearCache(id?)
 * Подключать после config.js, i18n.js
 */
(function(global){

// ── Кэш ──────────────────────────────────────────────────────────
const _bookCache = new Map(); // cacheId -> book

// ── Каталог ───────────────────────────────────────────────────────
/**
 * Загрузить список книг.
 * @param {Array}    fallbackList   — FALLBACK_BOOKS из app.js
 * @param {Function} normalizeFn   — normalizeCatalogItem из app.js
 * @returns {Promise<Array>}
 */
async function loadCatalog(fallbackList, normalizeFn){
  normalizeFn = normalizeFn || (x => x);
  const fallback = (fallbackList||[]).map(b => normalizeFn({
    id: b.id, series: b.series,
    title_ua: b.title_ua, title_en: b.title_en,
    level: b.level, durationMin: b.durationMin, cover: b.cover
  }));

  try{
    const res = await fetch(Config.BOOKS_INDEX_URL, {cache:"no-store"});
    if(!res.ok) throw new Error("index not ok");
    const remoteRaw = await res.json();
    const remote = (remoteRaw||[]).map(normalizeFn);
    const ids = new Set(remote.map(x=>x.id));
    return [...remote, ...fallback.filter(x=>!ids.has(x.id))];
  }catch(e){
    return fallback;
  }
}

// ── Книга ─────────────────────────────────────────────────────────
/**
 * Загрузить полную книгу по id.
 * Полная логика: уровни, fallback-цепочка текста, chapters, desc файлы.
 * @param {string}   id
 * @param {string}   sourceLang
 * @param {string}   level        — original | a1 | a2 | b1
 * @param {string}   uiLang       — для desc файлов
 * @param {Array}    fallbackList — FALLBACK_BOOKS
 * @param {Function} normalizeFn  — normalizeBookJson из app.js
 * @returns {Promise<object>}
 */
async function loadBook(id, sourceLang, level, uiLang, fallbackList, normalizeFn){
  const lang = String(sourceLang||"en").trim().toLowerCase();
  const uiL  = String(uiLang||"en").trim().toLowerCase();
  const lv   = _normalizeLevel(level||"original");
  normalizeFn = normalizeFn || (x => x);

  const cacheId = `${id}::${lang}::${uiL}::${lv}`;
  if(_bookCache.has(cacheId)) return _bookCache.get(cacheId);

  const basePath = `books/${encodeURIComponent(id)}`;

  try{
    const res = await fetch(`${basePath}/book.json`, {cache:"no-store"});
    if(!res.ok) throw new Error("book not ok");
    const raw = await res.json();

    // ── Текст ────────────────────────────────────────────────────
    if(!raw.text){
      const fallbackFile = raw.textFile || "book.txt";
      const candidates = [];
      candidates.push(`levels/${lv}/book.${lang}.txt`);
      if(lang !== "en") candidates.push(`levels/${lv}/book.en.txt`);
      if(lv !== "original"){
        candidates.push(`levels/original/book.${lang}.txt`);
        if(lang !== "en") candidates.push(`levels/original/book.en.txt`);
      }
      if(lang !== "en") candidates.push(`book.${lang}.txt`);
      candidates.push(fallbackFile);

      let txt = null;
      for(const rel of candidates){
        txt = await _fetchText(`${basePath}/${rel}`);
        if(txt != null) break;
      }
      raw.text = txt ? txt.split("\n") : [];
    }

    // ── Главы ────────────────────────────────────────────────────
    try{
      let ch = await _fetchJson(`${basePath}/levels/${lv}/chapters.json`);
      if(ch == null && lv !== "original")
        ch = await _fetchJson(`${basePath}/levels/original/chapters.json`);
      if(Array.isArray(ch) && ch.length) raw.chapters = ch;
    }catch(e){}

    // ── Описание ─────────────────────────────────────────────────
    try{
      let descTxt = await _fetchText(`${basePath}/desc.${uiL}.txt`);
      if(descTxt == null) descTxt = await _fetchText(`${basePath}/desc.${uiL === "uk" ? "ua" : uiL}.txt`);
      if(descTxt == null) descTxt = await _fetchText(`${basePath}/desc.en.txt`);
      if(descTxt != null){
        raw.description_i18n = raw.description_i18n || {};
        raw.description_i18n[uiL] = descTxt;
      }
    }catch(e){}

    const book = normalizeFn(raw, id);
    book.sourceLang    = lang;
    book.levelVersion  = lv;

    _bookCache.set(cacheId, book);
    return book;

  }catch(e){
    const fb = (fallbackList||[]).find(b=>b.id===id) || (fallbackList||[])[0] || {};
    _bookCache.set(cacheId, fb);
    return fb;
  }
}

// ── Заголовок книги ───────────────────────────────────────────────
function getBookTitle(book){
  if(!book) return "Book";
  const uiLang = I18n.getUiLang();
  const keys = [
    "title_" + uiLang,
    uiLang === "uk" ? "title_ua" : null,
    "title_en", "title_ua",
  ].filter(Boolean);
  for(const k of keys){
    const v = book[k];
    if(typeof v === "string" && v.trim()) return v.trim();
  }
  for(const k in book){
    if(k.startsWith("title_")){
      const v = book[k];
      if(typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return typeof book.title === "string" ? book.title.trim() : "Book";
}

// ── Утилиты ───────────────────────────────────────────────────────
function _normalizeLevel(lv){
  lv = String(lv||"original").trim().toLowerCase();
  if(lv === "orig") lv = "original";
  if(lv === "a0")   lv = "a1";
  if(["original","a1","a2","b1"].includes(lv)) return lv;
  return "original";
}

async function _fetchText(url){
  try{
    const r = await fetch(url, {cache:"no-store"});
    if(!r.ok) return null;
    let txt = await r.text();
    return txt.replace(/^\uFEFF/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
  }catch(e){ return null; }
}

async function _fetchJson(url){
  try{
    const r = await fetch(url, {cache:"no-store"});
    if(!r.ok) return null;
    return await r.json();
  }catch(e){ return null; }
}

function clearCache(id){
  if(id) _bookCache.delete(id);
  else   _bookCache.clear();
}

function getCacheSize(){ return _bookCache.size; }

// ── Экспорт ───────────────────────────────────────────────────────
global.BooksService = {
  loadCatalog,
  loadBook,
  getBookTitle,
  clearCache,
  getCacheSize,
};

})(window);
