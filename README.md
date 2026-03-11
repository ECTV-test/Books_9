# Books\_9 — Веб-ридер книг

Веб-ридер для изучения иностранных языков с поддержкой уровней CEFR (A1 → Original), двуязычного чтения (BiReader), аудио-плеера и иллюстраций к главам.

Работает как **статический сайт** (GitHub Pages / любой CDN). Никакой сборки, никаких зависимостей.

---

## Система: Агент + Ридер

```
[Агент-редактор]  →  генерирует ZIP  →  [Ридер]
  (GPT, worker)        (book.json,           (reader.js, app.js)
                        levels/, *.jpg)
```

Агент создаёт книгу в нужном формате. Ридер читает её без каких-либо дополнительных конвертаций — достаточно распаковать ZIP в папку `books/`.

---

## Структура ZIP от агента

```
book-slug/
  book.json              ← метаданные книги
  cover.jpg              ← обложка
  desc.en.txt            ← описание (опционально)
  desc.uk.txt
  levels/
    original/
      book.en.txt        ← исходный текст (английский)
      book.uk.txt        ← перевод (украинский)
      chapter_1.jpg      ← иллюстрация к главе 1 (опционально)
      chapter_2.jpg      ← иллюстрация к главе 2
      chapters.json      ← список глав [{title, startIndex}]
    b2/
      book.en.txt        ← адаптированный текст уровня B2
      book.uk.txt
    b1/  a2/  a1/        ← другие уровни (та же структура)
```

**Куда распаковывать:** `books/book-slug/` → ридер подхватит автоматически.

После добавления книги нужно обновить `books/index.json`:
```json
["book-slug-1", "book-slug-2", ...]
```

---

## Формат book.json

```json
{
  "id": "brave-new-world",
  "title_en": "Brave New World",
  "title_ua": "Прекрасний новий світ",
  "series": "CLASSIC",
  "level": "B1 English Learners",
  "durationMin": 25,
  "cover": "cover.jpg",
  "description": "A classic dystopian novel...",
  "description_i18n": {
    "en": "A classic dystopian novel...",
    "uk": "Класичний антиутопічний роман..."
  }
}
```

---

## Формат текстового файла (`book.en.txt`)

Каждая строка — один абзац. Маркеры глав в формате `[[CHAPTER: Название]]`:

```
[[CHAPTER: The Beginning]]
It was a bright cold day in April.
The clocks were striking thirteen.
Winston Smith hurried home.

[[CHAPTER: Room 101]]
The Ministry of Love was the really frightening one.
```

---

## Структура проекта

```
Books_9/
  index.html             ← единственная HTML-страница (SPA)
  worker.js              ← Cloudflare Worker (translate + TTS)
  books/
    index.json           ← список ID всех книг
    book-slug/           ← одна книга (см. структуру выше)
  js/
    app.js               ← главный файл (~3300 строк): роутинг, плеер, прогресс
    config.js            ← URL воркера, списки языков, defaults
    core.js              ← "v8 core" — единый источник истины для индексов
    progress.js          ← ProgressManager: сохранение/восстановление прогресса
    bookmarks.js         ← BookmarkManager: закладки
    i18n.js              ← мультиязычный UI (EN/UK/RU/PL/DE/ES/FR/IT/PT)
    store.js             ← DevState (настройки разработчика)
    services/
      books.js           ← BooksService: загрузка книг, парсинг глав
      translate.js       ← TranslateService: кеш, rate-limit, провайдеры
      tts.js             ← TTS: OpenAI Speech через воркер
    views/
      catalog.js         ← экран каталога + топбар + user menu
      library.js         ← «Моя библиотека» (закладки, история)
      reader.js          ← режим Слушать (reader) + Читать (bireader)
      details.js         ← страница книги (детали, выбор уровня/языка)
      chapters.js        ← список глав (sheet)
  css/
    styles.css           ← основные стили
    theme.css            ← CSS-переменные (light/night темы)
```

---

## Архитектура приложения

### Роутинг

Нет URL-роутинга. Вся навигация через глобальную функцию `go(route, opts)`:

```js
go({name: "catalog"})                    // каталог
go({name: "details", bookId: "slug"})    // страница книги
go({name: "reader",  bookId: "slug"})    // режим Слушать
go({name: "bireader", bookId: "slug"})   // режим Читать (двуязычный)
go({name: "library"})                    // библиотека
```

`go()` сохраняет прогресс → меняет `state.route` → вызывает нужный `render*()` → рендерит в `<div id="app">`.

