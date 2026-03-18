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

/* ── Константи винесені в config.js → використовуємо Config.* ── */

/* --------- Fallback book (твоя книга залишається) --------- */
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

Рівень - A1 English Learners

Enjoy a fun and simple English story made especially for A1 level learners.
The Invisible Sandwich is a short audio book with clear text and easy vocabulary. It is perfect for beginners who want to read and listen at the same time.
Every sentence is short and clear. The words are common and easy to understand.
This story is great for building confidence in English.
Just press play, follow the text, and enjoy learning English the easy way.`
  }
];

// ─── DOM refs ──────────────────────────────────────────────────────────────
const popover   = document.getElementById("popover");
const popWord   = document.getElementById("popWord");
const popTrans  = document.getElementById("popTrans");
const popBookmark = document.getElementById("popBookmark");
const popSpeak  = document.getElementById("popSpeak");
const popPlayFromHere = document.getElementById("popPlayFromHere");
const sheetBackdrop = document.getElementById("sheetBackdrop");

// ─── App State ─────────────────────────────────────────────────────────────
let state = {
  route: null,
  books: [],
  booksLoaded: false,
  reading: {
    book: null,
    lines: [],
    lineIndex: 0,
    wordIndex: 0,
    tokenMap: [],
    wordCount: 0,
    mode: "read",
    playing: false,
    paused: false,
    pendingSeek: null,
    ttsQueue: [],
    ttsActiveIdx: null,
  },
  settings: {
    uiLang: "en",
    targetLang: "uk",
    fontSize: 18,
    tapTranslation: true,
    lineTranslation: true,
    highlight: true,
    nightMode: false,
    hlColor: "default",
    ttsGender: "female",
    ttsSpeed: 1.0,
    ttsProvider: "openai",
    ttsVoice: "",
    ttsInstructions: "",
    noCache: false,
    swap: false,
    pageBg: "auto",
  },
};

// ─── Router ────────────────────────────────────────────────────────────────
function go(route, opts = {}){
  const push = opts.push !== false;
  if(push) history.pushState(route, "", location.pathname);
  state.route = route;
  render();
}

window.addEventListener("popstate", (ev)=>{
  state.route = ev.state || { name: "catalog" };
  render();
});

// ─── Render ────────────────────────────────────────────────────────────────
function render(){
  const r = state.route;
  if(!r) return;
  if(r.name === "catalog"){
    renderCatalog();
  } else if(r.name === "library"){
    renderLibrary();
  } else if(r.name === "details"){
    renderDetails(r.bookId);
  } else if(r.name === "read"){
    renderReader(r.bookId, r.lineIndex||0, r.mode||"read");
  }
}

// ─── Settings persistence ──────────────────────────────────────────────────
function loadSettings(){
  try{
    const raw = localStorage.getItem("bookSettings");
    if(raw){
      const s = JSON.parse(raw);
      Object.assign(state.settings, s);
    }
  }catch(e){}
}

function saveSettings(){
  try{ localStorage.setItem("bookSettings", JSON.stringify(state.settings)); }catch(e){}
}

// ─── Settings sheet ────────────────────────────────────────────────────────
const settingsEl   = document.getElementById("settings");
const setClose     = document.getElementById("setClose");
const uiLangSelect = document.getElementById("uiLangSelect");
const targetLangSel= document.getElementById("targetLang");
const fontMinus    = document.getElementById("fontMinus");
const fontPlus     = document.getElementById("fontPlus");
const tTranslation = document.getElementById("tTranslation");
const tLineTranslation = document.getElementById("tLineTranslation");
const tNight       = document.getElementById("tNight");
const tHighlight   = document.getElementById("tHighlight");
const tSwap        = document.getElementById("tSwap");
const tNoCache     = document.getElementById("tNoCache");
const speedSlider  = document.getElementById("speed");
const hlDefault    = document.getElementById("hlDefault");
const hlYellow     = document.getElementById("hlYellow");

// Dev panel
const devPanel  = document.getElementById("devPanel");
const devClose  = document.getElementById("devClose");
const provLibre = document.getElementById("provLibre");
const provOpenAI= document.getElementById("provOpenAI");
const vMale     = document.getElementById("vMale");
const vFemale   = document.getElementById("vFemale");
const ttsVoiceSelect = document.getElementById("ttsVoiceSelect");
const ttsInstructionsEl = document.getElementById("ttsInstructions");
const btnClearTts = document.getElementById("btnClearTts");
const btnClearTr  = document.getElementById("btnClearTr");

// pageBg buttons
document.querySelectorAll(".pageBgBtn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    state.settings.pageBg = btn.dataset.bg || "auto";
    saveSettings();
    applySettings();
    document.querySelectorAll(".pageBgBtn").forEach(b=>b.classList.toggle("active", b===btn));
  });
});

function openSettings(){
  syncSettingsUI();
  settingsEl.setAttribute("aria-hidden","false");
  sheetBackdrop.setAttribute("aria-hidden","false");
}
function closeSettings(){
  settingsEl.setAttribute("aria-hidden","true");
  sheetBackdrop.setAttribute("aria-hidden","true");
}

setClose.addEventListener("click", closeSettings);
sheetBackdrop.addEventListener("click", ()=>{
  closeSettings();
  closeDevPanel();
  closeBookmarks();
  closeChaptersSheet();
});

// Settings tabs
const setTabRead   = document.getElementById("setTabRead");
const setTabListen = document.getElementById("setTabListen");
const setPaneRead  = document.getElementById("setPaneRead");
const setPaneListen= document.getElementById("setPaneListen");
setTabRead.addEventListener("click",()=>{
  setTabRead.classList.add("active"); setTabListen.classList.remove("active");
  setPaneRead.style.display=""; setPaneListen.style.display="none";
});
setTabListen.addEventListener("click",()=>{
  setTabListen.classList.add("active"); setTabRead.classList.remove("active");
  setPaneListen.style.display=""; setPaneRead.style.display="none";
});

function syncSettingsUI(){
  const s = state.settings;
  uiLangSelect.value = s.uiLang || "en";
  targetLangSel.value = s.targetLang || "uk";
  tTranslation.classList.toggle("on", !!s.tapTranslation);
  tLineTranslation.classList.toggle("on", !!s.lineTranslation);
  tNight.classList.toggle("on", !!s.nightMode);
  tHighlight.classList.toggle("on", !!s.highlight);
  tSwap.classList.toggle("on", !!s.swap);
  if(tNoCache) tNoCache.classList.toggle("on", !!s.noCache);
  if(speedSlider) speedSlider.value = s.ttsSpeed || 1.0;
  const sl = document.getElementById("speedLabel");
  if(sl) sl.textContent = (s.ttsSpeed||1.0).toFixed(2).replace(/\.?0+$/,"") + "×";
  hlDefault.classList.toggle("active", s.hlColor !== "yellow");
  hlYellow.classList.toggle("active",  s.hlColor === "yellow");
  const pageBg = s.pageBg || "auto";
  document.querySelectorAll(".pageBgBtn").forEach(b=>b.classList.toggle("active", (b.dataset.bg||"auto")===pageBg));
  // sync dev panel
  if(provLibre) provLibre.classList.toggle("active", s.ttsProvider==="libre");
  if(provOpenAI) provOpenAI.classList.toggle("active", s.ttsProvider==="openai");
  if(vMale)   vMale.classList.toggle("active",   s.ttsGender==="male");
  if(vFemale) vFemale.classList.toggle("active", s.ttsGender==="female");
  if(ttsVoiceSelect) ttsVoiceSelect.value = s.ttsVoice||"";
  if(ttsInstructionsEl) ttsInstructionsEl.value = s.ttsInstructions||"";
  // font size
  const fv = document.getElementById("umFontVal");
  if(fv) fv.textContent = (s.fontSize||18) + "px";
}

function applySettings(){
  const s = state.settings;
  document.body.dataset.theme = s.nightMode ? "night" : "light";
  document.documentElement.style.setProperty("--reader-font-size", (s.fontSize||18) + "px");
  document.documentElement.style.setProperty("--hl-color", s.hlColor === "yellow" ? "#fff176" : "var(--hl-default)");
  const pageBg = s.pageBg || "auto";
  const pageBgMap = { auto:"var(--paper-bg-auto)", warm:"var(--paper-bg-warm)", white:"#fff" };
  document.documentElement.style.setProperty("--paper-bg", pageBgMap[pageBg]||pageBgMap.auto);
}

uiLangSelect.addEventListener("change",()=>{
  state.settings.uiLang = uiLangSelect.value;
  saveSettings();
  I18n.setUiLang(uiLangSelect.value);
});
targetLangSel.addEventListener("change",()=>{
  state.settings.targetLang = targetLangSel.value;
  saveSettings();
});
fontMinus.addEventListener("click",()=>{
  state.settings.fontSize = Math.max(12, (state.settings.fontSize||18) - 1);
  saveSettings(); applySettings();
  syncSettingsUI();
});
fontPlus.addEventListener("click",()=>{
  state.settings.fontSize = Math.min(32, (state.settings.fontSize||18) + 1);
  saveSettings(); applySettings();
  syncSettingsUI();
});
tTranslation.addEventListener("click",()=>{
  state.settings.tapTranslation = !state.settings.tapTranslation;
  saveSettings(); syncSettingsUI();
});
tLineTranslation.addEventListener("click",()=>{
  state.settings.lineTranslation = !state.settings.lineTranslation;
  saveSettings(); syncSettingsUI();
});
tNight.addEventListener("click",()=>{
  state.settings.nightMode = !state.settings.nightMode;
  saveSettings(); applySettings(); syncSettingsUI();
});
tHighlight.addEventListener("click",()=>{
  state.settings.highlight = !state.settings.highlight;
  saveSettings(); syncSettingsUI();
  document.querySelectorAll(".w.active").forEach(el=>{
    el.classList.toggle("hl", state.settings.highlight);
  });
});
tSwap.addEventListener("click",()=>{
  state.settings.swap = !state.settings.swap;
  saveSettings(); syncSettingsUI();
});
if(tNoCache) tNoCache.addEventListener("click",()=>{
  state.settings.noCache = !state.settings.noCache;
  saveSettings(); syncSettingsUI();
});
hlDefault.addEventListener("click",()=>{
  state.settings.hlColor = "default";
  saveSettings(); applySettings(); syncSettingsUI();
});
hlYellow.addEventListener("click",()=>{
  state.settings.hlColor = "yellow";
  saveSettings(); applySettings(); syncSettingsUI();
});
if(speedSlider){
  speedSlider.addEventListener("input",()=>{
    state.settings.ttsSpeed = parseFloat(speedSlider.value);
    saveSettings(); syncSettingsUI();
  });
}

// Dev panel wiring
function openDevPanel(){
  syncSettingsUI();
  devPanel.setAttribute("aria-hidden","false");
  sheetBackdrop.setAttribute("aria-hidden","false");
}
function closeDevPanel(){
  devPanel.setAttribute("aria-hidden","true");
  sheetBackdrop.setAttribute("aria-hidden","true");
}
if(devClose) devClose.addEventListener("click", closeDevPanel);
if(provLibre) provLibre.addEventListener("click",()=>{ state.settings.ttsProvider="libre"; saveSettings(); syncSettingsUI(); });
if(provOpenAI) provOpenAI.addEventListener("click",()=>{ state.settings.ttsProvider="openai"; saveSettings(); syncSettingsUI(); });
if(vMale) vMale.addEventListener("click",()=>{ state.settings.ttsGender="male"; saveSettings(); syncSettingsUI(); });
if(vFemale) vFemale.addEventListener("click",()=>{ state.settings.ttsGender="female"; saveSettings(); syncSettingsUI(); });
if(ttsVoiceSelect) ttsVoiceSelect.addEventListener("change",()=>{ state.settings.ttsVoice=ttsVoiceSelect.value; saveSettings(); });
if(ttsInstructionsEl) ttsInstructionsEl.addEventListener("input",()=>{ state.settings.ttsInstructions=ttsInstructionsEl.value; saveSettings(); });
if(btnClearTts) btnClearTts.addEventListener("click",()=>{ TtsService.clearCache(); });
if(btnClearTr)  btnClearTr.addEventListener("click",()=>{ TranslateService.clearCache(); });

// populate TTS voices
function populateTtsVoices(){
  if(!ttsVoiceSelect) return;
  const voices = TtsService.getVoices ? TtsService.getVoices() : [];
  ttsVoiceSelect.innerHTML = voices.map(v=>`<option value="${v.id}">${v.label}</option>`).join("");
  ttsVoiceSelect.value = state.settings.ttsVoice || "";
}

// ─── Target languages list ─────────────────────────────────────────────────
(function populateTargetLangs(){
  const langs = [
    {code:"uk",label:"Ukrainian"},
    {code:"ru",label:"Russian"},
    {code:"en",label:"English"},
    {code:"pl",label:"Polish"},
    {code:"de",label:"German"},
    {code:"es",label:"Spanish"},
    {code:"fr",label:"French"},
    {code:"it",label:"Italian"},
    {code:"pt",label:"Portuguese"},
    {code:"tr",label:"Turkish"},
    {code:"ar",label:"Arabic"},
    {code:"zh",label:"Chinese (Simplified)"},
    {code:"ja",label:"Japanese"},
    {code:"ko",label:"Korean"},
    {code:"nl",label:"Dutch"},
    {code:"cs",label:"Czech"},
    {code:"ro",label:"Romanian"},
    {code:"sv",label:"Swedish"},
    {code:"hu",label:"Hungarian"},
  ];
  if(targetLangSel){
    targetLangSel.innerHTML = langs.map(l=>`<option value="${l.code}">${l.label}</option>`).join("");
  }
})();

// ─── popover ──────────────────────────────────────────────────────────────
let popCtx = null;

function closePopover(){
  popover.setAttribute("aria-hidden","true");
  popover.style.visibility = "hidden";
  popCtx = null;
}

document.addEventListener("click", (ev)=>{
  if(!popover.contains(ev.target) && !ev.target.closest(".w")){
    closePopover();
  }
});

// ─── Chapters sheet ────────────────────────────────────────────────────────
const chaptersSheetEl = document.getElementById("chaptersSheet");
const chaptersList    = document.getElementById("chaptersList");
const chaptersTitle   = document.getElementById("chaptersTitle");
const chaptersClose   = document.getElementById("chaptersClose");

function openChaptersSheet(){
  chaptersSheetEl.setAttribute("aria-hidden","false");
  sheetBackdrop.setAttribute("aria-hidden","false");
}
function closeChaptersSheet(){
  chaptersSheetEl.setAttribute("aria-hidden","true");
  const noOtherSheet = (
    settingsEl.getAttribute("aria-hidden")==="true" &&
    devPanel.getAttribute("aria-hidden")==="true"
  );
  if(noOtherSheet) sheetBackdrop.setAttribute("aria-hidden","true");
}
if(chaptersClose) chaptersClose.addEventListener("click", closeChaptersSheet);

function renderChaptersSheet(lines){
  if(!chaptersList) return;
  const chapters = [];
  lines.forEach((l,i)=>{
    const raw = typeof l === "string" ? l : (l.original||l.text||"");
    if(/^\[\[CHAPTER:/i.test(raw)){
      const title = raw.replace(/^\[\[CHAPTER:\s*/i,"").replace(/\]\]\s*$/,"").trim();
      chapters.push({ idx: i, title });
    }
  });
  if(chaptersTitle) chaptersTitle.textContent = I18n.t("chapters") || "Chapters";
  if(!chapters.length){
    chaptersList.innerHTML = `<div style="color:var(--muted);padding:8px 4px">${I18n.t("no_chapters")||"No chapters found."}</div>`;
    return;
  }
  chaptersList.innerHTML = chapters.map(ch=>`
    <button class="btn btnGhost" style="text-align:left;justify-content:flex-start;padding:10px 14px;font-weight:700" data-idx="${ch.idx}">
      ${escapeHtml(ch.title)}
    </button>
  `).join("");
  chaptersList.querySelectorAll("button[data-idx]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const idx = parseInt(btn.dataset.idx,10);
      closeChaptersSheet();
      seekToLine(idx);
    });
  });
}

// ─── Bookmarks sheet ────────────────────────────────────────────────────────
let bmSheetOpen = false;
let bmSheetBookId = null;

function openBookmarks(bookId){
  bmSheetOpen = true;
  bmSheetBookId = bookId;
  renderBmSheet(bookId);
  const sheet = document.getElementById("bmSheet");
  if(sheet){ sheet.setAttribute("aria-hidden","false"); }
  sheetBackdrop.setAttribute("aria-hidden","false");
}
function closeBookmarks(){
  bmSheetOpen = false;
  const sheet = document.getElementById("bmSheet");
  if(sheet){ sheet.setAttribute("aria-hidden","true"); }
  sheetBackdrop.setAttribute("aria-hidden","true");
}

function _bmGetLangPair(){
  const book = state.reading && state.reading.book;
  return {
    src: book ? (book.sourceLang||"en") : "en",
    trg: state.settings.targetLang||"uk"
  };
}

function renderBmSheet(bookId){
  const container = document.getElementById("bmSheet");
  if(!container) return;
  const items = BookmarkService.list(bookId);
  const title = I18n.t("bookmarks") || "Bookmarks";
  container.innerHTML = `
    <div class="sheetHandle" aria-hidden="true"></div>
    <div class="setHead">
      <div class="setTitle">${title}</div>
      <button class="miniBtn" id="bmClose">&#x2715;</button>
    </div>
    <div class="bmSheetList">
      ${!items.length
        ? `<div class="bmEmpty">${I18n.t("no_bookmarks")||"No bookmarks yet."}</div>`
        : items.map((it,i)=>`
          <div class="bmSheetItem">
            <div class="bmSheetMain">
              <div class="bmSheetLine">#${i+1} <span class="bmSep">•</span> <span class="bmSheetLevel">${escapeHtml(Config.formatLevelLabel(it.level||"original"))}</span> <span class="bmSep">•</span> <span class="bmSheetPkg">${escapeHtml(Config.formatPkgLabel((it.sourceLang||_bmGetLangPair().src),(it.targetLang||_bmGetLangPair().trg),(it.mode||"read")))}</span></div>
              <div class="bmSheetRaw">${escapeHtml(_cleanChapterMarker(it.raw||""))}</div>
              ${it.tr ? `<div class="bmSheetTr">${escapeHtml(_cleanChapterMarker(it.tr||""))}</div>` : ``}
            </div>
            <div class="bmSheetActions">
              <button class="miniBtn bmGoBtn" data-idx="${it.lineIndex}" title="Go to line">&#x2192;</button>
              <button class="miniBtn bmDelBtn" data-id="${it.id}" title="Delete">&#x1F5D1;</button>
            </div>
          </div>
        `).join("")
      }
    </div>
  `;
  const bmClose = container.querySelector("#bmClose");
  if(bmClose) bmClose.addEventListener("click", closeBookmarks);
  container.querySelectorAll(".bmGoBtn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const idx = parseInt(btn.dataset.idx, 10);
      closeBookmarks();
      seekToLine(idx);
    });
  });
  container.querySelectorAll(".bmDelBtn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      BookmarkService.remove(btn.dataset.id);
      renderBmSheet(bookId);
    });
  });
}

// ─── Audio / TTS queue ─────────────────────────────────────────────────────
function stopAllAudio(){
  TtsService.stop();
  state.reading.playing = false;
  state.reading.paused  = false;
  state.reading.ttsQueue = [];
  state.reading.ttsActiveIdx = null;
  updatePlayerBar();
}

// one-shot speak (popover)
async function playOneShotTTS(text){
  try{
    stopAllAudio();
    await TtsService.speak(text, {
      gender:   state.settings.ttsGender,
      speed:    state.settings.ttsSpeed,
      provider: state.settings.ttsProvider,
      voice:    state.settings.ttsVoice,
      instructions: state.settings.ttsInstructions,
      noCache:  state.settings.noCache,
    });
  }catch(e){ console.warn("TTS error:", e); }
}

// ─── Player bar ────────────────────────────────────────────────────────────
const playerEl  = document.getElementById("player");
const btnPlay   = document.getElementById("btnPlay");
const btnBack   = document.getElementById("btnBack");
const btnStart  = document.getElementById("btnStart");
const pTitle    = document.getElementById("pTitle");
const pPct      = document.getElementById("pPct");
const pFill     = document.getElementById("pFill");
const btnChapters = document.getElementById("btnChapters");

function updatePlayerBar(){
  const r = state.reading;
  if(!r.book || !playerEl){ return; }
  playerEl.style.display = "";
  btnPlay.textContent = (r.playing && !r.paused) ? "⏸" : "▶";
  const total = r.lines.length || 1;
  const pct = Math.round((r.lineIndex / total) * 100);
  pPct.textContent = pct + "%";
  pFill.style.width = pct + "%";
  const bookTitle = r.book.title_en || r.book.title_ua || "Reader";
  pTitle.textContent = bookTitle;

  // show chapters button if there are chapter markers
  const hasChapters = r.lines.some(l=>{
    const raw = typeof l === "string" ? l : (l.original||l.text||"");
    return /^\[\[CHAPTER:/i.test(raw);
  });
  if(btnChapters) btnChapters.style.display = hasChapters ? "" : "none";
}

btnPlay.addEventListener("click",()=>{
  const r = state.reading;
  if(!r.book) return;
  if(r.playing && !r.paused){
    r.paused = true;
    TtsService.pause();
    updatePlayerBar();
  } else if(r.paused){
    r.paused = false;
    TtsService.resume();
    updatePlayerBar();
  } else {
    startPlayback(r.lineIndex);
  }
});

btnBack.addEventListener("click",()=>{
  const r = state.reading;
  if(!r.book) return;
  const prev = Math.max(0, r.lineIndex - 1);
  seekToLine(prev);
});

btnStart.addEventListener("click",()=>{
  seekToLine(0);
});

if(btnChapters){
  btnChapters.addEventListener("click",()=>{
    renderChaptersSheet(state.reading.lines);
    openChaptersSheet();
  });
}

// ─── seek to line ─────────────────────────────────────────────────────────
function seekToLine(idx){
  const r = state.reading;
  if(!r.book) return;
  stopAllAudio();
  r.lineIndex = idx;
  highlightLine(idx);
  updatePlayerBar();
  if(r.mode === "listen"){
    startPlayback(idx);
  }
  scrollToLine(idx);
}

function scrollToLine(idx){
  try{
    const el = document.querySelector(`.listenLine[data-idx="${idx}"], .para[data-line="${idx}"]`);
    if(el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }catch(e){}
}

// ─── Read mode ─────────────────────────────────────────────────────────────
let _readRenderKey = 0;

async function renderReadView(book, lines, startIdx){
  const key = ++_readRenderKey;
  const r = state.reading;
  await ReaderView.render(book, lines, startIdx, {
    onWord: async (raw, spanEl, lineIdx, wordIdx)=>{
      if(key !== _readRenderKey) return;
      if(!state.settings.tapTranslation) return;
      await showTranslation(raw, spanEl, lineIdx, wordIdx);
    },
    onLine: async (raw, spanEl, lineIdx)=>{
      if(key !== _readRenderKey) return;
      if(!state.settings.lineTranslation) return;
      await showLineCard(raw, spanEl, lineIdx);
    },
    onSeek: (idx)=>{
      r.lineIndex = idx;
      updatePlayerBar();
    },
    settings: state.settings,
  });
}

// ─── show popover for a word ───────────────────────────────────────────────
async function showTranslation(raw, anchorEl, lineIdx, wordIdx){
  closePopover();
  const swap = state.settings.swap;
  const src  = swap ? (state.reading.book?.targetLang||state.settings.targetLang||"uk")
                    : (state.reading.book?.sourceLang||"en");
  const trg  = swap ? (state.reading.book?.sourceLang||"en")
                    : (state.settings.targetLang||"uk");

  popWord.textContent = raw;
  popTrans.textContent = "…";
  popTrans.classList.add("loading");

  const rect = anchorEl.getBoundingClientRect();
  const pw = popover.offsetWidth || 220;
  let x = rect.left + rect.width/2 - pw/2;
  let y = rect.bottom + 8 + window.scrollY;
  x = Math.max(8, Math.min(x, window.innerWidth - pw - 8));
  popover.setAttribute("aria-hidden","false");
  popover.style.left = x + "px";
  popover.style.top = y + "px";
  popover.style.visibility = "visible";

  const tr = await TranslateService.translateWord(raw);
  popTrans.classList.remove("loading");
  popTrans.textContent = _cleanChapterMarker(tr);
  try{ if(popCtx) popCtx.tr = tr; }catch(e){}
  try{ if(popCtx) popCtx.tr = tr; }catch(e){}

  popSpeak.onclick = ()=>playOneShotTTS(raw);

  popCtx = { raw, tr, lineIdx, wordIdx, bookId: state.reading.book?.id };
  popBookmark.classList.toggle("active", BookmarkService.hasWord(state.reading.book?.id, lineIdx, wordIdx));
  popPlayFromHere.textContent = I18n.t("play_from_here") || "Play from here";
  popPlayFromHere.onclick = ()=>{ closePopover(); seekToLine(lineIdx); startPlayback(lineIdx); };
  popBookmark.onclick = ()=>{
    if(!popCtx) return;
    const already = BookmarkService.hasWord(popCtx.bookId, popCtx.lineIdx, popCtx.wordIdx);
    if(already){
      BookmarkService.removeWord(popCtx.bookId, popCtx.lineIdx, popCtx.wordIdx);
      popBookmark.classList.remove("active");
    } else {
      BookmarkService.addWord({
        bookId: popCtx.bookId,
        lineIndex: popCtx.lineIdx,
        wordIndex: popCtx.wordIdx,
        raw: popCtx.raw,
        tr: popCtx.tr,
        level: state.reading.book?.level||"",
        sourceLang: state.reading.book?.sourceLang||"en",
        targetLang: state.settings.targetLang||"uk",
        mode: "word",
      });
      popBookmark.classList.add("active");
    }
  };
}

// ─── show popover for a line ───────────────────────────────────────────────
async function showLineCard(raw, anchorEl, lineIdx){
  closePopover();

  popWord.textContent = raw;
  popTrans.textContent = "…";
  popTrans.classList.add("loading");

  const rect = anchorEl.getBoundingClientRect();
  const pw = popover.offsetWidth || 260;
  let x = rect.left + rect.width/2 - pw/2;
  let y = rect.bottom + 8 + window.scrollY;
  x = Math.max(8, Math.min(x, window.innerWidth - pw - 8));
  popover.setAttribute("aria-hidden","false");
  popover.style.left = x + "px";
  popover.style.top = y + "px";
  popover.style.visibility = "visible";

  const tr = await TranslateService.translateLine(raw);
  popTrans.classList.remove("loading");
  popTrans.textContent = _cleanChapterMarker(tr);
  try{ if(popCtx) popCtx.tr = tr; }catch(e){}
  try{ if(popCtx) popCtx.tr = tr; }catch(e){}

  popSpeak.onclick = ()=>playOneShotTTS(raw);

  popCtx = { raw, tr, lineIdx, bookId: state.reading.book?.id };
  popBookmark.classList.toggle("active", BookmarkService.hasLine(state.reading.book?.id, lineIdx));
  popPlayFromHere.textContent = I18n.t("play_from_here") || "Play from here";
  popPlayFromHere.onclick = ()=>{ closePopover(); seekToLine(lineIdx); startPlayback(lineIdx); };
  popBookmark.onclick = ()=>{
    if(!popCtx) return;
    const already = BookmarkService.hasLine(popCtx.bookId, popCtx.lineIdx);
    if(already){
      BookmarkService.removeLine(popCtx.bookId, popCtx.lineIdx);
      popBookmark.classList.remove("active");
    } else {
      BookmarkService.addLine({
        bookId: popCtx.bookId,
        lineIndex: popCtx.lineIdx,
        raw: popCtx.raw,
        tr: popCtx.tr,
        level: state.reading.book?.level||"",
        sourceLang: state.reading.book?.sourceLang||"en",
        targetLang: state.settings.targetLang||"uk",
        mode: "read",
      });
      popBookmark.classList.add("active");
    }
  };
}

// ─── Listen mode ───────────────────────────────────────────────────────────
async function renderListenView(book, lines, startIdx){
  await ListenView.render(book, lines, startIdx, {
    onSeek: (idx)=>{
      const r = state.reading;
      if(r.playing && !r.paused) stopAllAudio();
      r.lineIndex = idx;
      updatePlayerBar();
    },
    settings: state.settings,
  });
}

// ─── highlightLine ─────────────────────────────────────────────────────────
function highlightLine(idx){
  try{
    document.querySelectorAll(".listenLine.active, .para.active").forEach(el=>el.classList.remove("active"));
    const el = document.querySelector(`.listenLine[data-idx="${idx}"], .para[data-line="${idx}"]`);
    if(el) el.classList.add("active");
  }catch(e){}
}

// ─── startPlayback ─────────────────────────────────────────────────────────
async function startPlayback(fromIdx){
  const r = state.reading;
  r.playing = true;
  r.paused  = false;
  updatePlayerBar();

  const lines = r.lines;
  for(let i = fromIdx; i < lines.length; i++){
    if(!r.playing || r.paused) break;
    const lineObj = lines[i];
    const raw = typeof lineObj === "string" ? lineObj : (lineObj.original||lineObj.text||"");

    // skip chapter markers silently
    if(/^\[\[CHAPTER:/i.test(raw)){
      r.lineIndex = i;
      highlightLine(i);
      updatePlayerBar();
      continue;
    }

    r.lineIndex = i;
    r.ttsActiveIdx = i;
    highlightLine(i);
    updatePlayerBar();
    scrollToLine(i);

    try{
      await TtsService.speak(raw, {
        gender:   r.book?.ttsGender || state.settings.ttsGender,
        speed:    state.settings.ttsSpeed,
        provider: state.settings.ttsProvider,
        voice:    state.settings.ttsVoice,
        instructions: state.settings.ttsInstructions,
        noCache:  state.settings.noCache,
      });
    }catch(e){
      if(e && e.name === "AbortError") break;
      console.warn("TTS line error:", e);
    }
    if(!r.playing) break;
  }
  r.playing = false;
  r.paused  = false;
  r.ttsActiveIdx = null;
  updatePlayerBar();
}

// ─── renderReader ─────────────────────────────────────────────────────────
async function renderReader(bookId, startIdx, mode){
  const r = state.reading;
  stopAllAudio();
  r.book = null;
  r.lines = [];
  r.lineIndex = startIdx || 0;
  r.mode = mode || "read";
  updatePlayerBar();
  playerEl.style.display = "none";

  const app = document.getElementById("app");
  app.innerHTML = `<div class="loading" style="padding:40px;text-align:center">${I18n.t("loading")||"Loading…"}</div>`;

  let book = state.books.find(b=>b.id===bookId);
  if(!book) book = FALLBACK_BOOKS.find(b=>b.id===bookId);

  if(!book){
    app.innerHTML = `<div class="error" style="padding:40px;text-align:center">Book not found.</div>`;
    return;
  }

  r.book = book;

  let lines = [];
  try{
    lines = await BooksService.fetchLines(book);
  }catch(e){
    app.innerHTML = `<div class="error" style="padding:40px;text-align:center">Failed to load book content.</div>`;
    return;
  }

  r.lines = lines;
  updatePlayerBar();

  if(r.mode === "listen"){
    await renderListenView(book, lines, r.lineIndex);
  } else {
    await renderReadView(book, lines, r.lineIndex);
  }
  updatePlayerBar();
}

// ─── mode switch (read/listen) ─────────────────────────────────────────────
const modeSwitch = document.getElementById("modeSwitch");
const modeListen = document.getElementById("modeListen");
const modeRead   = document.getElementById("modeRead");

function applyModeSwitch(){
  const r = state.reading;
  if(!r.book) return;
  const startIdx = r.lineIndex;
  stopAllAudio();
  if(r.mode === "listen"){
    renderListenView(r.book, r.lines, startIdx);
  } else {
    renderReadView(r.book, r.lines, startIdx);
  }
  updatePlayerBar();
}

if(modeListen) modeListen.addEventListener("click",()=>{
  if(state.reading.mode === "listen") return;
  state.reading.mode = "listen";
  modeListen.classList.add("active");
  modeRead.classList.remove("active");
  applyModeSwitch();
});
if(modeRead) modeRead.addEventListener("click",()=>{
  if(state.reading.mode === "read") return;
  state.reading.mode = "read";
  modeRead.classList.add("active");
  modeListen.classList.remove("active");
  applyModeSwitch();
});

// ─── Top bar user menu ─────────────────────────────────────────────────────
let _userMenuOpen = false;
let _userMenuEl   = null;

function openUserMenu(anchorBtn){
  if(_userMenuOpen){ closeUserMenu(); return; }
  _userMenuOpen = true;
  const s = state.settings;
  const div = document.createElement("div");
  div.className = "userMenuDropdown";

  const langs = [
    {code:"en",label:"EN"},{code:"uk",label:"UK"},{code:"ru",label:"RU"},
    {code:"pl",label:"PL"},{code:"de",label:"DE"},{code:"es",label:"ES"},
    {code:"fr",label:"FR"},{code:"it",label:"IT"},{code:"pt",label:"PT"},
  ];
  div.innerHTML = `
    <div class="umSection">
      <div class="umLabel">${I18n.t("ui_language")||"Interface language"}</div>
      <div class="umLangRow">
        ${langs.map(l=>`<button class="umLangBtn${l.code===s.uiLang?' active':''}" data-lang="${l.code}">${l.label}</button>`).join("")}
      </div>
    </div>
    <div class="umDivider"></div>
    <div class="umSection">
      <div class="umLabel">${I18n.t("text_size")||"Text size"}</div>
      <div class="umFontRow">
        <button class="umFontBtn" id="umFontMinus">A−</button>
        <div class="umFontVal" id="umFontVal">${s.fontSize||18}px</div>
        <button class="umFontBtn" id="umFontPlus">A+</button>
      </div>
    </div>
    <div class="umDivider"></div>
    <div class="umSection" style="padding-bottom:10px">
      <div class="umLabel">${I18n.t("theme")||"Theme"}</div>
      <div style="display:flex;gap:8px">
        <button class="umLangBtn${!s.nightMode?' active':''}" id="umThemeLight">☀ Light</button>
        <button class="umLangBtn${s.nightMode?' active':''}" id="umThemeNight">☾ Night</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  _userMenuEl = div;

  // position
  const rect = anchorBtn.getBoundingClientRect();
  let left = rect.right - div.offsetWidth;
  if(left < 8) left = 8;
  div.style.top  = (rect.bottom + 6) + "px";
  div.style.left = left + "px";

  // wire lang buttons
  div.querySelectorAll(".umLangBtn[data-lang]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      state.settings.uiLang = btn.dataset.lang;
      saveSettings();
      I18n.setUiLang(btn.dataset.lang);
      closeUserMenu();
    });
  });

  // wire font
  div.querySelector("#umFontMinus")?.addEventListener("click",()=>{
    state.settings.fontSize = Math.max(12,(state.settings.fontSize||18)-1);
    saveSettings(); applySettings();
    div.querySelector("#umFontVal").textContent = state.settings.fontSize + "px";
  });
  div.querySelector("#umFontPlus")?.addEventListener("click",()=>{
    state.settings.fontSize = Math.min(32,(state.settings.fontSize||18)+1);
    saveSettings(); applySettings();
    div.querySelector("#umFontVal").textContent = state.settings.fontSize + "px";
  });

  // wire theme
  div.querySelector("#umThemeLight")?.addEventListener("click",()=>{
    state.settings.nightMode = false;
    saveSettings(); applySettings();
    closeUserMenu();
  });
  div.querySelector("#umThemeNight")?.addEventListener("click",()=>{
    state.settings.nightMode = true;
    saveSettings(); applySettings();
    closeUserMenu();
  });
}

