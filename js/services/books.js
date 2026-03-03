/**
 * books.js — загрузка каталога и книг.
 * Использование: BooksService.loadCatalog()
 *                BooksService.loadBook(id)
 *                BooksService.getBookTitle(book)
 * Подключать после config.js
 */
(function(global){

// ── Кэш ──────────────────────────────────────────────────────────
const _catalogCache = { data: null, promise: null };
const _bookCache    = new Map(); // id -> { book, lines, translations }

// ── Каталог ───────────────────────────────────────────────────────
/**
 * Загрузить список всех книг.
 * Повторные вызовы возвращают кэш — fetch делается только один раз.
 * @returns {Promise<Array>}
 */
async function loadCatalog(){
  if(_catalogCache.data) return _catalogCache.data;

  // Защита от параллельных вызовов — один промис на всех
  if(_catalogCache.promise) return _catalogCache.promise;

  _catalogCache.promise = fetch(Config.BOOKS_INDEX_URL)
    .then(r => {
      if(!r.ok) throw new Error(`books/index.json error ${r.status}`);
      return r.json();
    })
    .then(data => {
      // index.json может быть массивом или { books: [...] }
      const list = Array.isArray(data) ? data : (data.books || []);
      _catalogCache.data    = list;
      _catalogCache.promise = null;
      return list;
    })
    .catch(err => {
      _catalogCache.promise = null;
      console.error("[Books] Failed to load catalog:", err);
      return [];
    });

  return _catalogCache.promise;
}

// ── Книга ─────────────────────────────────────────────────────────
/**
 * Загрузить полную книгу по id.
 * Загружает book.json + основной текст books/<id>/book.txt
 * @param {string} id
 * @returns {Promise<{meta, lines}>}
 */
async function loadBook(id){
  if(!id) throw new Error("loadBook: id is required");
  if(_bookCache.has(id)) return _bookCache.get(id);

  // 1. Загружаем метаданные книги
  const metaUrl = `books/${id}/book.json`;
  const metaResp = await fetch(metaUrl);
  if(!metaResp.ok) throw new Error(`book.json error ${metaResp.status} for "${id}"`);
  const meta = await metaResp.json();

  // 2. Загружаем основной текст
  const srcLang = String(meta.sourceLang || "en").toLowerCase();
  const lines   = await loadLines(id, srcLang);

  const result = { meta, lines };
  _bookCache.set(id, result);
  return result;
}

/**
 * Загрузить текстовый файл книги по языку.
 * books/<id>/book.<lang>.txt  или  books/<id>/book.txt
 * @param {string} id
 * @param {string} lang
 * @returns {Promise<string[]>}
 */
async function loadLines(id, lang){
  lang = String(lang||"en").toLowerCase();

  // Пробуем language-specific файл, потом fallback на book.txt
  const urls = [
    `books/${id}/book.${lang}.txt`,
    `books/${id}/book.txt`,
  ];

  for(const url of urls){
    try{
      const r = await fetch(url);
      if(!r.ok) continue;
      const text = await r.text();
      return _parseLines(text);
    }catch(e){
      continue;
    }
  }

  console.warn(`[Books] No text found for book "${id}" lang "${lang}"`);
  return [];
}

/**
 * Загрузить перевод книги.
 * @param {string} id
 * @param {string} lang  — язык перевода
 * @returns {Promise<string[]>}  — массив строк (может быть короче оригинала!)
 */
async function loadTranslation(id, lang){
  lang = String(lang||"uk").toLowerCase();
  return loadLines(id, lang);
}

// ── Парсинг текста ────────────────────────────────────────────────
/**
 * Разбить текстовый файл на строки.
 * Убирает BOM, нормализует переносы, сохраняет пустые строки.
 */
function _parseLines(raw){
  return raw
    .replace(/^\uFEFF/, "")        // убираем BOM
    .replace(/\r\n/g, "\n")        // нормализуем CRLF
    .replace(/\r/g, "\n")
    .split("\n");
}

// ── Вспомогательные функции ───────────────────────────────────────
/**
 * Получить название книги с учётом языка интерфейса.
 */
function getBookTitle(book){
  if(!book) return "Book";
  const uiLang = I18n.getUiLang();

  const keys = [
    "title_" + uiLang,
    uiLang === "uk" ? "title_ua" : null,  // legacy
    "title_en",
    "title_ua",
  ].filter(Boolean);

  for(const k of keys){
    const v = book[k];
    if(typeof v === "string" && v.trim()) return v.trim();
  }

  // Любой title_*
  for(const k in book){
    if(k.startsWith("title_")){
      const v = book[k];
      if(typeof v === "string" && v.trim()) return v.trim();
    }
  }

  return typeof book.title === "string" ? book.title.trim() : "Book";
}

/**
 * Получить строку "Автор • Серия" для карточки книги.
 */
function getBookMeta(book){
  try{
    const author = String((book && book.author) ? book.author : "").trim();
    const series = String((book && book.series) ? book.series : "").trim();
    if(author && series) return `${author} • ${series}`;
    return author || series || "";
  }catch(e){ return ""; }
}

/**
 * Вычислить прогресс книги в процентах.
 */
function calcProgress(lineIndex, totalLines){
  if(!totalLines || totalLines <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((lineIndex + 1) / totalLines) * 100)));
}

/**
 * Очистить кэш книг (например при смене языка).
 */
function clearCache(id){
  if(id) _bookCache.delete(id);
  else   _bookCache.clear();
}

// ── Экспорт ───────────────────────────────────────────────────────
global.BooksService = {
  loadCatalog,
  loadBook,
  loadLines,
  loadTranslation,
  getBookTitle,
  getBookMeta,
  calcProgress,
  clearCache,
};

})(window);