### Глобальный state

```js
state = {
  route:   { name, bookId, ... },   // текущий маршрут
  book:    { id, text, chapters, cover, ... },  // загруженная книга
  reading: { mode, fontSize, night, sourceLang, targetLang, level, ... },
  ui:      { libraryTab, ... },
  catalog: { books: [...] },
}
```

### Прогресс чтения

`ProgressManager` (progress.js) — обёртка над `localStorage` / `sessionStorage`:
- Сохраняет позицию (%) по ключу `bookId + sourceLang + targetLang + level`
- `getGlobalLastInteraction()` → возвращает последнюю открытую книгу + режим
- `saveLastPkg(bookId, routeName, ...)` → нормализует "bireader" → "read", "reader" → "listen"

### Режимы чтения

| Режим | route.name | Что показывает |
|-------|------------|----------------|
| Слушать | `reader` | Текст + TTS плеер. Тап по слову → перевод |
| Читать | `bireader` | Текст + перевод под каждой строкой |

Переключение между режимами — кнопки 🎧/📖 в плеере. Кнопка `←` в плеере — возврат к Details.

---

## Worker API

Cloudflare Worker (`worker.js`) проксирует OpenAI.

### POST /translate

```json
{
  "text":       "Hello world",
  "sourceLang": "en",
  "targetLang": "uk",
  "provider":   "openai",      // "openai" | "libre"  (default: openai)
  "level":      "original",    // "original"|"b2"|"b1"|"a2"|"a1" (default: original)
  "noCache":    false
}
```

Ответ: `{ "translation": "Привіт, світ" }`

**Промпт перевода** учитывает уровень (original = литературный стиль, a1 = простые слова), сохраняет имена персонажей, маркеры `[[CHAPTER: ...]]` и структуру строк.

### POST /tts

```json
{
  "text":         "Hello world",
  "voice":        "alloy",
  "format":       "mp3",
  "speed":        1.0,
  "instructions": "Speak warmly and clearly."
}
```

Ответ: аудио-файл (MP3).

**Secrets в Cloudflare:**
- `OPENAI_API_KEY` — обязателен
- `OPENAI_MODEL` — (опц.) default: `gpt-4o-mini`
- `OPENAI_TTS_MODEL` — (опц.) default: `gpt-4o-mini-tts`
- `ALLOWED_ORIGIN` — список разрешённых origin через запятую (или `*`)

---

## Деплой

### GitHub Pages

1. Склонировать репо, разместить книги в `books/`
2. Обновить `books/index.json`
3. `git push` → GitHub Pages автоматически опубликует

### Cloudflare Worker

```bash
cd Books_9
npx wrangler deploy worker.js --name books-worker
```

Прописать secrets:
```bash
wrangler secret put OPENAI_API_KEY
```

Обновить URL в `js/config.js`:
```js
WORKER_TRANSLATE_URL = "https://your-worker.workers.dev/translate"
WORKER_TTS_URL       = "https://your-worker.workers.dev/tts"
```

---

## История изменений

### Сессия 1 (исходное состояние)
- Базовый ридер: каталог, режимы Слушать/Читать, прогресс

### Сессия 2 (исправление кнопки «Назад»)
- Добавлена кнопка `btnBackToDetails` в reader.js (возврат к Details)

### Сессия 3 (рефакторинг + features)
- `chapters.js` — список глав вынесен в отдельный файл
- Кнопка переключения темы (луна/солнце) в каталоге
- User menu (иконка персонажа) вместо шестерёнки

### Сессия 4 (критический сбой)
- Предыдущие правки сломали index.html: дизайн разрушен, плеер потерял кнопки
- Восстановлен index.html из локальной копии (`/Volumes/MiBOX/Books_9/`)
- Добавлены: `btnChapters`, CSS для `userMenuDropdown`, правильные версии скриптов
- Коммит: `2fb239b`

### Сессия 5 (6 UI-фиксов, коммит `44f01fc`)
1. **Название книги в ридере** — `b.title_en` → `getBookTitle(b)` (reader.js)
2. **Поповер синий** → frosted glass (`var(--text)` / `var(--muted)`) (styles.css)
3. **Иконки закладок** — эмодзи заменены на SVG (app.js)
4. **Кнопка «перейти» в тёмной теме** — была белой, стала синеватой (styles.css)
5. **Табы крупнее** — 22px → 26px; user menu получил frosted glass (index.html)
6. **Память режима** — `handlePlayerBack()` теперь возвращает на Details, а не переключает режим

