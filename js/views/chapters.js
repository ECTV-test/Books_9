/* ── Chapters panel ── js/views/chapters.js
 *
 * Зависимости (глобальные из app.js):
 *   state, escapeHtml, I18n, getCursorIndex, setCursorIndex,
 *   stopReading, saveReadingProgress, closeSettings, closeDev,
 *   openSheet, closeSheet, chaptersSheet, chaptersList,
 *   Config, ProgressManager, resolveBookId,
 *   setActiveParaWord, _clearPendingBookmarkPlayChoice, startReading
 */

function getChapters(){
  try{
    if(core && typeof core.getChapters === "function"){
      const ch = core.getChapters() || [];
      return ch.map(c=>({ title: c.title, startIndex: c.index }));
    }
  }catch(e){}
  return (state.book && Array.isArray(state.book.chapters)) ? state.book.chapters : [];
}

function renderChaptersList(){
  if(!chaptersList) return;
  const ch = getChapters();
  if(!ch.length){
    chaptersList.innerHTML = `<div style="opacity:.6;font-weight:700;padding:8px 2px">${escapeHtml(I18n.t('no_chapters'))}</div>`;
    return;
  }
  let curLine = 0;
  try{ curLine = getCursorIndex(); }catch(e){ curLine = 0; }
  let activeIdx = 0;
  try{
    for(let i=0;i<ch.length;i++){
      const si = Number(ch[i]?.startIndex||0);
      if(Number.isFinite(si) && si <= curLine) activeIdx = i;
    }
  }catch(e){}

  chaptersList.innerHTML = ch.map((c, idx)=>{
    const rawTitle = String(c.title||"").replace(/^\[\[[^\]]*:\s*/,'').replace(/\]\]\s*$/,'').trim() || ('Chapter ' + (idx + 1));
    const title = escapeHtml(rawTitle);
    const isActive = idx === activeIdx;
    const isDone = idx < activeIdx;
    return `<button class="btn" style="text-align:left;justify-content:flex-start;gap:10px;position:relative;${isActive?'background:rgba(59,130,246,.14);':''}" data-chapter="${idx}">
      <span style="font-weight:900;opacity:.8">${idx+1}.</span>
      <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</span>
      ${isDone?`<span style="position:absolute;right:40px;font-weight:900;opacity:.65">✓</span>`:''}
      <span style="opacity:.6">›</span>
    </button>`;
  }).join('');

  [...chaptersList.querySelectorAll('[data-chapter]')].forEach(btn=>{
    btn.onclick = (e)=>{
      e.preventDefault();
      const idx = Number(btn.getAttribute('data-chapter'));
      jumpToChapter(idx);
      closeChapters();
    };
  });
}

function openChapters(){
  if(!chaptersSheet) return;
  try{ closeSettings(); }catch(e){}
  try{ closeDev(); }catch(e){}
  renderChaptersList();
  chaptersSheet.setAttribute('aria-hidden','false');
  openSheet(chaptersSheet);
}

function closeChapters(){
  if(!chaptersSheet) return;
  closeSheet(chaptersSheet);
}

function jumpToChapter(chIdx){
  const ch = getChapters();
  if(!ch.length) return;
  const c = ch[Math.max(0, Math.min(ch.length-1, Number(chIdx)||0))];
  const idx = Math.max(0, Number(c.startIndex||0));

  if(state.route?.name === 'reader' || state.route?.name === 'bireader'){
    try{ stopReading({save:false}); }catch(e){}

    setCursorIndex(idx, {syncUI:true, scroll:true});
    try{ _clearPendingBookmarkPlayChoice(); }catch(e){}
    try{
      const wi = Number(state.route?.startWordIndex);
      if(Number.isFinite(wi) && wi >= 0){
        setActiveParaWord(idx, wi);
        const wEl = state.reading.paraWords?.[idx]?.[wi];
        if(wEl && wEl.getBoundingClientRect){
          const r = wEl.getBoundingClientRect();
          const topZone = window.innerHeight * 0.25;
          const botZone = window.innerHeight * 0.75;
          if(r.top < topZone || r.bottom > botZone){
            window.scrollBy({top: (r.top - window.innerHeight/2), behavior:"smooth"});
          }
        }
      }
      try{ delete state.route.startWordIndex; }catch(e){}
    }catch(e){}

    try{ if(state.route?.autoPlay){ try{ state.route.autoPlay=false; }catch(e){}; setTimeout(()=>{ try{ startReading(); }catch(e){} }, 80); } }catch(e){}

    if(state.route?.name === 'reader'){
      try{ state.reading.activeBiLineIndex = idx; }catch(e){}
      try{ state.reading.resumeIndexBi = idx; }catch(e){}
    }else{
      try{ state.reading.activeParaIndex = idx; }catch(e){}
      try{ state.reading.resumeIndexReader = idx; }catch(e){}
    }

    try{ saveReadingProgress(); }catch(e){}
    try{ closeChapters(); }catch(e){}
    return;
  }

  // Details screen: save selected chapter as start position
  try{
    const bookId = resolveBookId();
    const src = String(state.reading.sourceLang || state.book?.sourceLang || "en").trim().toLowerCase();
    const trg = String(state.reading.targetLang || "uk").trim().toLowerCase();
    const level = Config.normalizeLevel(state.reading.level || "original");
    const pkgKey = ProgressManager.pkgProgressKey(bookId, src, trg, level);

    let prevProgress = 0;
    try{
      const prev = ProgressManager.getPkgProgress(bookId, src, trg, level);
      if(prev && typeof prev.progress === "number") prevProgress = Number(prev.progress||0);
    }catch(_e){}

    const pkgPayload = { sourceLang: src, targetLang: trg, progress: prevProgress, activeIndex: idx, ts: Date.now() };
    try{ localStorage.setItem(pkgKey, JSON.stringify(pkgPayload)); }
    catch(e){ try{ sessionStorage.setItem(pkgKey, JSON.stringify(pkgPayload)); }catch(_e){} }

    ProgressManager.saveLastPkg(bookId, state.route?.name||"details", src, trg);
  }catch(e){}
  try{ closeChapters(); }catch(e){}
}
