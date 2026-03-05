/* ═══════════════════════════════════════════════════════════
   views/catalog.js  —  Экран «Каталог книг»
   ═══════════════════════════════════════════════════════════ */

const _SVG_SETTINGS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

/* Верхняя полоска */
function _appTopBar(){
  return '<div class="appTopBar" id="appTopBar">'
    + '<div class="appTopBarLeft" id="appTopBarLeft"></div>'
    + '<div class="appTopBarRight">'
    + '<button class="appTopBtn" id="appTopSettings" title="\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f">' + _SVG_SETTINGS + '</button>'
    + '</div></div>';
}

/* Глобальный scroll listener */
var _tabsScrollHandler = null;

function _disconnectTabsObserver(){
  if(_tabsScrollHandler){
    try{ window.removeEventListener('scroll', _tabsScrollHandler, true); }catch(e){}
    _tabsScrollHandler = null;
  }
}

/* Волшебство: большой заголовок плавно исчезает, маленький плавно появляется */
function _bindTabsScroll(isCatalog){
  _disconnectTabsObserver();

  var lastRaf = null;

  _tabsScrollHandler = function(){
    if(lastRaf) return;
    lastRaf = requestAnimationFrame(function(){
      lastRaf = null;

      // Если DOM уже перерисован — отключаемся
      var topBarLeft = document.getElementById('appTopBarLeft');
      var header = document.querySelector('.appHeader');
      if(!topBarLeft || !header){ _disconnectTabsObserver(); return; }

      var barH = document.getElementById('appTopBar')?.offsetHeight || 60;
      var headerRect = header.getBoundingClientRect();

      // Позиция заголовка: 0 = только дошёл до полоски, 1 = полностью за полоской
      // fadeZone: зона исчезновения/появления = 40px
      var fadeZone = 40;
      // Большой заголовок исчезает когда его нижний край уходит за barH
      var headerBottom = headerRect.bottom; // нижний край .appHeader
      // progress: 0 = виден (headerBottom > barH + fadeZone), 1 = скрыт (headerBottom < barH)
      var progress = 1 - Math.max(0, Math.min(1, (headerBottom - barH) / fadeZone));

      // Большой заголовок: исчезает
      header.style.opacity = 1 - progress;
      header.style.transform = 'translateY(' + (-progress * 8) + 'px)';

      // Маленький в топбаре: появляется
      var clone = document.getElementById('appTopTabsClone');
      if(progress > 0.05){
        if(!clone){
          topBarLeft.innerHTML = '<div class="appTopTabs" id="appTopTabsClone" style="opacity:0;transform:translateY(6px);transition:opacity .18s,transform .18s">'
            + '<button class="tab ' + (isCatalog ? '' : 'muted') + '" id="topTabBooks">' + I18n.t('tabs_books') + '</button>'
            + '<button class="tab ' + (isCatalog ? 'muted' : '') + '" id="topTabLibrary">' + I18n.t('tabs_library') + '</button>'
            + '</div>';
          var tb = document.getElementById('topTabBooks');
          var tl = document.getElementById('topTabLibrary');
          if(tb) tb.addEventListener('click', function(e){ e.stopPropagation(); go({name:'catalog'},{push:false}); });
          if(tl) tl.addEventListener('click', function(e){ e.stopPropagation(); go({name:'library'},{push:false}); });
          clone = document.getElementById('appTopTabsClone');
          // С задержкой чтоб CSS transition сработал
          requestAnimationFrame(function(){
            if(clone){ clone.style.opacity = ''; clone.style.transform = ''; }
          });
        }
        if(clone){
          clone.style.opacity = String(Math.min(1, (progress - 0.05) / 0.5));
        }
      } else {
        if(clone){
          clone.style.opacity = '0';
          clone.style.transform = 'translateY(6px)';
          // Удаляем после транзиции
          var _clone = clone;
          setTimeout(function(){ if(_clone.parentNode) _clone.parentNode.innerHTML = ''; }, 200);
        }
      }
    });
  };

  window.addEventListener('scroll', _tabsScrollHandler, { passive: true, capture: true });
  // Сразу вызываем для корректного начального состояния
  _tabsScrollHandler();
}