### Сессия 6 (текущая, коммит `44f01fc`+)
- **Иллюстрации к главам**: `reader.js` + `styles.css` — ридер показывает `chapter_N.jpg` перед каждой главой
- **Промпты перевода**: `worker.js` v3 — level-aware система промптов, сохранение имён, маркеров `[[CHAPTER:...]]`, форматирования
- **README.md**: этот файл

---

## Архитектурный анализ

### Текущее состояние

| Параметр | Значение |
|----------|---------|
| Фреймворк | Vanilla JS, нет |
| Сборщик | Нет (скрипты через `<script src="">`) |
| Типизация | Нет (чистый JS) |
| Размер app.js | ~3300 строк |
| Namespace | **Глобальный** — все функции видны из любого файла |
| State | Глобальный объект `state` |
| DOM | Прямой innerHTML + document.getElementById |

### Сильные стороны

- **Zero зависимостей** — работает на GitHub Pages без CI/CD
- **Мгновенная итерация** — правишь файл → обновляешь страницу
- **Низкий порог входа** — не нужно знать webpack/vite/npm
- **Производительность** — нет overhead реактивных фреймворков

### Слабые стороны

- **Глобальный namespace** — риск конфликтов имён при росте. Одна опечатка = неочевидный баг
- **app.js 3300 строк** — навигировать и тестировать сложно
- **Нет типов** — ошибки проявляются только в runtime
- **DOM и бизнес-логика смешаны** — сложно тестировать изолированно и портировать

### Путь улучшения (поэтапно, без переписывания)

**Шаг 1 — Уже делаем** (без risk):
- Продолжать выносить views в отдельные файлы (`catalog.js`, `library.js`, `reader.js`, `chapters.js` — уже сделано)
- Выносить сервисы (`translate.js`, `books.js`, `tts.js` — уже сделано)

**Шаг 2 — ES Modules** (небольшой риск, большой выигрыш):
```html
<!-- index.html -->
<script type="module" src="js/app.js"></script>
```
Каждый файл начинает с `export`/`import`. Глобальный namespace исчезает. **Без сборщика**.

**Шаг 3 — JSDoc типы** (нулевой риск):
```js
/** @param {BookState} book @returns {string} */
function getBookTitle(book) { ... }
```
TypeScript понимает JSDoc — IDE начинает подсказывать типы без компилятора.

**Шаг 4 — TypeScript** (средний риск, только если нужно масштабировать):
```
tsc --allowJs --declaration --emitDeclarationOnly
```
Постепенно переименовываем `.js` → `.ts`.

### Портируемость на другие языки/платформы

**Ядро бизнес-логики уже изолировано — портировать можно:**

| Модуль | Что делает | Сложность порта |
|--------|-----------|-----------------|
| `processBookTextForChapters()` | Парсинг `[[CHAPTER:]]` маркеров | ⭐ Тривиально |
| `ProgressManager` | Сохранение прогресса | ⭐ Тривиально |
| `BooksService.loadBook()` | HTTP + парсинг текста | ⭐⭐ Просто |
| `TranslateService` | Кеш + rate-limit | ⭐⭐ Просто |
| `getChapters()` | Детектирование глав | ⭐⭐ Просто |

**Сложнее портировать:**

| Модуль | Проблема |
|--------|---------|
| `renderReader()`, `renderBiReader()` | Тесно связаны с DOM |
| Обработчики кликов, тап по слову | Специфика браузера |
| TTS / Web Audio API | Нужен нативный аналог |
| `app.js` event loop | 3300 строк сложной логики |

### Есть ли шанс портировать? Да, но поэтапно

**Вариант A — React Native WebView** (быстро, 1–2 недели):
- Весь JavaScript остаётся как есть
- React Native рендерит WebView с этим же кодом
- Нативные функции (push-уведомления, offline) добавляются через `postMessage`
- **Реалистично и быстро**

**Вариант B — Полностью нативный** (долго, 2–4 месяца):
1. Сначала извлечь бизнес-логику в чистые функции (1–2 недели)
2. Написать нативный UI на Kotlin (Android) / Swift (iOS)
3. Или использовать Flutter (единая кодовая база)
- **Реалистично, но требует серьёзного рефакторинга сначала**

**Вывод:** Проект хорошо структурирован для vanilla JS. Алгоритмы работают правильно, данные организованы разумно. Для мобильного приложения — WebView — это оптимальный путь. Для масштабирования кода — начать с ES Modules (Шаг 2), не трогая логику.
