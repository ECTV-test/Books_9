(function(){
  function showCrash(title, msg, stack){
    try{
      var el=document.getElementById('app_crash_overlay');
      if(!el){
        el=document.createElement('div');
        el.id='app_crash_overlay';
        el.style.cssText='position:fixed;inset:0;z-index:999999;background:#0b0b0f;color:#fff;padding:16px;overflow:auto;font:14px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;';
        document.body.appendChild(el);
      }
      el.innerHTML='';
      var h=document.createElement('div');
      h.style.cssText='font-size:16px;font-weight:700;margin-bottom:10px;';
      h.textContent=title||'App crashed';
      var p=document.createElement('pre');
      p.style.cssText='white-space:pre-wrap;word-break:break-word;background:rgba(255,255,255,.06);padding:12px;border-radius:10px;';
      p.textContent=(msg||'') + (stack?"\n\n"+stack:'');
      el.appendChild(h);
      el.appendChild(p);
    }catch(e){}
  }
  window.addEventListener('error', function(ev){
    try{ showCrash('JS Error', String(ev.message||ev.error||'Unknown error'), ev.error && ev.error.stack ? String(ev.error.stack) : ''); }catch(e){}
  });
  window.addEventListener('unhandledrejection', function(ev){
    try{ var r=ev.reason; showCrash('Unhandled Promise Rejection', String(r && (r.message||r) || 'Unknown rejection'), r && r.stack ? String(r.stack) : ''); }catch(e){}
  });
})();

/* ── Константы вынесены в config.js → используем Config.* ── */

/* --------- Fallback book --------- */
const FALLBACK_BOOKS = [
  {
    id: "invisible-sandwich",
    series: "NEW",
    title_ua: "The Invisible Sandwich",
    title_en: "The Invisible Sandwich",
    level: "A1 English Learners",
    narrator: "Диктор",
    durationMin: 12,
    sourceLang: "en",
    cover: "https://picsum.photos/seed/invisible-sandwich/800/900",
    description:
`The Invisible Sandwich

Уровень - A1 English Learners

Enjoy a fun and simple English story made especially for A1 level learners.
The Invisible Sandwich is a short audio book with clear text and easy vocabulary. It is perfect for beginners who want to read and listen at the same time.
In this story, Tim makes a very strange sandwich. When he comes back to eat it, the sandwich is gone! Tim looks everywhere and becomes a Sandwich Detective. Step by step, he follows clues and tries to solve the mystery.`,
    text: [
      "The Invisible Sandwich",
      "Chapter 1: The Best Sandwich",
      "Tim is hungry, so he goes to the kitchen.",
      "“I want a big sandwich!” he says.",
      "He gets some bread and adds cheese, tomato, and lettuce.",
      "The end."
    ]
  }
];

/* ---------------------------
   State
--------------------------- */
const state = {
  route: { name:"catalog", bookId:null },
  navStack: [],
  catalog: [],
  book: null,
  dev: {
    enabled: true,
    open: false,
    translationProvider: "openai",
    ttsProvider: "openai",
    ttsGender: "male",
    ttsVoice: "onyx",
    ttsInstructions: "Deep calm narrator. Slow pace. Warm tone. Clear articulation. Pause briefly between sentences and a longer pause between paragraphs. Avoid sounding robotic.",
    speakTranslated: false,
    noCache: false
  },
  reading: {
    isPlaying:false,
    speed: 1.0,
    fontSize: 22,
    showTranslation: true,
    lineTranslation: true,
    swapLang: false,
    listenLang: "source",
    night: false,
    highlight: true,
    highlightTheme: "default",
    targetLang: "uk",
    sourceLang: "en",
    listenMode: "original",
    level: "original",
    progress: 0,
    activeTokenIndex: -1,
    tokenMap: [],
    wordCount: 0,
    timer: null,
    inFlight: false,
    lastReqAt: 0,
    cooldownUntil: 0
  }
};

/* ── i18n вынесен в i18n.js → используем I18n.* ── */

