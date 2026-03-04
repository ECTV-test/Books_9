/* ═══════════════════════════════════════════════════════════════
   views/reader.js  —  Экраны «Listen» (reader) и «Read» (bireader)
   Зависимости (глобальные из app.js):
     state, app, escapeHtml(), getBookTitle(), getChapters(),
     setTheme(), syncSettingsUI(), applyHighlightTheme(),
     hideTranslation(), initReaderLineTranslations(),
     initLineTranslations(), refreshBiReaderTranslations(),
     buildTokenMap(), buildParaWordMap(), buildLineMap(),
     applyBookmarkMarks(), setCursorIndex(), clearActivePara(),
     setActivePara(), clearActiveLineUI(), setActiveLineUI(),
     scrollToPara(), clearAllWordHighlights(), setActiveParaWord(),
     goCatalog(), go(), stopReading(), openChapters(), openSettings(),
     openDev(), showBookBookmarksSheet(), renderParagraph(),
     effectiveTotalLines(), openaiAudio, updateProgressUI()
   ═══════════════════════════════════════════════════════════════ */

function renderReader(){
  if(!state.book){ return go({name:"catalog"}, {push:false}); }
  const b = state.book;

  setTheme(state.reading.night);
  syncSettingsUI();
  applyHighlightTheme();

  const lines = (b.text || []);
  const chapterStarts = new Set((getChapters()||[]).map(c=>Number(c.startIndex||0)).filter(n=>Number.isFinite(n)));

  app.innerHTML = `
    <div class="listenStage">
      <div class="readTopBar">
        <div class="rtLeft">
          <button class="chevBtn" id="btnBooks" aria-label="Books">≡</button>
          <button class="chevBtn" id="readerBack" aria-label="Back">‹</button>
        </div>
        <div class="rtCenter">${escapeHtml(b.title_en || "Book")}</div>
        <div class="rtRight">
          <button class="topIcon" id="topChapters" title="Chapters">≡</button>
          <button class="topIcon" id="topBookmarks" title="Bookmarks">🔖</button>
          <button class="topIcon" id="topDev" title="Admin">⋯</button>
          <button class="topIcon" id="topSettings" title="Settings">⚙︎</button>
        </div>
      </div>

      <div class="listenList">
        ${lines.map((p, i)=>{
          const raw = String(p ?? "");
          const isCh = chapterStarts.has(i);
          if(raw === ""){
            return `<div style="height:10px"></div>`;
          }
          return `
            <div class="listenLine ${isCh ? "chapterLine" : ""}" data-para-wrap="${i}">
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
  `;

  document.getElementById("readerBack").onclick = ()=>{ try{ stopReading(); }catch(e){} go({name:"details", bookId: (state.book?.id || state.route?.bookId || state.route?.id)},{push:false}); };
  const __books = document.getElementById("btnBooks");
  if(__books) __books.onclick = goCatalog;

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
      const rn = state.route?.name;
      if(rn === "reader" || rn === "bireader"){
        try{ state.ui = state.ui || {}; state.ui._resumeAudioAfterBMSheet = (typeof openaiAudio !== "undefined" && openaiAudio && openaiAudio.paused===false); }catch(err){}
        try{ if(typeof openaiAudio !== "undefined" && openaiAudio && openaiAudio.pause) openaiAudio.pause(); }catch(err){}
        try{ showBookBookmarksSheet(state.book?.id || state.route?.bookId); }catch(err){}
        return;
      }
      try{ stopReading(); }catch(err){}
      state.ui = state.ui || {};
      state.ui.libraryTab = "bookmarks";
      go({name:"library"}, {push:true});
    });
  }

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
          const wEl = state.reading.paraWords?.[sp]?.[wi];
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

  const chapterStarts = new Set((getChapters()||[]).map(c=>Number(c.startIndex||0)).filter(n=>Number.isFinite(n)));

  app.innerHTML = `
    <div class="readerStage">
      <div class="readTopBar">
        <div class="rtLeft">
          <button class="chevBtn" id="btnBooks" aria-label="Books">≡</button>
          <button class="chevBtn" id="readerBack" aria-label="Back">‹</button>
        </div>
        <div class="rtCenter">${escapeHtml(b.title_en || "")}</div>
        <div class="rtRight">
          <button class="topIcon" id="topChapters" title="Chapters">≡</button>
          <button class="topIcon" id="topBookmarks" title="Bookmarks">🔖</button>
          <button class="topIcon" id="topDev" title="Admin">⋯</button>
          <button class="topIcon" id="topSettings" title="Settings">⚙︎</button>
        </div>
      </div>

      <div class="paper">
        <div class="paperInner">
          <div class="bookTitle">${escapeHtml(b.title_en || "")}</div>

          ${lines.map((ln, i)=>{
            const raw = String(ln ?? "");
            const isCh = chapterStarts.has(i);
            if(raw === ""){
              return `<div style="height:14px"></div>`;
            }
            return `
              <div class="paraLine ${isCh ? "chapterLine" : ""}" data-para-wrap="${i}">
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

  document.getElementById("readerBack").onclick = ()=>{ try{ stopReading(); }catch(e){} go({name:"details", bookId: (state.book?.id || state.route?.bookId || state.route?.id)},{push:false}); };
  const __books = document.getElementById("btnBooks");
  if(__books) __books.onclick = goCatalog;

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
      if(state.route?.name === "reader" || state.route?.name === "bireader"){
        try{ state.ui = state.ui || {}; state.ui._resumeAudioAfterBMSheet = (typeof openaiAudio !== "undefined" && openaiAudio && openaiAudio.paused===false); }catch(err){}
        try{ if(typeof openaiAudio !== "undefined" && openaiAudio && openaiAudio.pause) openaiAudio.pause(); }catch(err){}
        try{ showBookBookmarksSheet(state.book?.id || state.route?.bookId); }catch(err){}
        return;
      }
      try{ stopReading(); }catch(err){}
      state.ui = state.ui || {};
      state.ui.libraryTab = "bookmarks";
      go({name:"library"}, {push:true});
    });
  }

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
