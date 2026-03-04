# Books_9 — Refactoring Log

## Статус: Этап 1.5 — Рефакторинг app.js (в процессе)

**Цель:** Разбить монолитный `app.js` (6069 строк) на логические модули без изменения поведения.
**Зачем:** Подготовка к миграции на React / Flutter. Чистые сервисы без DOM легко портируются.

---

## Результаты

| До | После | Разница |
|---|---|---|
| 6069 строк | ~4570 строк | **−1500 строк (−25%)** |
| 1 файл | 7 модулей | логическая структура |

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

---

## Баги найдены и исправлены в процессе

| Баг | Причина | Исправление |
|---|---|---|
| Точка закладки не появлялась сразу | `BookmarkManager.add()` не вызывал `applyBookmarkMarks()` | Добавлен вызов после add/remove |
| Переход из библиотеки попадал не на ту строку | `go()` не передавал `level`/`sourceLang` в `BooksService.loadBook` | `route.level` и `route.sourceLang` теперь приоритетны |
| Главная показывала старый прогресс | `getPkgProgress` вызывался без `level`, мёртвые `typeof` guards | Убраны guards, добавлен level |
| Индикатор уровня у плеера | Отсутствовал | Добавлен `_updatePlayerLevel()` |

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
  progress.js       ← ✅ NEW: storage прогресса (ProgressManager.*)
  bookmarks.js      ← ✅ NEW: storage закладок (BookmarkManager.*)
  services/
    books.js        ← ✅ обновлён: реальная логика загрузки книг (BooksService.*)
    translate.js    ← ✅ обновлён: переводы (TranslateService.*)
    tts.js          ← TTS озвучивание (без изменений)
  app.js            ← UI, рендеры, навигация (4570 строк, было 6069)
```

---

## Порядок подключения в index.html (важно!)

```html
<script src="js/i18n.js?v=2"></script>          <!-- 1. i18n первым -->
<script src="js/config.js?v=2"></script>         <!-- 2. Config -->
<script src="js/core.js?v=2"></script>           <!-- 3. Core -->
<script src="js/store.js?v=2"></script>          <!-- 4. Store -->
<script src="js/progress.js?v=1"></script>       <!-- 5. ProgressManager -->
<script src="js/bookmarks.js?v=1"></script>      <!-- 6. BookmarkManager -->
<script src="js/services/books.js?v=2"></script>     <!-- 7. BooksService -->
<script src="js/services/translate.js?v=2"></script> <!-- 8. TranslateService -->
<script src="js/services/tts.js?v=2"></script>       <!-- 9. TtsService -->
<script src="js/app.js?v=3" defer></script>          <!-- 10. App последним -->
```

---

## Что ещё планируется

### Блок 6 — Рендеры (рассматривается)
Функции `renderCatalog`, `renderDetails`, `renderReader`, `renderBiReader`, `renderLibrary` — можно вынести в `js/views/`.
**Риск:** высокий, много зависимостей на локальные переменные.
**Решение:** вынести только если нужно для React-миграции.

### Будущее
- [ ] Серверный кэш аудио (Cloudflare R2 или KV)
- [ ] Миграция на React (сервисы уже готовы — без DOM)
- [ ] Flutter (те же сервисы портируются в Dart)
- [ ] Supabase как бэкенд для прогресса и закладок

---

## Принципы рефакторинга

1. **Сервисы = без DOM, без state** — только чистые функции + storage
2. **UI остаётся в app.js** — `saveReadingProgress`, `applyBookmarkMarks`, все render*
3. **Никакого изменения поведения** — каждый блок тестируется после переноса
4. **Один баг за раз** — исправляем только что нашли, не чиним то что не сломано
