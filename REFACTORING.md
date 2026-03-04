# Books_9 — Refactoring Log

## Статус: Этап 1.5 — Рефакторинг app.js (в процессе)

**Цель:** Разбить монолитный `app.js` (6069 строк) на логические модули без изменения поведения.
**Зачем:** Подготовка к миграции на React / Flutter. Чистые сервисы без DOM легко портируются.

---

## Результаты

| До | После | Разница |
|---|---|---|
| 6069 строк | 3754 строки | **−2315 строк (−38%)** |
| 1 файл | 10 модулей | логическая структура |

---

## Что было сделано

### ✅ Блок 1 — Константы → `js/config.js`
- Все URL, константы, языки, голоса вынесены в `Config.*`
- `-132 строки` из app.js

### ✅ Блок 2 — i18n → `js/i18n.js`
- Переводы интерфейса вынесены в `I18n.*`
- `-356 строк` из app.js

### ✅ Тема → `css/theme.css`
- Весь CSS темы (светлая/тёмная, переменные) вынесен в отдельный файл
- `-490 строк` из app.js
- `index.html` обновлён: добавлена `<link rel="stylesheet" href="css/theme.css">`

### ✅ Блок 3 — Переводы → `js/services/translate.js`
- `translateWord()`, `translateLine()`, `translateTextAny()` → `TranslateService.*`
- Унифицирован cooldown, нормализация слов, кэш
- `-141 строка` из app.js
- **Баг-фикс:** 400 ошибки Worker из-за отсутствия src/trg параметров

### ✅ Блок 4 — Прогресс/Закладки → `js/progress.js` + `js/bookmarks.js`

**`js/progress.js` — `ProgressManager`:**
- `progressKey`, `pkgMode`, `pkgProgressKey`, `lastPkgKey`
- `setGlobalLastInteraction`, `getGlobalLastInteraction`
- `saveLastPkg`, `getLastPkg`
- `getPkgProgress`, `listPkgProgress`

**`js/bookmarks.js` — `BookmarkManager`:**
- `load`, `save`, `add`, `remove`
- `findByContext`, `hasAny`

Правило: **только localStorage/sessionStorage, без DOM, без state**.
UI-функции (`saveReadingProgress`, `applyBookmarkMarks`) остались в app.js.

### ✅ Блок 5 — Загрузка книг → `js/services/books.js`

**`BooksService.loadCatalog(fallbackList, normalizeFn)`** — полная логика с fallback
**`BooksService.loadBook(id, lang, level, uiLang, fallbackList, normalizeFn)`**:
- Уровни: `levels/<level>/book.<lang>.txt`
- Fallback-цепочка текста (7 вариантов)
- Chapters, описание, внутренний кэш (`Map`) без `state`

### ✅ Блок 6 — Рендеры экранов → `js/views/`

**`js/views/catalog.js`** (~217 строк) — `renderTopbar` + `renderCatalog`
**`js/views/library.js`** (~393 строк) — `renderLibrary`
**`js/views/details.js`** (~196 строк) — `renderDetails`

Результат: `-781 строка` из app.js (4574 → 3793)

Функции `renderReader`, `renderBiReader`, `renderParagraph` остались в app.js — слишком много зависимостей на локальные переменные TTS-движка.

### ✅ Блок 7 — Чистка багов и мёртвого кода (3793 → 3754)

**Баги исправлены:**
- `lineObserver`, `biProgressObserver` — не объявлены `let`, работали как неявные глобальные → объявлены явно
- `idx` в `pauseReading` — брал переменную из чужого TTS-scope → заменён на `getCursorIndex()`
- `idx` в `stopReading` — то же → убран, fallback на 0
- `routeName` в `saveReadingProgress` ~строка 1014 — undefined переменная → заменён на `mode`
- `store.js` в `index.html` — подключался впустую, `Store.*` нигде не вызывается → убран из подключения (файл остался как задел на React)

**Мёртвый код удалён:**
- `langToBcp47()` — нигде не вызывалась
- `_escHtml()` — дубликат `escapeHtml()`, единственный вызов переключён
- `startDeterministicHighlight()` — legacy speechSynthesis highlight, заменён на `startAudioWordHighlight()` (RAF)
- `resumeReading()` — нигде не вызывалась, `startReading()` используется напрямую

---

## Таблица всех исправленных багов

