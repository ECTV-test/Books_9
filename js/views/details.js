/* ═══════════════════════════════════════════════════════════
   views/details.js  —  Экран «Детали книги»
   Зависимости: state, app, go(), escapeHtml(), getBookTitle(),
                formatMetaAuthorSeries(), stopReading(), saveReadingProgress(),
                restoreProgressForPair(), applyLanguagePairChange(), openChapters(),
                showBookBookmarksSheet(), TranslateService.*,
                ProgressManager.*, Config.*, I18n.*
   ═══════════════════════════════════════════════════════════ */

function renderDetails(){
  if(!state.book){ return go({name:"catalog"}, {push:false}); }
  const b = state.book;

  // progress (show last used language package; fallback to max)
  let savedPct = 0;
  let savedLabel = "";
  try{
    const last = ProgressManager.getLastPkg(b.id);
    if(last){
      const lp = ProgressManager.getPkgProgress(b.id, last.sourceLang, last.targetLang, Config.normalizeLevel(last.level||"original"));
      if(lp && typeof lp.progress === "number"){
        savedPct = Number(lp.progress||0);
        savedLabel = Config.formatPkgLabel(last.sourceLang, last.targetLang, last.mode);
      }
    }
    if(!savedLabel){
      const pkgs = ProgressManager.listPkgProgress(b.id);
      if(pkgs && pkgs.length){
        const best = pkgs.reduce((a,c)=> (Number(c.progress||0) > Number(a.progress||0) ? c : a), pkgs[0]);
        savedPct = Number(best.progress||0);
        const m = (ProgressManager.getLastPkg(b.id)?.mode) || ProgressManager.pkgMode(state.route?.name||"reader");
        savedLabel = Config.formatPkgLabel(best.sourceLang, best.targetLang, m);
      }else{
        const r = JSON.parse(sessionStorage.getItem(ProgressManager.progressKey(b.id,'reader')) || 'null');
        const br = JSON.parse(sessionStorage.getItem(ProgressManager.progressKey(b.id,'bireader')) || 'null');
        savedPct = Math.max(Number(r?.progress||0), Number(br?.progress||0));
      }
    }
  }catch(e){}
  const totalLinesForPages = Array.isArray(b.text) ? b.text.length : String(b.text||"").split(/\n/).filter(x=>x.trim()).length;
  const _fs = Number(state.reading.fontSize||22);
  const _lpp = Math.max(8, Math.round(14*22/_fs));
  const pagesEst = Math.max(1, Math.ceil(totalLinesForPages/_lpp));
  const meta1 = formatMetaAuthorSeries(b);
  let levelNow = String(state.reading.level||"");
  if(!levelNow){ try{ const lp = ProgressManager.getLastPkg(b.id); if(lp && lp.level) levelNow = String(lp.level); }catch(e){} }
  levelNow = Config.formatLevelLabel(levelNow || "original");
  const pctNow = Math.max(0, Math.round(Number(savedPct||0)));
  const pkgLine = `• ${levelNow} • ~${pagesEst} ${I18n.t("pages")} • ${pctNow}%${savedLabel?` • ${savedLabel}`:``}`;

  const uiL = I18n.getUiLang();
  const desc = (
    (b.description_i18n && (b.description_i18n[uiL] || b.description_i18n[uiL==="uk"?"ua":uiL])) ||
    (uiL==="uk" ? (b.description_ua || b.description_uk) : (uiL==="ru" ? b.description_ru : b.description_en)) ||
    b.description_en || b.description || ""
  ).trim();
  const descHtml = desc ? escapeHtml(desc).replace(/\n/g, "<br>") : "";

  const bookLang = b.sourceLang || state.reading.sourceLang || "en";
  state.reading.sourceLang = bookLang;

  app.innerHTML = `
<div class="wrap">
  <div class="detailsWrap">
    <div class="detailsTop">
      <button class="iconBtn" id="detailsBack" title="Back">‹</button>
      <button class="iconBtn" id="detailsChapters" title="Chapters">≡</button>
      <button class="iconBtn" id="detailsBookmark" title="Bookmark">🔖</button>
    </div>

    <div class="detailsGrid">
      <div>
        <div class="detailsCover">
          ${b.cover ? `<img src="${escapeHtml(b.cover)}" alt="">` : ``}
        </div>
      </div>

      <div>
        <div>
          <h1 class="detailsTitle">${escapeHtml(getBookTitle(b) || "Book")}</h1>
          <p class="detailsMeta detailsMeta1">${escapeHtml(meta1)}</p>
          <p class="detailsMeta detailsMeta2">${escapeHtml(pkgLine)}</p>
          <div class="detailsDesc">${descHtml}</div>
        </div>

        <div class="formCard">
          <div class="formRow">
            <div class="label">${I18n.t("details_level")}</div>
            <button class="pillBtn" id="detailsLevelBtn"><span id="detailsLevelLabel">${escapeHtml(I18n.t("level_original"))}</span> <span style="opacity:.6;">▾</span><select id="dLevel" class="selOverlay"></select></button>
          </div>
          <div class="formRow">
            <div class="label">${I18n.t("details_book_lang")}</div>
            <button class="pillBtn" id="detailsBookLangBtn"><span id="detailsBookFlag">🇬🇧</span><span id="detailsBookLangLabel">English</span> <span style="opacity:.6;">▾</span><select id="dSourceLang" class="selOverlay"></select></button>
          </div>
          <div class="formRow">
            <div class="label">${I18n.t("details_trans_lang")}</div>
            <button class="pillBtn" id="detailsTransLangBtn"><span id="detailsTransFlag">UA</span><span id="detailsTransLangLabel">Ukrainian</span> <span style="opacity:.6;">▾</span><select id="dTargetLang" class="selOverlay"></select></button>
          </div>
        </div>

        <div class="bigActions">
          <button class="bigBtn" id="btnRead">≡ ${I18n.t("details_btn_read")}</button>
          <button class="bigBtn secondary" id="btnListen">🎧 ${I18n.t("details_btn_listen")}</button>
        </div>
      </div>
    </div>
  </div>
</div>
`;

  document.getElementById("detailsBack").onclick = ()=>go({name:"catalog"},{push:false});
  document.getElementById("detailsBookmark").onclick = ()=>showBookBookmarksSheet((state.route && state.route.bookId) || state.book?.id || state.route?.bookId);
  const __dch = document.getElementById("detailsChapters");
  if(__dch){
    __dch.addEventListener("click", (e)=>{ try{ e.preventDefault(); e.stopPropagation(); }catch(_){} try{ openChapters(); }catch(err){} });
  }

  const src = document.getElementById("dSourceLang");
  const trg = document.getElementById("dTargetLang");
  const lvl = document.getElementById("dLevel");

  Config.SOURCE_LANGS.forEach(l=>{
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.textContent = Config.flagFor(l.code) + " " + l.label;
    src.appendChild(opt);
  });
  Config.TARGET_LANGS.forEach(l=>{
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.textContent = Config.flagFor(l.code) + " " + l.label;
    trg.appendChild(opt);
  });
  Config.LEVELS.forEach(l=>{
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.textContent = (String(l.code).toLowerCase()==='original') ? I18n.t('level_original') : l.label;
    lvl.appendChild(opt);
  });

  src.value = state.reading.sourceLang || "en";
  trg.value = state.reading.targetLang || "uk";
  state.reading.level = Config.normalizeLevel(state.reading.level || "original");
  lvl.value = state.reading.level;

  const bookLabel = document.getElementById("detailsBookLangLabel");
  const transLabel = document.getElementById("detailsTransLangLabel");
  const levelLabel = document.getElementById("detailsLevelLabel");
  const bookFlag = document.getElementById("detailsBookFlag");
  const transFlag = document.getElementById("detailsTransFlag");
  function setLabels(){
    const sOpt = Config.SOURCE_LANGS.find(x=>x.code===src.value);
    const tOpt = Config.TARGET_LANGS.find(x=>x.code===trg.value);
    if(bookLabel && sOpt) bookLabel.textContent = sOpt.label;
    if(transLabel && tOpt) transLabel.textContent = tOpt.label;
    if(levelLabel) levelLabel.textContent = Config.formatLevelLabel(lvl.value);
    if(bookFlag) bookFlag.textContent = Config.flagFor(src.value);
    if(transFlag) transFlag.textContent = Config.flagFor(trg.value);
  }
  setLabels();

  src.onchange = ()=>{
    try{ stopReading({save:true}); }catch(e){}
    try{ saveReadingProgress(); }catch(e){}
    state.reading.sourceLang = src.value;
    try{ TranslateService.clearCache(); }catch(e){}
    setLabels();
    applyLanguagePairChange();
  };
  trg.onchange = ()=>{
    try{ stopReading({save:true}); }catch(e){}
    try{ saveReadingProgress(); }catch(e){}
    state.reading.targetLang = trg.value;
    try{ TranslateService.clearCache(); }catch(e){}
    setLabels();
    applyLanguagePairChange();
  };
  lvl.onchange = ()=>{
    try{ stopReading({save:true}); }catch(e){}
    try{ saveReadingProgress(); }catch(e){}
    state.reading.level = Config.normalizeLevel(lvl.value);
    setLabels();
    applyLanguagePairChange();
  };

  document.getElementById("btnListen").onclick = ()=>{ try{ stopReading({save:true}); }catch(e){} state.reading.mode="listen"; state.reading.sourceLang = src.value; state.reading.targetLang = trg.value; try{ restoreProgressForPair(b.id, src.value, trg.value, state.reading.level); }catch(e){} go({name:"reader", bookId: b.id},{push:false}); };
  document.getElementById("btnRead").onclick = ()=>{ try{ stopReading({save:true}); }catch(e){} state.reading.mode="read"; state.reading.sourceLang = src.value; state.reading.targetLang = trg.value; try{ restoreProgressForPair(b.id, src.value, trg.value, state.reading.level); }catch(e){} go({name:"bireader", bookId: b.id},{push:false}); };
}