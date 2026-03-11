/* ═══════════════════════════════════════════════════════════════
   views/reader.js  —  Экраны «Listen» (reader) и «Read» (bireader)
   ═══════════════════════════════════════════════════════════════ */

const _SVG = {
  home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>`,
  back: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>`,
  chapters: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 10h10M4 14h12M4 18h8"/></svg>`,
  bookmark: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1z"/></svg>`,
  settings: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  dev: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
};

/* Общий HTML топбара */
function _readerTopBar(title){
  return `
    <div class="readTopBar">
      <div class="rtLeft">
        <button class="topIcon" id="btnBooks" aria-label="Menu" title="Головне меню">${_SVG.home}</button>
        <button class="topIcon" id="btnBackToDetails" aria-label="Back" title="До книги">${_SVG.back}</button>
      </div>
      <div class="rtCenter">${escapeHtml(title || "")}</div>
      <div class="rtRight">
        <button class="topIcon" id="topChapters" title="Розділи">${_SVG.chapters}</button>
        <button class="topIcon" id="topBookmarks" title="Закладки">${_SVG.bookmark}</button>
        <button class="topIcon" id="topDev" title="Admin">${_SVG.dev}</button>
        <button class="topIcon" id="topSettings" title="Налаштування">${_SVG.settings}</button>
      </div>
    </div>`;
}

/* Общий JS для кнопок топбара */
function _bindTopBar(){
  const __books = document.getElementById("btnBooks");
  if(__books) __books.onclick = goCatalog;

  const __back = document.getElementById("btnBackToDetails");
  if(__back) __back.onclick = function(){
    const bookId = (state.book && state.book.id) || (state.route && state.route.bookId);
    if(bookId){ go({name:"details", bookId: bookId}); }
    else { go({name:"catalog"}); }
  };

  const __tc = document.getElementById("topChapters");
  if(__tc) __tc.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); try{ openChapters(); }catch(err){} });

  const __ts = document.getElementById("topSettings");
  if(__ts) __ts.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); try{ openSettings(); }catch(err){} });

  const __td = document.getElementById("topDev");
  if(__td) __td.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); try{ openDev(); }catch(err){} });

  const __tbm = document.getElementById("topBookmarks");
  if(__tbm){
    __tbm.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const rn = state.route && state.route.name;
      if(rn === "reader" || rn === "bireader"){
        try{ state.ui = state.ui || {}; state.ui._resumeAudioAfterBMSheet = (typeof openaiAudio !== "undefined" && openaiAudio && openaiAudio.paused===false); }catch(err){}
        try{ if(typeof openaiAudio !== "undefined" && openaiAudio && openaiAudio.pause) openaiAudio.pause(); }catch(err){}
        try{ showBookBookmarksSheet(state.book && state.book.id || state.route && state.route.bookId); }catch(err){}
        return;
      }
      try{ stopReading(); }catch(err){}
      state.ui = state.ui || {};
      state.ui.libraryTab = "bookmarks";
      go({name:"library"}, {push:true});
    });
  }
}


function renderReader(){
  if(!state.book){ return go({name:"catalog"}, {push:false}); }
  const b = state.book;

  setTheme(state.reading.night);
  syncSettingsUI();
  applyHighlightTheme();

  const lines = (b.text || []);
  const chapterList = getChapters() || [];
  const chapterStarts = new Set(chapterList.map(c=>Number(c.startIndex||0)).filter(n=>Number.isFinite(n)));
  const chapterIndexMap = new Map(chapterList.map((c, idx)=>[Number(c.startIndex||0), idx]));

  app.innerHTML = `
    <div class="readerStage">
      ${_readerTopBar(getBookTitle(b) || "Book")}

      <div class="paper">
        <div class="paperInner listenPaper">
          <div class="bookTitle">${escapeHtml(getBookTitle(b) || "")}</div>
          <div class="listenList">
            ${lines.map((p, i)=>{
              const raw = String(p ?? "");
              const isCh = chapterStarts.has(i);
              if(raw === ""){
                return `<div style="height:10px"></div>`;
              }
              const chIdx = isCh ? chapterIndexMap.get(i) : undefined;
              const chImgHtml = (isCh && typeof chIdx === 'number')
                ? `<div class="chapterImgWrap"><img src="books/${b.id}/levels/original/chapter_${chIdx + 1}.jpg" alt="" loading="lazy" onerror="this.closest('.chapterImgWrap').style.display='none'"></div>`
                : '';
              return `
                ${chImgHtml}<div class="listenLine ${isCh ? "chapterLine" : ""}" data-para-wrap="${i}">
                  ${renderParagraph(raw, i, isCh)}
                  <button class="lineCardBtn" data-para-btn="${i}" title="Line translation">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M7 8h10M7 12h6M7 16h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  _bindTopBar();

  document.documentElement.style.setProperty("--fontSize", state.reading.fontSize + "px");
  document.documentElement.style.setProperty("--lineHeight", "1.9");

  buildTokenMap();
  buildParaWordMap();
  try{ applyBookmarkMarks(); }catch(e){}

  try{
    if(state.route && state.route.startPara != null){
      const sp = Math.max(0, Number(state.route.startPara||0));
      setCursorIndex(sp, {syncUI:false});
      state.reading.activeParaIndex = sp;
      state.reading.resumeIndexReader = sp;
      try{ clearActivePara(); }catch(e){}
      try{ setActivePara(sp); }catch(e){}
      try{
        const wi = Number(state.route.startWordIndex);
        if(Number.isFinite(wi) && wi >= 0){
          setActiveParaWord(sp, wi);
          const wEl = state.reading.paraWords && state.reading.paraWords[sp] && state.reading.paraWords[sp][wi];
          if(wEl && wEl.getBoundingClientRect){
            const r = wEl.getBoundingClientRect();
            const topZone = window.innerHeight * 0.25;
            const botZone = window.innerHeight * 0.75;
            if(r.top < topZone || r.bottom > botZone){
              window.scrollBy({top: (r.top - window.innerHeight/2), behavior:"smooth"});
            }
          }
        }
      }catch(e){}
      setTimeout(()=>{ try{ scrollToPara(sp); }catch(e){} }, 80);
      try{ delete state.route.startPara; }catch(e){}
      try{ delete state.route.startWordIndex; }catch(e){}
    }
  }catch(e){}

  initReaderLineTranslations({silent:true});

  [...document.querySelectorAll(".lineCardBtn")].forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.stopPropagation();
      const idx = Number(btn.dataset.paraBtn);
      showLineCard(idx);
    });
  });

  document.addEventListener("click", onDocClick, {capture:true});
  updateProgressUI();
}


