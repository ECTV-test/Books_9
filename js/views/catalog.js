/* ═══════════════════════════════════════════════════════════════
   views/catalog.js  —  Экран «Каталог книг» (главная)
   ═══════════════════════════════════════════════════════════════ */

/* Верхняя полоска — одинаковая для каталога и библиотеки */
function _appTopBar(){
  return `
    <div class="appTopBar">
      <div class="appTopBarLeft"></div>
      <div class="appTopBarRight">
        <button class="appTopBtn" id="appTopSettings" title="Налаштування">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>`;
}

function renderCatalog(){
  const groups = {};
  state.catalog.forEach(b=>{
    const g = (b.series || "Books").trim();
    (groups[g] ||= []).push(b);
  });
  const groupNames = Object.keys(groups);

  let cont = null;
  let contPct = 0;
  try{
    const g = ProgressManager.getGlobalLastInteraction();
    if(g && g.bookId){
      cont = state.catalog.find(b=>b.id===g.bookId) || null;
      if(cont){
        const lp = ProgressManager.getPkgProgress(cont.id, g.sourceLang, g.targetLang, g.level||'original');
        if(lp && typeof lp.progress === 'number') contPct = Number(lp.progress||0);
      }
    }
    if(!cont){
      for(const b of state.catalog){
        const pkgs = ProgressManager.listPkgProgress(b.id);
        if(pkgs && pkgs.length){
          const latest = pkgs[0];
          const ts = Number(latest.ts||0);
          const bestTs = cont ? Number((ProgressManager.listPkgProgress(cont.id)[0]||{}).ts||0) : -1;
          if(!cont || ts > bestTs){ cont = b; contPct = Number(latest.progress||0); }
        }else{
          const r = JSON.parse(sessionStorage.getItem(ProgressManager.progressKey(b.id,'reader') ) || "null");
          const br = JSON.parse(sessionStorage.getItem(ProgressManager.progressKey(b.id,'bireader')) || "null");
          const p = Math.max(r?.progress||0, br?.progress||0);
          if(p > contPct){ contPct = p; cont = b; }
        }
      }
    }
  }catch(e){}

  let contShowPct = contPct;
  let contShowLabel = "";
  let contLevelLabel = I18n.t("level_original");
  let contMeta1 = "";
  let contMeta2 = "";

  if(cont){
    const _series = String((cont.series||"")||"").trim() || "NEW";
    const _author = String((cont.author||"")||"").trim();
    contMeta1 = [_author, _series].filter(Boolean).join(" • ") || _series;
    contMeta2 = "";
    let last = null;
    try{ last = ProgressManager.getLastPkg(cont.id); }catch(e){ last = null; }
    const fallbackLabel = (()=>{
      try{
        if(last && last.sourceLang && last.targetLang){
          const modeTxt = (last.mode && String(last.mode).toLowerCase()==="listen") ? I18n.t("mode_listen") : I18n.t("mode_read");
          return `${flagEmoji(last.sourceLang)} ${String(last.sourceLang).toUpperCase()}→${flagEmoji(last.targetLang)} ${String(last.targetLang).toUpperCase()} (${modeTxt})`;
        }
      }catch(e){}
      return "";
    })();
    if(last){
      if(last.level) contLevelLabel = String(last.level);
      try{ contShowLabel = Config.formatPkgLabel(last.sourceLang, last.targetLang, last.mode); }catch(e){}
      try{
        let lp = ProgressManager.getPkgProgress(cont.id, last.sourceLang, last.targetLang, last.level||'original');
        if(lp && typeof lp.progress === "number") contShowPct = Number(lp.progress||0);
      }catch(e){}
    }
    const pctTxt = `${Math.round(contShowPct)}%`;
    const labelTxt = contShowLabel || fallbackLabel;
    const lvlTxt = Config.formatLevelLabel(contLevelLabel || "original");
    contMeta2 = labelTxt ? `${lvlTxt} • ${labelTxt} • ${pctTxt}` : `${lvlTxt} • ${pctTxt}`;
  }

  app.innerHTML = `
    <div class="wrap homeScreen">
      ${_appTopBar()}
      <div class="appHeader">
        <button class="tab" id="tabBooks">${I18n.t("tabs_books")}</button>
        <button class="tab muted" id="tabLibrary">${I18n.t("tabs_library")}</button>
      </div>

      ${cont ? `
        <div class="sectionLabel">${I18n.t("continue_reading")}</div>
        <div class="cardWide" id="continueCard" role="button" tabindex="0">
          <div class="coverImg">${cont.cover ? `<img src="${escapeHtml(cont.cover)}" alt="">` : ``}</div>
          <div class="info">
            <p class="title">${escapeHtml(getBookTitle(cont) || "Book")}</p>
            <p class="meta meta1">${escapeHtml((typeof contMeta1!=='undefined')?contMeta1:'')}</p>
            <p class="meta meta2">${escapeHtml((typeof contMeta2!=='undefined')?contMeta2:'')}</p>
          </div>
          <div class="circle" style="--p:${Math.round(contShowPct)}%">
            <div class="inner">${Math.round(contShowPct)}%</div>
          </div>
        </div>
      ` : ``}

      ${groupNames.map(g=>{
        const items = groups[g].slice(0, 10);
        return `
          <div class="groupCard">
            <div class="groupTitleRow">
              <h3 class="groupTitle">${escapeHtml(I18n.tGenre(g))}</h3>
              <button class="chevBtn" data-group="${escapeHtml(g)}">›</button>
            </div>
            <div class="hScroll">
              ${items.map(b=>`
                <div class="bookTile" data-open="${escapeHtml(b.id)}">
                  <div class="tileCover">
                    ${b.cover ? `<img src="${escapeHtml(b.cover)}" alt="">` : ``}
                  </div>
                  <div class="tileMeta">
                    <p class="tileTitle">${escapeHtml(getBookTitle(b) || "Book")}</p>
                    <p class="tileSub">${escapeHtml(formatMetaAuthorSeries(b))}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  document.getElementById("tabBooks").onclick = ()=>go({name:"catalog"}, {push:false});
  document.getElementById("tabLibrary").onclick = ()=>go({name:"library"}, {push:false});
  const __ats = document.getElementById("appTopSettings");
  if(__ats) __ats.onclick = ()=>{ try{ openSettings(); }catch(e){} };

  if(cont){
    const openCont = ()=>{
      try{
        const last = ProgressManager.getGlobalLastInteraction();
        const bid = cont.id;
        if(last && String(last.bookId||"")===String(bid||"")){
          state.reading.sourceLang = last.sourceLang || state.reading.sourceLang;
          state.reading.targetLang = last.targetLang || state.reading.targetLang;
          const pkg = ProgressManager.getPkgProgress(bid, state.reading.sourceLang, state.reading.targetLang, last.level||'original');
          const idx = pkg && typeof pkg.activeIndex==="number" ? Number(pkg.activeIndex||0) : 0;
          if(String(last.mode||"")==="read"){
            go({name:"bireader", bookId: bid, level: last.level||'original', sourceLang: last.sourceLang, targetLang: last.targetLang, startIndex: idx});
          }else{
            go({name:"reader", bookId: bid, level: last.level||'original', sourceLang: last.sourceLang, targetLang: last.targetLang, startIndex: idx});
          }
          return;
        }
      }catch(e){}
      go({name:"details", bookId: cont.id});
    };
    const cc = document.getElementById("continueCard");
    cc.onclick = openCont;
    cc.onkeydown = (e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openCont(); } };
  }

  app.querySelectorAll("[data-open]").forEach(el=>{
    el.addEventListener("click", ()=>go({name:"details", bookId: el.dataset.open}));
  });
  app.querySelectorAll("[data-group]").forEach(el=>{
    el.addEventListener("click", ()=>alert("Фільтри/пошук по жанру можна додати пізніше."));
  });

  // Enrich continue card meta if author missing
  try{
    if(cont && (!cont.author || !String(cont.author).trim())){
      const meta1El = document.querySelector("#continueCard .meta1");
      const cur = meta1El ? meta1El.textContent.trim() : "";
      if(meta1El && cur && (!cur.includes("•"))){
        fetch(`books/${cont.id}/book.json`).then(r=>r.ok?r.json():null).then(j=>{
          if(!j) return;
          const _series = String((j.series||cont.series||"")||"").trim() || "NEW";
          const _author = String((j.author||"")||"").trim();
          const txt = [_author,_series].filter(Boolean).join(" • ") || _series;
          meta1El.textContent = txt;
        }).catch(()=>{});
      }
    }
  }catch(e){}
}
