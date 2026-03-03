/**
 * i18n.js — интернационализация интерфейса.
 * Подключать ПЕРВЫМ, до app.js
 * Использование: I18n.t('btn_back'), I18n.setUiLang('ru')
 */
(function(global){

const STRINGS = {
  en: {
    tabs_books:"Books", tabs_library:"My Library",
    btn_back:"Back", btn_all:"All", btn_close:"Close",
    btn_play_from_here:"Play from here",
    lib_in_progress:"In progress", lib_finished:"Finished",
    lib_bookmarks:"Bookmarks", all_bookmarks_title:"All bookmarks",
    settings_title:"Settings", settings_tab_text:"Text", settings_tab_audio:"Audio",
    ui_lang_label:"Interface language", ui_lang_hint:"",
    bookmark:"Bookmark", speak:"Speak",
    modal_continue:"Continue from last stop",
    modal_start_bookmark:"Start from bookmark",
    modal_cancel:"Cancel",
    start_playback_title:"Start playback",
    start_playback_desc:"You opened a bookmark. Where should we start?",
    continue_reading:"Continue reading",
    genre_fantasy:"Fantasy", genre_detectives:"Detectives",
    genre_science:"Science", genre_romance:"Romance",
    genre_history:"History", genre_kids:"Kids",
    details_btn_read:"Read", details_btn_listen:"Listen",
    details_level:"Level", details_book_lang:"Book language",
    details_trans_lang:"Translation language",
    mode_listen:"Listen", mode_read:"Read",
    level_original:"Original", pages:"pages",
    chapters_title:"Chapters", no_chapters:"No chapters in this book.",
    translation_lang_label:"Translation language", translation_lang_hint:"LibreTranslate target",
    font_size_label:"Text size", font_size_hint:"A- / A+",
    hl_color_label:"Highlight color", hl_color_hint:"Default / Yellow",
    hl_color_default:"Default", hl_color_yellow:"Yellow",
    tap_translate_label:"Translation", tap_translate_hint:"on tap / click",
    line_translate_label:"Line translation", line_translate_hint:"show under text",
    theme_label:"Theme", theme_hint:"night mode",
    active_row_label:"Highlight", active_row_hint:"active row",
    swap_lang_label:"Swap languages", swap_lang_hint:"Read mode only",
    voice_gender_label:"Voice gender", voice_gender_hint:"male / female",
    male:"Male", female:"Female",
    speed_label:"Reading speed", slow:"Slow", normal:"Normal", fast:"Fast",
    normal_speed_hint:"Normal speed is your current value (100).",
    admin_title:"Dev / Admin",
    translation_provider_label:"Translation provider",
    translation_provider_hint:"for line translation",
    voice_label:"Voice", voice_hint:"built-in OpenAI",
    voice_prompt_label:"Voice prompt", voice_prompt_hint:"instructions",
    no_cache_label:"No cache", no_cache_hint:"ignore Worker cache",
    dev_clear_tts:"🧹 Clear voice cache",
    dev_clear_tr:"🧹 Clear translation cache",
    dev_hint_libre:"Translation: LibreTranslate (public). If you see 429 — that is a rate limit.",
    dev_hint_worker:"For security, the OpenAI key is stored in Worker (secret). GitHub Pages stays static.",
  },
  uk: {
    tabs_books:"Книги", tabs_library:"Моя бібліотека",
    btn_back:"Назад", btn_all:"Усі", btn_close:"Закрити",
    btn_play_from_here:"Грати звідси",
    lib_in_progress:"В процесі", lib_finished:"Завершено",
    lib_bookmarks:"Закладки", all_bookmarks_title:"Усі закладки",
    settings_title:"Налаштування", settings_tab_text:"Текст", settings_tab_audio:"Аудіо",
    ui_lang_label:"Мова інтерфейсу", ui_lang_hint:"",
    bookmark:"Закладка", speak:"Озвучити",
    modal_continue:"Продовжити з місця зупинки",
    modal_start_bookmark:"Почати із закладки",
    modal_cancel:"Скасувати",
    start_playback_title:"Почати відтворення",
    start_playback_desc:"Ви відкрили закладку. Звідки почати?",
    continue_reading:"Продовжити читання",
    genre_fantasy:"Фентезі", genre_detectives:"Детективи",
    genre_science:"Наука", genre_romance:"Романтика",
    genre_history:"Історія", genre_kids:"Дитяче",
    details_btn_read:"Читати", details_btn_listen:"Слухати",
    details_level:"Рівень", details_book_lang:"Мова книги",
    details_trans_lang:"Мова перекладу",
    mode_listen:"Слухати", mode_read:"Читати",
    level_original:"Оригінал", pages:"стор.",
    chapters_title:"Глави", no_chapters:"У цій книзі немає глав.",
    translation_lang_label:"Мова перекладу", translation_lang_hint:"LibreTranslate target",
    font_size_label:"Розмір тексту", font_size_hint:"A- / A+",
    hl_color_label:"Колір підсвітки", hl_color_hint:"Звичайна / Жовта",
    hl_color_default:"Звичайна", hl_color_yellow:"Жовта",
    tap_translate_label:"Переклад", tap_translate_hint:"по кліку / тапу",
    line_translate_label:"Переклад рядком", line_translate_hint:"показувати під текстом",
    theme_label:"Тема", theme_hint:"нічний режим",
    active_row_label:"Підсвітка", active_row_hint:"активний рядок",
    swap_lang_label:"Поміняти мови", swap_lang_hint:'лише режим "Читати"',
    voice_gender_label:"Стать голосу", voice_gender_hint:"чоловічий / жіночий",
    male:"Чоловічий", female:"Жіночий",
    speed_label:"Швидкість читання", slow:"Повільно", normal:"Нормально", fast:"Швидко",
    normal_speed_hint:"Нормальна швидкість — це поточне значення (100).",
    admin_title:"Dev / Адмін",
    translation_provider_label:"Провайдер перекладу",
    translation_provider_hint:"для перекладу рядків",
    voice_label:"Голос", voice_hint:"вбудовані OpenAI",
    voice_prompt_label:"Промпт голосу", voice_prompt_hint:"інструкції",
    no_cache_label:"Без кешу", no_cache_hint:"ігнорувати кеш Worker",
    dev_clear_tts:"🧹 Очистити кеш озвучення",
    dev_clear_tr:"🧹 Очистити кеш перекладу",
    dev_hint_libre:"Переклад: LibreTranslate (публічний). Якщо бачиш 429 — це ліміт.",
    dev_hint_worker:"Для безпеки ключ OpenAI зберігається у Worker. GitHub Pages залишається статичним.",
  },
  ru: {
    tabs_books:"Книги", tabs_library:"Моя библиотека",
    btn_back:"Назад", btn_all:"Все", btn_close:"Закрыть",
    btn_play_from_here:"Играть отсюда",
    lib_in_progress:"В процессе", lib_finished:"Завершено",
    lib_bookmarks:"Закладки", all_bookmarks_title:"Все закладки",
    settings_title:"Настройки", settings_tab_text:"Текст", settings_tab_audio:"Аудио",
    ui_lang_label:"Язык интерфейса", ui_lang_hint:"",
    bookmark:"Закладка", speak:"Озвучить",
    modal_continue:"Продолжить с места остановки",
    modal_start_bookmark:"Начать с закладки",
    modal_cancel:"Отмена",
    start_playback_title:"Начать воспроизведение",
    start_playback_desc:"Вы открыли закладку. Откуда начать?",
    continue_reading:"Продолжить чтение",
    genre_fantasy:"Фэнтези", genre_detectives:"Детективы",
    genre_science:"Наука", genre_romance:"Романтика",
    genre_history:"История", genre_kids:"Детское",
    details_btn_read:"Читать", details_btn_listen:"Слушать",
    details_level:"Уровень", details_book_lang:"Язык книги",
    details_trans_lang:"Язык перевода",
    mode_listen:"Слушать", mode_read:"Читать",
    level_original:"Оригинал", pages:"стр.",
    chapters_title:"Главы", no_chapters:"В этой книге нет глав.",
    translation_lang_label:"Язык перевода", translation_lang_hint:"LibreTranslate target",
    font_size_label:"Размер текста", font_size_hint:"A- / A+",
    hl_color_label:"Цвет подсветки", hl_color_hint:"Обычная / Жёлтая",
    hl_color_default:"Обычная", hl_color_yellow:"Жёлтая",
    tap_translate_label:"Перевод", tap_translate_hint:"по клику / тапу",
    line_translate_label:"Перевод строкой", line_translate_hint:"показывать под текстом",
    theme_label:"Тема", theme_hint:"ночной режим",
    active_row_label:"Подсветка", active_row_hint:"активная строка",
    swap_lang_label:"Поменять языки", swap_lang_hint:'только режим "Читать"',
    voice_gender_label:"Пол голоса", voice_gender_hint:"мужской / женский",
    male:"Мужской", female:"Женский",
    speed_label:"Скорость чтения", slow:"Медленно", normal:"Нормально", fast:"Быстро",
    normal_speed_hint:"Нормальная скорость — это текущее значение (100).",
    admin_title:"Dev / Админ",
    translation_provider_label:"Провайдер перевода",
    translation_provider_hint:"для перевода строк",
    voice_label:"Голос", voice_hint:"встроенные OpenAI",
    voice_prompt_label:"Промпт голоса", voice_prompt_hint:"инструкции",
    no_cache_label:"Без кеша", no_cache_hint:"игнорировать кеш Worker",
    dev_clear_tts:"🧹 Очистить кеш озвучки",
    dev_clear_tr:"🧹 Очистить кеш перевода",   // ИСПРАВЛЕНО: было "Очистити"
    dev_hint_libre:"Перевод: LibreTranslate (публичный). Если видишь 429 — это лимит.",
    dev_hint_worker:"Для безопасности ключ OpenAI хранится в Worker. GitHub Pages остаётся статичным.",
  },
};

let _lang = null;
const _listeners = new Set();

function detectBrowser(){
  try{
    const n=(navigator.language||"").toLowerCase();
    if(n.startsWith("uk")) return "uk";
    if(n.startsWith("ru")) return "ru";
  }catch(e){}
  return "en";
}

function getUiLang(){
  if(_lang) return _lang;
  try{ const s=localStorage.getItem("uiLang"); if(s&&STRINGS[s]){_lang=s;return _lang;} }catch(e){}
  _lang=detectBrowser(); return _lang;
}

function setUiLang(lang){
  if(!STRINGS[lang]) lang="en";
  _lang=lang;
  try{ localStorage.setItem("uiLang",lang); }catch(e){}
  _listeners.forEach(fn=>{ try{ fn(lang); }catch(e){} });
}

function onUiLangChange(fn){ _listeners.add(fn); return ()=>_listeners.delete(fn); }

function t(key, vars){
  const lang=getUiLang();
  const dict=STRINGS[lang]||STRINGS.en;
  let s=(dict[key]!==undefined)?dict[key]:(STRINGS.en[key]!==undefined?STRINGS.en[key]:key);
  if(vars&&typeof vars==="object"){
    for(const k in vars) s=s.replaceAll("{"+k+"}",String(vars[k]));
  }
  return s;
}

function tGenre(name){
  const raw=String(name||"").trim();
  if(!raw) return raw;
  const slug=raw.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  const key="genre_"+slug;
  const dict=STRINGS[getUiLang()]||STRINGS.en;
  return dict[key]||raw;
}

function getAvailableLangs(){ return Object.keys(STRINGS); }

global.I18n={ t, tGenre, getUiLang, setUiLang, onUiLangChange, getAvailableLangs };

})(window);