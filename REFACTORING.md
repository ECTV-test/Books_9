# Books_9 — Refactoring Log

## Статус: Этап 1.5 — Рефакторинг app.js (в процессе)

**Цель:** Разбить монолитный `app.js` (6069 строк) на логические модули без изменения поведения.
**Зачем:** Подготовка к миграции на React / Flutter. Чистые сервисы без DOM легко портируются.

---

## Результаты

| До | После | Разница |
|---|---|---|
| 6069 строк | ~3793 строк | **−2276 строк (−37%)** |
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
UI-функции (`saveReadingProgress`, `applyBookmarkMarks`) остались в app.js — они зависят от DOM.

**Баг-фикс:** после `BookmarkManager.add/remove` добавлен вызов `applyBookmarkMarks()` — точка закладки теперь появляется сразу.

### ✅ Блок 5 — Загрузка книг → `js/services/books.js`

**`BooksService.loadCatalog(fallbackList, normalizeFn)`** — полная логика с fallback
**`BooksService.loadBook(id, lang, level, uiLang, fallbackList, normalizeFn)`** — реальная логика:
- Уровни: `levels/<level>/book.<lang>.txt`
- Fallback-цепочка текста (7 вариантов)
- Chapters: `levels/<level>/chapters.json`
- Описание: `desc.<uiLang>.txt`
- Внутренний кэш (`Map`) без `state`

`state.bookCache` удалён — кэш теперь в `BooksService`.

### ✅ Блок 6 — Рендеры экранов → `js/views/`

Три экрана вынесены из app.js в отдельные файлы по принципу **один файл = один экран**:

**`js/views/catalog.js`** (~217 строк)
- `renderTopbar(title)` — шапка
- `renderCatalog()` — главный экран каталога книг

**`js/views/library.js`** (~393 строк)
- `renderLibrary()` — экран «Моя библиотека» (прогресс, закладки)

**`js/views/details.js`** (~196 строк)
- `renderDetails()` — экран деталей книги (выбор языка, уровня, старт чтения)

**Результат:** `-781 строка` из app.js (4574 → 3793)

Функции `renderReader`, `renderBiReader`, `renderParagraph` остались в app.js — слишком много зависимостей на локальные переменные TTS-движка.

**Также исправлено в этой сессии:**
- **Баг-фикс topbar (Listen mode):** кнопки растягивались по краям → `.listenTop .ltLeft/.ltRight` получили `flex:0 0 auto`
- **Баг-фикс смена языка интерфейса:** при смене языка в дропдауне UI не обновлялся → добавлен вызов `applyUiLang()` после `I18n.setUiLang()`

---

## Баги найдены и исправлены в процессе

| Баг | Причина | Исправление |
|---|---|---|
| Точка закладки не появлялась сразу | `BookmarkManager.add()` не вызывал `applyBookmarkMarks()` | Добавлен вызов после add/remove |
| Переход из библиотеки попадал не на ту строку | `go()` не передавал `level`/`sourceLang` в `BooksService.loadBook` | `route.level` и `route.sourceLang` теперь приоритетны |
| Главная показывала старый прогресс | `getPkgProgress` вызывался без `level`, мёртвые `typeof` guards | Убраны guards, добавлен level |
| Индикатор уровня у плеера | Отсутствовал | Добавлен `_updatePlayerLevel()` |
| Кнопки topbar в Listen mode растягивались | `flex` без `flex:0 0 auto` | Исправлен CSS `.listenTop` |
| Смена языка UI не обновляла интерфейс | `applyUiLang()` не вызывался после смены | Добавлен вызов в обработчик `change` |

---

## Структура файлов сейчас

```
index.html          ← подключает всё в правильном порядке
css/
  styles.css        ← основные стили
  theme.css         ← ✅ NEW: светлая/тёмная тема, CSS-переменные
js/
  i18n.js           ← ✅ переводы интерфейса (I18n.*)
  config.js         ← ✅ константы, URLs, языки, голоса (Config.*)
  core.js           ← DOM-free state прогресса (без изменений)
  store.js          ← глобальный UI state (без изменений)
  progress.js       ← ✅ storage прогресса (ProgressManager.*)
  bookmarks.js      ← ✅ storage закладок (BookmarkManager.*)
  services/
    books.js        ← ✅ загрузка книг (BooksService.*)
    translate.js    ← ✅ переводы (TranslateService.*)
    tts.js          ← TTS озвучивание (без изменений)
  views/
    catalog.js      ← ✅ NEW: renderTopbar + renderCatalog (~217 строк)
    library.js      ← ✅ NEW: renderLibrary (~393 строк)
    details.js      ← ✅ NEW: renderDetails (~196 строк)
  app.js            ← UI, рендеры читалки, навигация (3793 строк, было 6069)
```

---

## Порядок подключения в index.html (важно!)

```html
<script src="js/i18n.js?v=2"></script>
<script src="js/config.js?v=2"></script>
<script src="js/core.js?v=2"></script>
<script src="js/store.js?v=2"></script>
<script src="js/progress.js?v=1"></script>
<script src="js/bookmarks.js?v=1"></script>
<script src="js/services/books.js?v=2"></script>
<script src="js/services/translate.js?v=2"></script>
<script src="js/services/tts.js?v=2"></script>
<script src="js/views/catalog.js?v=1"></script>
<script src="js/views/library.js?v=1"></script>
<script src="js/views/details.js?v=1"></script>
<script src="js/app.js?v=5" defer></script>
```

---

## Что ещё планируется

### Блок 7 — renderReader / renderBiReader (высокий риск)
Зависят на десятки локальных переменных TTS-движка (`openaiAudio`, `openaiLineIndex`, etc.).
**Решение:** вынести только в рамках полной React-миграции, не раньше.

### Будущее
- [ ] Серверный кэш аудио (Cloudflare R2 или KV)
- [ ] Миграция на React (сервисы уже готовы — без DOM)
- [ ] Flutter (те же сервисы портируются в Dart)
- [ ] Supabase как бэкенд для прогресса и закладок

---

## Принципы рефакторинга

1. **Сервисы = без DOM, без state** — только чистые функции + storage
2. **Views = один файл = один экран** — глобальные функции, вызываемые из app.js
3. **UI-движок остаётся в app.js** — TTS, playback, все локальные переменные
4. **Никакого изменения поведения** — каждый блок тестируется после переноса
5. **Один баг за раз** — исправляем только что нашли, не чиним то что не сломано
