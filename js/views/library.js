/* ═══════════════════════════════════════════════════════════
   views/library.js  —  Екран «Моя Бібліотека»
   ═══════════════════════════════════════════════════════════ */

/* SVG icons for bookmark actions — matching the app design system */
const _SVG_BM_SPEAK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
const _SVG_BM_GO    = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
const _SVG_BM_DEL   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function renderLibrary(){
  if(typeof _disconnectTabsObserver === 'function') _disconnectTabsObserver();

  const tab = state.ui?.libraryTab || "progress";

  const hasBookmarks = (bookId)=>{
    try{
      const k = "bm:" + bookId;
      const s = localStorage.getItem(k) || sessionStorage.getItem(k);
      if(!s) return false;
      return Array.isArray(JSON.parse(s)) && JSON.parse(s).length>0;
    }catch(e){ return false; }
  };

  const rows = state.catalog.map(b=>{
    let mainP=0, maxP=0, pkgs=[];
    try{
      pkgs = ProgressManager.listPkgProgress(b.id);
      if(pkgs && pkgs.length){
        maxP = Math.max(...pkgs.map(x=>Number(x.progress||0)));
        const last = ProgressManager.getLastPkg(b.id);
        if(last){
          const lp = ProgressManager.getPkgProgress(b.id,last.sourceLang,last.targetLang,Config.normalizeLevel(last.level||"original"));
          mainP = (lp&&typeof lp.progress==="number") ? Number(lp.progress||0) : Number(maxP||0);
        }else{ mainP=Number(maxP||0); }
      }
    }catch(e){}
    if(!pkgs||!pkgs.length){
      let r=null,br=null;
      try{
        r =JSON.parse(sessionStorage.getItem(ProgressManager.progressKey(b.id,'reader')) ||"null");
        br=JSON.parse(sessionStorage.getItem(ProgressManager.progressKey(b.id,'bireader'))||"null");
      }catch(e){}
      maxP=Math.max(Number(r?.progress||0),Number(br?.progress||0)); mainP=maxP;
    }
    let chips=[];
    try{
      const last=ProgressManager.getLastPkg(b.id);
      if(last){
        const lv=Config.normalizeLevel(last.level||"original");
        const lp=ProgressManager.getPkgProgress(b.id,last.sourceLang,last.targetLang,lv);
        if(lp&&typeof lp.progress==="number"){
          chips.push({sourceLang:String(last.sourceLang||"").toLowerCase(),targetLang:String(last.targetLang||"").toLowerCase(),
            mode:String(last.mode||"read").toLowerCase(),level:lv,progress:Number(lp.progress||0),ts:Number(last.ts||lp.ts||0),isResume:true});
        }
      }
    }catch(e){}
    try{
      for(const o of (pkgs||[])){
        if(chips.length>=3) break;
        const s=String(o.sourceLang||"").toLowerCase(),t=String(o.targetLang||"").toLowerCase();
        const lv=Config.normalizeLevel(o.level||"original"),m=String(o.mode||"read").toLowerCase();
        if(chips.some(c=>c.sourceLang===s&&c.targetLang===t&&Config.normalizeLevel(c.level||"original")===lv&&String(c.mode||"read").toLowerCase()===m)) continue;
        chips.push(o);
      }
    }catch(e){}
    const lastTs=chips.length?Number(chips[0].ts||0):((pkgs&&pkgs.length)?Number(pkgs[0].ts||0):0);
    return {b,p:mainP,maxP,lastTs,pkgs:chips};
  }).filter(x=>x.p>0||tab==="finished");

  const inProgress=rows.filter(x=>x.maxP>0&&x.maxP<99.5).sort((a,b)=>(Number(b.lastTs||0)-Number(a.lastTs||0))||(b.maxP-a.maxP));
  const finished  =rows.filter(x=>x.maxP>=99.5).sort((a,b)=>(Number(b.lastTs||0)-Number(a.lastTs||0))||(b.maxP-a.maxP));
  let list=(tab==="finished"?finished:inProgress);
  if(tab==="bookmarks") list=rows.filter(({b})=>hasBookmarks(b.id)).sort((a,b)=>(Number(b.lastTs||0)-Number(a.lastTs||0))||(b.p-a.p));

  let bookmarksGroups=[];
  if(tab==="bookmarks") bookmarksGroups=list.map(({b})=>({b,items:BookmarkManager.load(b.id)})).filter(g=>g.items&&g.items.length);

  function buildBookmarksHtml(){
    if(!bookmarksGroups.length) return '<div style="color:rgba(0,0,0,.45);font-weight:800;padding:18px 4px;">No bookmarks yet.</div>';
    return bookmarksGroups.map(function(grp){
      const b=grp.b,items=grp.items;
      const coverHtml=b.cover?'<img src="'+escapeHtml(b.cover)+'" alt="">':'';
      const authorSeries=[String((b.author||'')||'').trim(),String((b.series||'')||'').trim()].filter(Boolean).join(' \u2022 ');
      const metaHtml=authorSeries?'<p class="bmMeta">'+escapeHtml(authorSeries)+'</p>':'';
      const backBtn=(tab==="bookmarks"&&state.ui&&state.ui.backToBook&&state.ui.backToBook.bookId===b.id)
        ? ' <button class="bmBackMini inline" id="backToBookBtn">\u21a9\ufe0e '+I18n.t("btn_back")+'</button>'
        : '';
      const groups=[],keyMap=new Map();
      (items||[]).forEach(function(it){
        const key=String(it.level||'original')+'|'+String(it.sourceLang||'en')+'|'+String(it.targetLang||'uk')+'|'+String(it.mode||'read');
        if(!keyMap.has(key)){const g={key,level:String(it.level||'original'),src:String(it.sourceLang||'en'),trg:String(it.targetLang||'uk'),mode:String(it.mode||'read'),items:[]};keyMap.set(key,g);groups.push(g);}
        keyMap.get(key).items.push(it);
      });
      try{
        const last=state.ui&&state.ui.lastBmCtx;
        const prefKey=(last&&String(last.bookId)===String(b.id))?(String(last.level||'original')+'|'+String(last.sourceLang||'en')+'|'+String(last.targetLang||'uk')+'|'+String(last.mode||'read')):'';
        groups.forEach(function(g){try{g._ts=Math.max.apply(null,(g.items||[]).map(function(x){return Number(x.createdAt||0);}));}catch(e){g._ts=0;}});
        groups.sort(function(a,b2){const ap=(prefKey&&a.key===prefKey)?1:0,bp=(prefKey&&b2.key===prefKey)?1:0;if(ap!==bp)return bp-ap;return Number(b2._ts||0)-Number(a._ts||0);});
      }catch(e){}
      const groupsHtml=groups.map(function(g){
        const resumeKey=escapeHtml(b.id)+'|'+escapeHtml(String(g.level||'original'))+'|'+escapeHtml(String(g.src||'en'))+'|'+escapeHtml(String(g.trg||'uk'))+'|'+escapeHtml(String(g.mode||'read'));
        const itemsHtml=g.items.map(function(it,idx){
          const bId=escapeHtml(b.id),iId=escapeHtml(it.id);
          const trHtml=(it.tr&&it.raw&&it.tr!==it.raw)?'<p class="bmTr">'+escapeHtml(it.tr)+'</p>':'';
          return '<div class="bmItem" data-bm-item><div class="bmMain"><p class="bmLabel">#'+(idx+1)+'</p><p class="bmRaw">'+escapeHtml(it.raw||it.tr||'')+'</p>'+trHtml+'</div>'
            +'<div class="bmBtns">'
            +'<button class="bmBtn" data-bm-play="'+bId+'::'+iId+'">'+_SVG_BM_SPEAK+'</button>'
            +'<button class="bmBtn primary" data-bm-go="'+bId+'::'+iId+'">'+_SVG_BM_GO+'</button>'
            +'<button class="bmBtn" data-bm-del="'+bId+'::'+iId+'">'+_SVG_BM_DEL+'</button>'
            +'</div></div>';
        }).join('');
        return '<div class="bmGroupHdr" data-resume="'+resumeKey+'" role="button" tabindex="0">'
          +'<span class="bmLevel">'+escapeHtml(Config.formatLevelLabel(g.level))+'</span>'
          +'<span class="bmSep">\u2022</span>'
          +'<span class="bmPkg">'+escapeHtml(Config.formatPkgLabel(g.src,g.trg,g.mode))+'</span>'
          +'</div>'+itemsHtml;
      }).join('');
      return '<div class="bmBook"><div class="bmHead" data-open="'+escapeHtml(b.id)+'">'
        +'<div class="bmCover">'+coverHtml+'</div>'
        +'<div style="flex:1;min-width:0;"><div class="bmTitleRow"><p class="bmTitle">'+escapeHtml(getBookTitle(b)||'Book')+'</p>'+backBtn+'</div></div>'
        +metaHtml+'</div><div class="bmItems">'+groupsHtml+'</div></div>';
    }).join('');
  }

  function buildProgressHtml(){
    if(!list.length) return '<div style="color:rgba(0,0,0,.45);font-weight:800;padding:18px 4px;">No books yet.</div>';
    return list.map(function(row){
      const b=row.b,p=row.p,pkgs=row.pkgs;
      const coverHtml=b.cover?'<img src="'+escapeHtml(b.cover)+'" alt="">':'';
      let chipsHtml='';
      if(pkgs&&pkgs.length){
        chipsHtml='<div class="pkgRow">'+pkgs.map(function(x){
          const s=String(x.sourceLang||'').toLowerCase(),trg=String(x.targetLang||'').toLowerCase();
          const m=String(x.mode||'read').toLowerCase(),lv=Config.normalizeLevel(x.level||'original');
          const modeLabel=I18n.t(m==="listen"?"mode_listen":"mode_read");
          const pct=Math.round(Number(x.progress||0));
          const lvLabel=(lv==="original")?I18n.t("level_original"):String(lv).toUpperCase();
          const resumeKey=escapeHtml(b.id)+'|'+escapeHtml(lv)+'|'+escapeHtml(s)+'|'+escapeHtml(trg)+'|'+escapeHtml(m);
          return '<span class="pkgChip '+(x.isResume?'resume':'')+'" data-resume="'+resumeKey+'" role="button" tabindex="0">'
            +'<span class="lvl">'+lvLabel+'</span><span class="sep">\u2022</span> '
            +Config.flagFor(s)+' '+s.toUpperCase()+' <span class="arrow">\u2192</span> '+Config.flagFor(trg)+' '+trg.toUpperCase()
            +' <span class="sep">\u2022</span> <span class="mode">'+modeLabel+'</span>'
            +' <span class="sep">\u2022</span> <span class="pct">'+pct+'%</span></span>';
        }).join('')+'</div>';
      }
      return '<div class="libraryItem" data-open="'+escapeHtml(b.id)+'">'
        +'<div class="coverImg">'+coverHtml+'</div>'
        +'<div style="flex:1;min-width:0;"><p class="title">'+escapeHtml(getBookTitle(b)||'Book')+'</p>'
        +'<p class="meta">'+escapeHtml(formatMetaAuthorSeries(b))+'</p>'+chipsHtml+'</div>'
        +'<div class="circle" style="--p:'+Math.round(p)+'%"><div class="inner">'+Math.round(p)+'%</div></div></div>';
    }).join('');
  }

  app.innerHTML = `
    <div class="wrap">
      ${_appTopBar(false)}
      <div style="padding:12px 18px 8px 18px;">
        <div class="segmented">
          <button class="libSegBtn ${tab==="progress"?"active":""}" id="libInProgress">${I18n.t("lib_in_progress")}</button>
          <button class="libSegBtn ${tab==="finished"?"active":""}" id="libFinished">${I18n.t("lib_finished")}</button>
          <button class="libSegBtn ${tab==="bookmarks"?"active":""}" id="libBookmarks">${I18n.t("lib_bookmarks")}</button>
        </div>
      </div>
      <div class="libraryList">
        ${tab==="bookmarks" ? buildBookmarksHtml() : buildProgressHtml()}
      </div>
    </div>
  `;

  _bindTopBarBtns();

  document.getElementById('libInProgress').onclick = ()=>{ state.ui=state.ui||{}; state.ui.libraryTab='progress';  renderLibrary(); };
  document.getElementById('libFinished').onclick   = ()=>{ state.ui=state.ui||{}; state.ui.libraryTab='finished';  renderLibrary(); };
  document.getElementById('libBookmarks').onclick  = ()=>{ state.ui=state.ui||{}; state.ui.libraryTab='bookmarks'; renderLibrary(); };

  if(typeof _bindTabsScroll === 'function') _bindTabsScroll(false);

  const __btb = document.getElementById('backToBookBtn');
  if(__btb){
    __btb.onclick=(e)=>{
      try{e.preventDefault();e.stopPropagation();}catch(_e){}
      const ctx=state.ui&&state.ui.backToBook;
      if(!ctx||!ctx.bookId) return;
      try{state.reading.level=ctx.level||state.reading.level||'original';}catch(e){}
      try{state.reading.sourceLang=ctx.src||state.reading.sourceLang||'en';}catch(e){}
      try{state.reading.targetLang=ctx.trg||state.reading.targetLang||'uk';}catch(e){}
      const routeName=(String(ctx.mode||'read')==='listen')?'reader':'bireader';
      try{delete state.ui.backToBook;}catch(e){}
      go({name:routeName,bookId:ctx.bookId},{push:false});
    };
  }

  app.querySelectorAll('.pkgChip[data-resume]').forEach(ch=>{
    const act=(e)=>{
      try{e.preventDefault();e.stopPropagation();}catch(_e){}
      const parts=String(ch.dataset.resume||'').split('|');
      if(parts.length<5) return;
      const [bookId,level,src,trg,mode]=parts;
      try{state.reading.level=level||'original';}catch(e){}
      try{state.reading.sourceLang=src||'en';}catch(e){}
      try{state.reading.targetLang=trg||'uk';}catch(e){}
      const routeName=(String(mode||'read')==='listen')?'reader':'bireader';
      let idx=0;
      try{const pkg=ProgressManager.getPkgProgress(bookId,src,trg,Config.normalizeLevel(level||'original'));if(pkg&&typeof pkg.activeIndex==='number') idx=Number(pkg.activeIndex||0);}catch(e){}
      go({name:routeName,bookId,level,sourceLang:src,targetLang:trg,startIndex:idx});
    };
    ch.addEventListener('click',act);
    ch.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){act(e);}});
  });

  if(tab==="bookmarks"){
    app.querySelectorAll('.bmGroupHdr[data-resume]').forEach(h=>{
      const act=(e)=>{
        try{e.preventDefault();e.stopPropagation();}catch(_e){}
        const parts=String(h.dataset.resume||'').split('|');
        if(parts.length<5) return;
        const [bookId,level,src,trg,mode]=parts;
        try{state.reading.level=level||'original';}catch(e){}
        try{state.reading.sourceLang=src||'en';}catch(e){}
        try{state.reading.targetLang=trg||'uk';}catch(e){}
        const routeName=(String(mode||'read')==='listen')?'reader':'bireader';
        let idx=0;
        try{const pkg=ProgressManager.getPkgProgress(bookId,src,trg,Config.normalizeLevel(level||'original'));if(pkg&&typeof pkg.activeIndex==='number') idx=Number(pkg.activeIndex||0);}catch(e){}
        go({name:routeName,bookId,level,sourceLang:src,targetLang:trg,startIndex:idx});
      };
      h.addEventListener('click',act);
      h.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){act(e);}});
    });
    app.querySelectorAll('[data-bm-play]').forEach(btn=>{
      btn.addEventListener('click',(e)=>{
        e.preventDefault();e.stopPropagation();
        const [bookId,entryId]=String(btn.dataset.bmPlay||'').split('::');
        const it=(BookmarkManager.load(bookId)||[]).find(x=>x&&x.id===entryId);
        if(it) playOneShotTTS(it.raw||it.tr||'');
      });
    });
    app.querySelectorAll('[data-bm-go]').forEach(btn=>{
      btn.addEventListener('click',(e)=>{
        e.preventDefault();e.stopPropagation();
        const [bookId,entryId]=String(btn.dataset.bmGo||'').split('::');
        const listAll=BookmarkManager.load(bookId);
        let filtered=listAll;
        try{
          const inReading=state.route&&(state.route.name==='reader'||state.route.name==='bireader');
          if(inReading){
            const lvl=String(_bmGetLevel()||'original'),pair=_bmGetLangPair(),md=String(_bmGetMode()||'read');
            filtered=(listAll||[]).filter(it=>{if(!it)return false;return String(it.level||'original')===lvl&&String(it.sourceLang||pair.src||'en')===String(pair.src||'en')&&String(it.targetLang||pair.trg||'uk')===String(pair.trg||'uk')&&String(it.mode||'read')===md;});
          }
        }catch(e){filtered=listAll;}
        const it=filtered.find(x=>x&&x.id===entryId);
        const idx=Number(it&&(it.paraIdx!=null?it.paraIdx:it.lineIndex)||0);
        const widx=(it&&Number.isFinite(it.wordIndex)&&it.wordIndex>=0)?Number(it.wordIndex):undefined;
        const bmMode=String((it&&it.mode)||'').toLowerCase();
        const routeName=(bmMode==='listen')?'reader':(bmMode==='read'?'bireader':(state.route&&state.route.name==='bireader'?'bireader':'reader'));
        try{
          const src2=String((it&&it.sourceLang)||state.reading.sourceLang||'en').trim().toLowerCase();
          const trg2=String((it&&it.targetLang)||state.reading.targetLang||'uk').trim().toLowerCase();
          const level2=Config.normalizeLevel((it&&it.level)||state.reading.level||'original');
          const prev=ProgressManager.getPkgProgress(bookId,src2,trg2,level2);
          const resumeIndex=Number.isFinite(prev&&prev.activeIndex)?Number(prev.activeIndex):0;
          state.ui=state.ui||{};
          state.ui.pendingBookmarkPlayChoice={bookId:String(bookId),bookmarkIndex:idx,resumeIndex,src:src2,trg:trg2,level:level2,createdAt:Date.now()};
          state.ui.lockProgressUntilChoice={bookId:String(bookId),src:src2,trg:trg2,level:level2,createdAt:Date.now()};
        }catch(_e){}
        go({name:routeName,bookId,startIndex:idx,forceStartIndex:true,startWordIndex:widx,autoPlay:false});
      });
    });
    app.querySelectorAll('[data-bm-del]').forEach(btn=>{
      btn.addEventListener('click',(e)=>{
        e.preventDefault();e.stopPropagation();
        const [bookId,entryId]=String(btn.dataset.bmDel||'').split('::');
        BookmarkManager.remove(bookId,entryId);
        renderLibrary();
      });
    });
  }

  app.querySelectorAll('[data-open]').forEach(el=>{
    el.addEventListener('click',()=>go({name:'details',bookId:el.dataset.open}));
  });
}