function closeUserMenu(){
  _userMenuOpen = false;
  if(_userMenuEl){ _userMenuEl.remove(); _userMenuEl = null; }
}

document.addEventListener("click",(ev)=>{
  if(_userMenuEl && !_userMenuEl.contains(ev.target) && !ev.target.closest("#btnUserMenu")){
    closeUserMenu();
  }
});

// ─── Top-bar wiring (delegated, works for any rendered top bar) ────────────
document.getElementById("app").addEventListener("click", async (ev)=>{
  const btn = ev.target.closest("[data-action]");
  if(!btn) return;
  const action = btn.dataset.action;

  if(action === "open-settings"){
    openSettings();
  } else if(action === "open-dev"){
    populateTtsVoices();
    openDevPanel();
  } else if(action === "go-catalog"){
    stopAllAudio();
    state.reading.book = null;
    playerEl.style.display = "none";
    go({ name: "catalog" });
  } else if(action === "go-library"){
    stopAllAudio();
    state.reading.book = null;
    playerEl.style.display = "none";
    go({ name: "library" });
  } else if(action === "go-back"){
    stopAllAudio();
    history.back();
  } else if(action === "open-bookmarks"){
    const bookId = state.reading.book?.id || btn.dataset.bookId;
    if(bookId){
      let bmSheet = document.getElementById("bmSheet");
      if(!bmSheet){
        bmSheet = document.createElement("div");
        bmSheet.id = "bmSheet";
        bmSheet.className = "sheet";
        bmSheet.setAttribute("aria-hidden","true");
        document.body.appendChild(bmSheet);
      }
      openBookmarks(bookId);
    }
  } else if(action === "open-details-bookmarks"){
    const bookId = btn.dataset.bookId;
    if(bookId){
      let bmSheet = document.getElementById("bmSheet");
      if(!bmSheet){
        bmSheet = document.createElement("div");
        bmSheet.id = "bmSheet";
        bmSheet.className = "sheet";
        bmSheet.setAttribute("aria-hidden","true");
        document.body.appendChild(bmSheet);
      }
      openBookmarks(bookId);
    }
  } else if(action === "open-chapters"){
    renderChaptersSheet(state.reading.lines);
    openChaptersSheet();
  } else if(action === "user-menu"){
    openUserMenu(btn);
  }
});

// ─── i18n change re-render ─────────────────────────────────────────────────
I18n.onUiLangChange(()=>{
  try{
    const r = state.route;
    if(!r) return;
    if(r.name === "read"){
      // just re-render UI labels, don't re-fetch
      updatePlayerBar();
      if(bmSheetOpen) renderBmSheet(bmSheetBookId);
    }
  }catch(e){}
});

// ─── Helpers ───────────────────────────────────────────────────────────────
function buildCarousel(books, options = {}){
  return CatalogView.buildCarousel(books, options);
}

function renderCarouselSection(title, books, options = {}){
  return CatalogView.renderCarouselSection(title, books, options);
}

// ─── escapeHtml ────────────────────────────────────────────────────────────
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}
function _cleanChapterMarker(s){
  if(typeof s!=='string') return s;
  return s.replace(/^\[\[CHAPTER:\s*/i,'').replace(/\]\]\s*$/,'').trim();
}

function buildTokenMap(){
  const spans = [...document.querySelectorAll('.w[data-token="word"]')];
  state.reading.tokenMap = spans;
  state.reading.wordCount = spans.length;

  // IMPORTANT: translation only by click/tap to avoid 429
  spans.forEach((sp)=>{