| Баг | Причина | Исправление |
|---|---|---|
| Точка закладки не появлялась сразу | `BookmarkManager.add()` не вызывал `applyBookmarkMarks()` | Добавлен вызов |
| Переход из библиотеки — не та строка | `go()` не передавал `level`/`sourceLang` | `route.level` и `route.sourceLang` приоритетны |
| Главная — старый прогресс | `getPkgProgress` без `level` | Добавлен level |
| Индикатор уровня у плеера отсутствовал | — | Добавлен `_updatePlayerLevel()` |
| Кнопки topbar в Listen mode растягивались | `flex` без `flex:0 0 auto` | Исправлен CSS |
| Смена языка UI не обновляла интерфейс | `applyUiLang()` не вызывался | Добавлен вызов |
| `lineObserver`/`biProgressObserver` неявные глобальные | Не объявлены `let` | Объявлены явно |
| `idx` в `pauseReading`/`stopReading` — чужой scope | Утечка из TTS loop | Заменён на `getCursorIndex()` / убран |
| `routeName` в `saveReadingProgress` — undefined | Переменная из другой функции | Заменён на `mode` |

---

## 🔴 Открытые задачи UI (следующая сессия)

### 1. Фон страницы — кнопки A / ☀ / W не работают
Кнопки в HTML **уже есть** в режимах Reader/BiReader, но **ничего не делают**.
Нужно: при клике менять CSS-переменную `--pageBg` на `<body>` + сохранять в `localStorage`.
- **A** — Белый: `#ffffff`
- **☀** — Тёплый: `#f5f0e8`
- **W** — Бумажный: `#e8e0c8`

Затронет: `css/theme.css` (добавить переменную `--pageBg`) + обработчик в `app.js`.

### 2. Верхняя полоса в Reader/BiReader — обрывается по краям
Header не растянут до краёв (в отличие от нижнего плеера).
Нужно: `width: 100%`, `left: 0`, `right: 0` для `.listenTop` / `.readTopBar`, убрать лишние отступы.

### 3. Кнопки topbar — не по центру строки
Кнопки (≡ ‹ заголовок ≡ 🔖 ⋯ ⚙︎) не выровнены по высоте.
Нужно: `align-items: center` + одинаковый `height` у контейнера и кнопок.
Ориентир: нижний плеер как образец вертикального центрирования.

### 4. Глобальная кнопка смены темы (на всех экранах)
Сейчас тема только через ⚙︎ → Night toggle.
Нужно: отдельная кнопка с тремя режимами — **Авто** (следит за `prefers-color-scheme`) / **Светлая** / **Тёмная**.
Должна быть доступна на всех экранах: каталог, библиотека, детали, reader, bireader.
Выбор сохраняется в `localStorage`. При "Авто" — слушать `matchMedia('prefers-color-scheme')`.

---

## Структура файлов сейчас

```
index.html          ← store.js убран из подключения
css/
  styles.css
  theme.css         ← светлая/тёмная тема, CSS-переменные
js/
  i18n.js           ← I18n.*
  config.js         ← Config.*
  core.js           ← без изменений
  store.js          ← задел на React, не подключён к app.js
  progress.js       ← ProgressManager.*
  bookmarks.js      ← BookmarkManager.*
  services/
    books.js        ← BooksService.*
    translate.js    ← TranslateService.*
    tts.js          ← без изменений
  views/
    catalog.js      ← renderCatalog (~217 строк)
    library.js      ← renderLibrary (~393 строк)
    details.js      ← renderDetails (~196 строк)
  app.js            ← 3754 строки (было 6069)
```

---

## Порядок подключения в index.html

```html
<script src="js/i18n.js?v=2"></script>
<script src="js/config.js?v=2"></script>
<script src="js/core.js?v=2"></script>
<!-- store.js убран — не используется -->
<script src="js/progress.js?v=1"></script>
<script src="js/bookmarks.js?v=1"></script>
<script src="js/services/books.js?v=2"></script>
<script src="js/services/translate.js?v=2"></script>
<script src="js/services/tts.js?v=2"></script>
<script src="js/views/catalog.js?v=1"></script>
<script src="js/views/library.js?v=1"></script>
<script src="js/views/details.js?v=1"></script>
<script src="js/app.js?v=6" defer></script>
```

---

## Что дальше (приоритеты)

1. **UI фиксы** (следующая сессия, низкий риск) — 4 задачи выше в разделе "Открытые задачи"
2. **Блок 8 — `js/views/reader.js`** — вынести `renderReader` + `renderBiReader` (~304 строки), средний риск
3. **Закуска:** React-миграция (store.js ждёт), Flutter, Supabase, Cloudflare R2

---

## Принципы рефакторинга

1. **Сервисы = без DOM, без state** — только чистые функции + storage
2. **Views = один файл = один экран** — глобальные функции, вызываемые из app.js
3. **UI-движок остаётся в app.js** — TTS, playback, все локальные переменные
4. **Никакого изменения поведения** — каждый блок тестируется после переноса
5. **Один баг за раз** — исправляем только что нашли, не чиним то что не сломано