function renderBiReader(){
  if(!state.book){ return go({name:"catalog"}, {push:false}); }
  const b = state.book;

  setTheme(state.reading.night);
  syncSettingsUI();
  applyHighlightTheme();
  hideTranslation();

  const lines = (b.text || []);
  state.reading.biTotal = effectiveTotalLines(lines);

  const chapterList2 = getChapters() || [];
  const chapterStarts = new Set(chapterList2.map(c=>Number(c.startIndex||0)).filter(n=>Number.isFinite(n)));
  const chapterIndexMap2 = new Map(chapterList2.map((c, idx)=>[Number(c.startIndex||0), idx]));

  app.innerHTML = `
    <div class="readerStage">
      ${_readerTopBar(getBookTitle(b) || "")}

      <div class="paper">
        <div class="paperInner">
          <div class="bookTitle">${escapeHtml(getBookTitle(b) || "")}</div>

          ${lines.map((ln, i)=>{
            const raw = String(ln ?? "");
            const isCh = chapterStarts.has(i);
            if(raw === ""){
              return `<div style="height:14px"></div>`;
            }
            const chIdx2 = isCh ? chapterIndexMap2.get(i) : undefined;
            const chImgHtml2 = (isCh && typeof chIdx2 === 'number')
              ? `<div class="chapterImgWrap"><img src="books/${b.id}/levels/original/chapter_${chIdx2 + 1}.jpg" alt="" loading="lazy" onerror="this.closest('.chapterImgWrap').style.display='none'"></div>`
              : '';
            return `
              ${chImgHtml2}<div class="paraLine ${isCh ? "chapterLine" : ""}" data-para-wrap="${i}">
                <div class="line" data-token="line" data-idx="${i}" data-raw="${escapeHtml(raw)}" style="${isCh? "font-weight:900;letter-spacing:.2px" : ""}">${escapeHtml(raw)}</div>
                <div class="paraTrans" data-for="${i}"></div>
                <button class="lineCardBtn" data-para-btn="${i}" title="Line translation">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 8h10M7 12h6M7 16h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;

  _bindTopBar();

  document.documentElement.style.setProperty("--fontSize", state.reading.fontSize + "px");
  document.documentElement.style.setProperty("--lineHeight", "1.9");

  buildLineMap();
  document.body.classList.toggle("hideLineTrans", !state.reading.lineTranslation);
  document.body.classList.toggle("swapLang", !!state.reading.swapLang);
  initLineTranslations();

  if(state.reading.lineTranslation){
    const needsRefresh = [...document.querySelectorAll('.paraTrans[data-for]')]
      .some(el => (el.dataset.done === '1' && (!el.textContent || !el.textContent.trim())));
    if(needsRefresh){
      try{ refreshBiReaderTranslations(); }catch(e){}
    }
  }

  try{
    [...document.querySelectorAll('[data-para-btn]')].forEach(btn=>{
      btn.addEventListener('click',(e)=>{
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(btn.dataset.paraBtn);
        showLineCard(idx);
      });
    });
  }catch(e){}

  try{ applyBookmarkMarks(); }catch(e){}
}