function renderCatalog(){
  _disconnectTabsObserver();

  const groups = {};
  state.catalog.forEach(b=>{
    const g = (b.series || "Books").trim();
    (groups[g] ||= []).push(b);
  });
  const groupNames = Object.keys(groups);

  let cont = null, contPct = 0;
  try{
    const g = ProgressManager.getGlobalLastInteraction();
    if(g && g.bookId){
      cont = state.catalog.find(b=>b.id===g.bookId) || null;
      if(cont){
        const lp = ProgressManager.getPkgProgress(cont.id, g.sourceLang, g.targetLang, g.level||'original');
        if(lp && typeof lp.progress==='number') contPct = Number(lp.progress||0);
      }
    }
    if(!cont){
      for(const b of state.catalog){
        const pkgs = ProgressManager.listPkgProgress(b.id);
        if(pkgs && pkgs.length){
          const latest = pkgs[0], ts = Number(latest.ts||0);
          const bestTs = cont ? Number((ProgressManager.listPkgProgress(cont.id)[0]||{}).ts||0) : -1;
          if(!cont || ts > bestTs){ cont = b; contPct = Number(latest.progress||0); }
        }else{
          const r = JSON.parse(sessionStorage.getItem(ProgressManager.progressKey(b.id,'reader'))||"null");
          const br= JSON.parse(sessionStorage.getItem(ProgressManager.progressKey(b.id,'bireader'))||"null");
          const p = Math.max(r?.progress||0, br?.progress||0);
          if(p > contPct){ contPct = p; cont = b; }
        }
      }
    }
  }catch(e){}

  let contShowPct=contPct, contShowLabel='', contLevelLabel='', contMeta1='', contMeta2='';
  if(cont){
    const _series = String((cont.series||"")||'').trim()||'NEW';
    const _author = String((cont.author||"")||'').trim();
    contMeta1 = [_author,_series].filter(Boolean).join(' \u2022 ')||_series;
    let last=null;
    try{ last=ProgressManager.getLastPkg(cont.id); }catch(e){}
    const fallbackLabel=(()=>{
      try{
        if(last&&last.sourceLang&&last.targetLang){
          const m=(last.mode&&String(last.mode).toLowerCase()==='listen')?I18n.t('mode_listen'):I18n.t('mode_read');
          return flagEmoji(last.sourceLang)+' '+String(last.sourceLang).toUpperCase()+'\u2192'+flagEmoji(last.targetLang)+' '+String(last.targetLang).toUpperCase()+' ('+m+')';
        }
      }catch(e){}
      return '';
    })();
    if(last){
      if(last.level) contLevelLabel=String(last.level);
      try{ contShowLabel=Config.formatPkgLabel(last.sourceLang,last.targetLang,last.mode); }catch(e){}
      try{
        const lp=ProgressManager.getPkgProgress(cont.id,last.sourceLang,last.targetLang,last.level||'original');
        if(lp&&typeof lp.progress==='number') contShowPct=Number(lp.progress||0);
      }catch(e){}
    }
    const pctTxt=Math.round(contShowPct)+'%';
    const labelTxt=contShowLabel||fallbackLabel;
    const lvlTxt=Config.formatLevelLabel(contLevelLabel||'original');
    contMeta2=labelTxt?lvlTxt+' \u2022 '+labelTxt+' \u2022 '+pctTxt:lvlTxt+' \u2022 '+pctTxt;
  }

  const continueHtml = cont ? (
    '<div class="sectionLabel">'+I18n.t('continue_reading')+'</div>'
    +'<div class="cardWide" id="continueCard" role="button" tabindex="0">'
    +'<div class="coverImg">'+(cont.cover?'<img src="'+escapeHtml(cont.cover)+'" alt="">':'')+'</div>'
    +'<div class="info"><p class="title">'+escapeHtml(getBookTitle(cont)||'Book')+'</p>'
    +'<p class="meta meta1">'+escapeHtml(contMeta1)+'</p>'
    +'<p class="meta meta2">'+escapeHtml(contMeta2)+'</p></div>'
    +'<div class="circle" style="--p:'+Math.round(contShowPct)+'%"><div class="inner">'+Math.round(contShowPct)+'%</div></div>'
    +'</div>'
  ) : '';

  const groupsHtml = groupNames.map(g=>{
    const items = groups[g].slice(0,10);
    return '<div class="groupCard">'
      +'<div class="groupTitleRow"><h3 class="groupTitle">'+escapeHtml(I18n.tGenre(g))+'</h3>'
      +'<button class="chevBtn" data-group="'+escapeHtml(g)+'">\u203a</button></div>'
      +'<div class="hScroll">'
      +items.map(b=>'<div class="bookTile" data-open="'+escapeHtml(b.id)+'">'
        +'<div class="tileCover">'+(b.cover?'<img src="'+escapeHtml(b.cover)+'" alt="">':'')+'</div>'
        +'<div class="tileMeta"><p class="tileTitle">'+escapeHtml(getBookTitle(b)||'Book')+'</p>'
        +'<p class="tileSub">'+escapeHtml(formatMetaAuthorSeries(b))+'</p></div></div>').join('')
      +'</div></div>';
  }).join('');

  app.innerHTML = `
    <div class="wrap homeScreen">
      ${_appTopBar()}
      <div class="appHeader">
        <button class="tab" id="tabBooks">${I18n.t("tabs_books")}</button>
        <button class="tab muted" id="tabLibrary">${I18n.t("tabs_library")}</button>
      </div>
      ${continueHtml}
      ${groupsHtml}
    </div>
  `;

  document.getElementById('tabBooks').onclick   = ()=>go({name:'catalog'},{push:false});
  document.getElementById('tabLibrary').onclick = ()=>go({name:'library'},{push:false});
  const __ats = document.getElementById('appTopSettings');
  if(__ats) __ats.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); try{ openSettings(); }catch(err){} });

  _bindTabsScroll(true);

  if(cont){
    const openCont = ()=>{
      try{
        const last=ProgressManager.getGlobalLastInteraction();
        const bid=cont.id;
        if(last&&String(last.bookId||'')===String(bid||'')){
          state.reading.sourceLang=last.sourceLang||state.reading.sourceLang;
          state.reading.targetLang=last.targetLang||state.reading.targetLang;
          const pkg=ProgressManager.getPkgProgress(bid,state.reading.sourceLang,state.reading.targetLang,last.level||'original');
          const idx=pkg&&typeof pkg.activeIndex==='number'?Number(pkg.activeIndex||0):0;
          if(String(last.mode||'')==='read') go({name:'bireader',bookId:bid,level:last.level||'original',sourceLang:last.sourceLang,targetLang:last.targetLang,startIndex:idx});
          else go({name:'reader',bookId:bid,level:last.level||'original',sourceLang:last.sourceLang,targetLang:last.targetLang,startIndex:idx});
          return;
        }
      }catch(e){}
      go({name:'details',bookId:cont.id});
    };
    const cc=document.getElementById('continueCard');
    if(cc){ cc.onclick=openCont; cc.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openCont(); } }; }
  }

  app.querySelectorAll('[data-open]').forEach(el=>{
    el.addEventListener('click',()=>go({name:'details',bookId:el.dataset.open}));
  });
  app.querySelectorAll('[data-group]').forEach(el=>{
    el.addEventListener('click',()=>alert('\u0424\u0456\u043b\u044c\u0442\u0440\u0438 \u043f\u043e \u0436\u0430\u043d\u0440\u0443 \u043c\u043e\u0436\u043d\u0430 \u0434\u043e\u0434\u0430\u0442\u0438 \u043f\u0456\u0437\u043d\u0456\u0448\u0435.'));
  });
}