function getBookTitle(book){
  if(!book) return "Book";
  const uiLang = I18n.getUiLang();
  const keys = [];
  keys.push("title_" + uiLang);
  if(uiLang === "uk") keys.push("title_ua");
  keys.push("title_en");
  keys.push("title_ua");
  for(const k of keys){
    const v = book[k];
    if(typeof v === "string" && v.trim()) return v.trim();
  }
  try{
    for(const k in book){
      if(k && k.startsWith("title_")){
        const v = book[k];
        if(typeof v === "string" && v.trim()) return v.trim();
      }
    }
  }catch(e){}
  const v = book.title;
  return (typeof v === "string" && v.trim()) ? v.trim() : "Book";
}

function formatMetaAuthorSeries(b){
  try{
    const author = String((b && b.author) ? b.author : "").trim();
    const series = String((b && b.series) ? b.series : "").trim();
    if(author && series) return `${author} • ${series}`;
    return author || series || "";
  }catch(e){
    return "";
  }
}

function applyUiLang(){
  const lang = I18n.getUiLang();
  try{ document.documentElement.lang = lang; }catch(e){}
  try{
    const btn = document.getElementById("popPlayFromHere");
    if(btn) btn.textContent = I18n.t("btn_play_from_here");
    if(btn) btn.title = I18n.t("btn_play_from_here");
  }catch(e){}
  try{
    const b = document.getElementById("popBookmark");
    if(b) b.title = I18n.t("bookmark");
    const s = document.getElementById("popSpeak");
    if(s) s.title = I18n.t("speak");
  }catch(e){}
  try{
    const st = document.querySelector("#settings .setTitle");
    if(st) st.textContent = I18n.t("settings_title");
    const tr = document.getElementById("setTabRead");
    if(tr) tr.textContent = I18n.t("settings_tab_text");
    const tl = document.getElementById("setTabListen");
    if(tl) tl.textContent = I18n.t("settings_tab_audio");
  }catch(e){}
  try{
    const lbl = document.getElementById("uiLangLabel");
    if(lbl) lbl.textContent = I18n.t("ui_lang_label");
    const hint = document.getElementById("uiLangHint");
    if(hint){ const hTxt = I18n.t("ui_lang_hint"); hint.textContent = hTxt || ""; hint.style.display = hTxt ? "" : "none"; }
    const sel = document.getElementById("uiLangSelect");
    if(sel) sel.value = lang;
  }catch(e){}
  try{
    const rowTarget = document.getElementById("targetLang")?.closest(".row");
    if(rowTarget){
      const b=rowTarget.querySelector("b"); if(b) b.textContent = I18n.t("translation_lang_label");
      const sm=rowTarget.querySelector("small"); if(sm) sm.textContent = I18n.t("translation_lang_hint");
    }
    const rowFont = document.getElementById("fontMinus")?.closest(".row");
    if(rowFont){
      const b=rowFont.querySelector("b"); if(b) b.textContent = I18n.t("font_size_label");
      const sm=rowFont.querySelector("small"); if(sm) sm.textContent = I18n.t("font_size_hint");
    }
    const rowHl = document.getElementById("hlDefault")?.closest(".row");
    if(rowHl){
      const b=rowHl.querySelector("b"); if(b) b.textContent = I18n.t("hl_color_label");
      const sm=rowHl.querySelector("small"); if(sm) sm.textContent = I18n.t("hl_color_hint");
    }
    if(rowHl){
      const btns = rowHl.querySelectorAll("button");
      if(btns && btns.length>=2){
        btns[0].textContent = I18n.t("hl_color_default");
        btns[1].textContent = I18n.t("hl_color_yellow");
      }
    }
    const rowTap = document.getElementById("tTranslation")?.closest(".row");
    if(rowTap){
      const b=rowTap.querySelector("b"); if(b) b.textContent = I18n.t("tap_translate_label");
      const sm=rowTap.querySelector("small"); if(sm) sm.textContent = I18n.t("tap_translate_hint");
    }
    const rowLine = document.getElementById("tLineTranslation")?.closest(".row");
    if(rowLine){
      const b=rowLine.querySelector("b"); if(b) b.textContent = I18n.t("line_translate_label");
      const sm=rowLine.querySelector("small"); if(sm) sm.textContent = I18n.t("line_translate_hint");
    }
    const rowTheme = document.getElementById("tNight")?.closest(".row");
    if(rowTheme){
      const b=rowTheme.querySelector("b"); if(b) b.textContent = I18n.t("theme_label");
      const sm=rowTheme.querySelector("small"); if(sm) sm.textContent = I18n.t("theme_hint");
    }
    const rowHi = document.getElementById("tHighlight")?.closest(".row");
    if(rowHi){
      const b=rowHi.querySelector("b"); if(b) b.textContent = I18n.t("active_row_label");
      const sm=rowHi.querySelector("small"); if(sm) sm.textContent = I18n.t("active_row_hint");
    }
    const rowSwap = document.getElementById("tSwap")?.closest(".row");
    if(rowSwap){
      const b=rowSwap.querySelector("b"); if(b) b.textContent = I18n.t("swap_lang_label");
      const sm=rowSwap.querySelector("small"); if(sm) sm.textContent = I18n.t("swap_lang_hint");
    }
    const rowUG = document.getElementById("uMale")?.closest(".row");
    if(rowUG){
      const b=rowUG.querySelector("b"); if(b) b.textContent = I18n.t("voice_gender_label");
      const sm=rowUG.querySelector("small"); if(sm) sm.textContent = I18n.t("voice_gender_hint");
    }
    const uMale = document.getElementById("uMale");
    const uFemale = document.getElementById("uFemale");
    if(uMale) uMale.textContent = I18n.t("male");
    if(uFemale) uFemale.textContent = I18n.t("female");
    const rowSpeed = document.getElementById("uSpeedSlow")?.closest(".row");
    if(rowSpeed){
      const b=rowSpeed.querySelector("b"); if(b) b.textContent = I18n.t("speed_label");
    }
    const uSpeedSlow = document.getElementById("uSpeedSlow");
    const uSpeedNormal = document.getElementById("uSpeedNormal");
    const uSpeedFast = document.getElementById("uSpeedFast");
    if(uSpeedSlow) uSpeedSlow.textContent = I18n.t("slow");
    if(uSpeedNormal) uSpeedNormal.textContent = I18n.t("normal");
    if(uSpeedFast) uSpeedFast.textContent = I18n.t("fast");
    const hint = document.querySelector("#settings #setPaneListen .hint");
    if(hint) hint.textContent = I18n.t("normal_speed_hint");
  }catch(e){}
  try{
    const dp = document.getElementById("devPanel");
    if(dp){
      const st = dp.querySelector(".setTitle");
      if(st) st.textContent = I18n.t("admin_title");
    }
    const rowProv = document.getElementById("provLibre")?.closest(".row");
    if(rowProv){
      const b=rowProv.querySelector("b"); if(b) b.textContent = I18n.t("translation_provider_label");
      const sm=rowProv.querySelector("small"); if(sm) sm.textContent = I18n.t("translation_provider_hint");
    }
    const rowVG = document.getElementById("vMale")?.closest(".row");
    if(rowVG){
      const b=rowVG.querySelector("b"); if(b) b.textContent = I18n.t("voice_gender_label");
      const sm=rowVG.querySelector("small"); if(sm) sm.textContent = I18n.t("voice_gender_hint");
    }
    const vMale = document.getElementById("vMale");
    const vFemale = document.getElementById("vFemale");
    if(vMale) vMale.textContent = I18n.t("male");
    if(vFemale) vFemale.textContent = I18n.t("female");
    const rowVoice = document.getElementById("ttsVoiceSelect")?.closest(".row");
    if(rowVoice){
      const b=rowVoice.querySelector("b"); if(b) b.textContent = I18n.t("voice_label");
      const sm=rowVoice.querySelector("small"); if(sm) sm.textContent = I18n.t("voice_hint");
    }
    const rowPrompt = document.getElementById("ttsInstructions")?.closest(".row");
    if(rowPrompt){
      const b=rowPrompt.querySelector("b"); if(b) b.textContent = I18n.t("voice_prompt_label");
      const sm=rowPrompt.querySelector("small"); if(sm) sm.textContent = I18n.t("voice_prompt_hint");
    }
    const rowNoCache = document.getElementById("tNoCache")?.closest(".row");
    if(rowNoCache){
      const b=rowNoCache.querySelector("b"); if(b) b.textContent = I18n.t("no_cache_label");
      const sm=rowNoCache.querySelector("small"); if(sm) sm.textContent = I18n.t("no_cache_hint");
    }
    const btnCT = document.getElementById("btnClearTts");
    const btnCR = document.getElementById("btnClearTr");
    if(btnCT) btnCT.textContent = I18n.t("dev_clear_tts");
    if(btnCR) btnCR.textContent = I18n.t("dev_clear_tr");
    const hint = document.querySelector("#devPanel .hint");
    if(hint){
      hint.innerHTML = I18n.t("dev_hint_libre") + "<br/><br/>" + I18n.t("dev_hint_worker");
    }
  }catch(e){}
  try{
    const ct = document.getElementById("chaptersTitle");
    if(ct) ct.textContent = I18n.t("chapters_title");
    const cc = document.getElementById("chaptersClose");
    if(cc) cc.textContent = I18n.t("close");
  }catch(e){}
}

document.addEventListener("change", function(ev){
  try{
    const tEl = ev.target;
    if(tEl && tEl.id === "uiLangSelect"){
      I18n.setUiLang(tEl.value);
      applyUiLang();
    }
  }catch(e){}
});

/* ===========================
   v8 Core
=========================== */
const core = (window.createCoreV8 ? window.createCoreV8({ storage: localStorage }) : null);

const app = document.getElementById("app");
applyUiLang();

const player = document.getElementById("player");
const pTitle = document.getElementById("pTitle");
const pPct = document.getElementById("pPct");
const pFill = document.getElementById("pFill");
const btnPlay = document.getElementById("btnPlay");
const btnBack = document.getElementById("btnBack");
const btnStart = document.getElementById("btnStart");
const btnChapters = document.getElementById("btnChapters");
const chaptersSheet = document.getElementById("chaptersSheet");
const chaptersList = document.getElementById("chaptersList");
const chaptersClose = document.getElementById("chaptersClose");
const modeListen = document.getElementById("modeListen");
const modeRead = document.getElementById("modeRead");

const settings = document.getElementById("settings");
const setClose = document.getElementById("setClose");
const fontMinus = document.getElementById("fontMinus");
const fontPlus = document.getElementById("fontPlus");
const speed = document.getElementById("speed");
const speedLabel = document.getElementById("speedLabel");
const tTranslation = document.getElementById("tTranslation");
const rowTapTranslate = document.getElementById("rowTapTranslate");
const rowLineTranslate = document.getElementById("rowLineTranslate");
const tLineTranslation = document.getElementById("tLineTranslation");
const tNight = document.getElementById("tNight");
const tHighlight = document.getElementById("tHighlight");
const hlDefault = document.getElementById("hlDefault");
const hlYellow = document.getElementById("hlYellow");
const targetLangSelect = document.getElementById("targetLang");

const sheetBackdrop = document.getElementById("sheetBackdrop");
const setTabRead = document.getElementById("setTabRead");
const setTabListen = document.getElementById("setTabListen");
const setPaneRead = document.getElementById("setPaneRead");
const setPaneListen = document.getElementById("setPaneListen");
const uMale = document.getElementById("uMale");
const uFemale = document.getElementById("uFemale");
const uSpeedSlow = document.getElementById("uSpeedSlow");
const uSpeedNormal = document.getElementById("uSpeedNormal");
const uSpeedFast = document.getElementById("uSpeedFast");

const devPanel = document.getElementById("devPanel");
const devClose = document.getElementById("devClose");
const provLibre = document.getElementById("provLibre");
const provOpenAI = document.getElementById("provOpenAI");
const vMale = document.getElementById("vMale");
const vFemale = document.getElementById("vFemale");
const ttsVoiceSelect = document.getElementById("ttsVoiceSelect");
const tSwap = document.getElementById("tSwap");
const ttsInstructions = document.getElementById("ttsInstructions");
const tNoCache = document.getElementById("tNoCache");
const btnClearTts = document.getElementById("btnClearTts");
const btnClearTr = document.getElementById("btnClearTr");

const popover = document.getElementById("popover");
const popWord = document.getElementById("popWord");
const popTrans = document.getElementById("popTrans");
const popPlayFromHere = document.getElementById("popPlayFromHere");
const popSpeak = document.getElementById("popSpeak");
const popBookmark = document.getElementById("popBookmark");

/* ── renderTopbar, renderCatalog → js/views/catalog.js ── */
/* ── renderLibrary → js/views/library.js ── */
/* ── renderDetails → js/views/details.js ── */
