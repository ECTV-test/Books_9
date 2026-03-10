/* ═══════════════════════════════════════════════════════════
   views/catalog.js  —  Екран «Каталог книг»
   ═══════════════════════════════════════════════════════════ */

const _SVG_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const _SVG_SUN  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

/* User menu SVG icon (person) */
const _SVG_USER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

/* Верхняя полоска — всегда содержит табы */
function _appTopBar(isCatalog){
  const isNight = !!(typeof state !== 'undefined' && state.reading && state.reading.night);
  const themeIcon = isNight ? _SVG_SUN : _SVG_MOON;
  return '<div class="appTopBar" id="appTopBar">'
    + '<div class="appTopBarLeft" id="appTopBarLeft">'
    + '<div class="appTopTabs" id="appTopTabsMain">'
    + '<button class="tab ' + (isCatalog ? '' : 'muted') + '" id="topTabBooks">' + I18n.t('tabs_books') + '</button>'
    + '<button class="tab ' + (isCatalog ? 'muted' : '') + '" id="topTabLibrary">' + I18n.t('tabs_library') + '</button>'
    + '</div>'
    + '</div>'
    + '<div class="appTopBarRight">'
    + '<button class="appTopBtn" id="appTopTheme" title="Toggle theme" aria-label="Toggle theme">' + themeIcon + '</button>'
    + '<button class="appTopBtn" id="appTopUser" title="User settings" aria-label="User settings">' + _SVG_USER + '</button>'
    + '</div></div>';
}

/* User menu dropdown — rendered into body, closed on outside click */
function _openUserMenu(anchorBtn){
  // Close if already open
  const existing = document.getElementById('userMenuDropdown');
  if(existing){ existing.remove(); return; }

  const lang = I18n.getUiLang();
  const langs = I18n.getAvailableLangs();
  const langLabels = { en: 'English', uk: 'Українська', ru: 'Русский' };

  // Font size helpers
  const curFontSize = (typeof state !== 'undefined' && state.reading) ? (state.reading.fontSize || 22) : 22;

  const langOptions = langs.map(l =>
    '<button class="umLangBtn' + (l === lang ? ' active' : '') + '" data-lang="' + l + '">' +
    (langLabels[l] || l.toUpperCase()) + '</button>'
  ).join('');

  const menu = document.createElement('div');
  menu.id = 'userMenuDropdown';
  menu.className = 'userMenuDropdown';
  menu.innerHTML =
    '<div class="umSection">'
    + '<div class="umLabel" id="umLangLabel">' + I18n.t('user_menu_lang') + '</div>'
    + '<div class="umLangRow">' + langOptions + '</div>'
    + '</div>'
    + '<div class="umDivider"></div>'
    + '<div class="umSection">'
    + '<div class="umLabel" id="umFontLabel">' + I18n.t('user_menu_font') + '</div>'
    + '<div class="umFontRow">'
    + '<button class="umFontBtn" id="umFontMinus" aria-label="Decrease font">A−</button>'
    + '<span class="umFontVal" id="umFontVal">' + curFontSize + 'px</span>'
    + '<button class="umFontBtn" id="umFontPlus" aria-label="Increase font">A+</button>'
    + '</div>'
    + '</div>';

  // Position below anchor button
  document.body.appendChild(menu);
  const rect = anchorBtn.getBoundingClientRect();
  const mw = 220;
  let left = Math.min(rect.right - mw, window.innerWidth - mw - 8);
  if(left < 8) left = 8;
  menu.style.top = (rect.bottom + 6) + 'px';
  menu.style.left = left + 'px';

  // Language buttons
  menu.querySelectorAll('.umLangBtn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const l = btn.dataset.lang;
      I18n.setUiLang(l);
      try{ applyUiLang(); }catch(err){}
      // re-render current screen so tabs/labels update
      try{
        const route = state.route && state.route.name;
        if(route === 'catalog') renderCatalog();
        else if(route === 'library') renderLibrary();
      }catch(err){}
      menu.remove();
    });
  });

  // Font size buttons
  function updateFontVal(){
    const el = document.getElementById('umFontVal');
    if(el && typeof state !== 'undefined') el.textContent = state.reading.fontSize + 'px';
  }
  const btnMinus = menu.querySelector('#umFontMinus');
  const btnPlus  = menu.querySelector('#umFontPlus');
  if(btnMinus) btnMinus.addEventListener('click', e => {
    e.stopPropagation();
    try{
      state.reading.fontSize = Math.max(16, state.reading.fontSize - 2);
      document.documentElement.style.setProperty('--fontSize', state.reading.fontSize + 'px');
      updateFontVal();
    }catch(err){}
  });
  if(btnPlus) btnPlus.addEventListener('click', e => {
    e.stopPropagation();
    try{
      state.reading.fontSize = Math.min(34, state.reading.fontSize + 2);
      document.documentElement.style.setProperty('--fontSize', state.reading.fontSize + 'px');
      updateFontVal();
    }catch(err){}
  });

  // Close on outside click
  function onOutside(e){
    if(!menu.contains(e.target) && e.target !== anchorBtn){
      menu.remove();
      document.removeEventListener('click', onOutside, true);
    }
  }
  setTimeout(() => document.addEventListener('click', onOutside, true), 10);
}

/* Update labels inside open user menu when language changes */
function _updateUserMenuLabels(){
  const menu = document.getElementById('userMenuDropdown');
  if(!menu) return;
  const lbl = menu.querySelector('#umLangLabel');
  if(lbl) lbl.textContent = I18n.t('user_menu_lang');
  const flbl = menu.querySelector('#umFontLabel');
  if(flbl) flbl.textContent = I18n.t('user_menu_font');
  const curLang = I18n.getUiLang();
  menu.querySelectorAll('.umLangBtn').forEach(b => b.classList.toggle('active', b.dataset.lang === curLang));
}

/* Глобальный scroll listener */
var _tabsScrollHandler = null;

function _disconnectTabsObserver(){
  if(_tabsScrollHandler){
    try{ window.removeEventListener('scroll', _tabsScrollHandler, true); }catch(e){}
    _tabsScrollHandler = null;
  }
}

function _bindTabsScroll(isCatalog){
  _disconnectTabsObserver();
  try{
    if(state.ui && state.ui.tabsCollapsed && state.ui.tabsSavedScrollY){
      var targetY = Number(state.ui.tabsSavedScrollY);
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          window.scrollTo(0, targetY);
        });
      });
    }
  }catch(e){}
}

function _bindTopBarBtns(){
  var _ttb = document.getElementById('topTabBooks');
  var _ttl = document.getElementById('topTabLibrary');
  if(_ttb) _ttb.addEventListener('click', function(e){
    e.stopPropagation();
    try{ state.ui = state.ui || {}; state.ui.tabsSavedScrollY = window.scrollY; }catch(e2){}
    go({name:'catalog'},{push:false});
  });
  if(_ttl) _ttl.addEventListener('click', function(e){
    e.stopPropagation();
    try{ state.ui = state.ui || {}; state.ui.tabsSavedScrollY = window.scrollY; }catch(e2){}
    go({name:'library'},{push:false});
  });

  const __att = document.getElementById('appTopTheme');
  if(__att) __att.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    try{
      state.reading.night = !state.reading.night;
      const tN = document.getElementById('tNight');
      if(tN){ tN.classList.toggle('on', state.reading.night); }
      setTheme(state.reading.night);
      applyHighlightTheme();
      __att.innerHTML = state.reading.night ? _SVG_SUN : _SVG_MOON;
    }catch(err){}
  });

  const __atu = document.getElementById('appTopUser');
  if(__atu) __atu.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    _openUserMenu(__atu);
  });
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
      +'<button class="chevBtn" data-group="'+escapeHtml(g)+'">&rsaquo;</button></div>'
      +'<div class="hScroll">'
      +items.map(b=>'<div class="bookTile" data-open="'+escapeHtml(b.id)+'">'
        +'<div class="tileCover">'+(b.cover?'<img src="'+escapeHtml(b.cover)+'" alt="">':'')+'</div>'
        +'<div class="tileMeta"><p class="tileTitle">'+escapeHtml(getBookTitle(b)||'Book')+'</p>'
        +'<p class="tileSub">'+escapeHtml(formatMetaAuthorSeries(b))+'</p></div></div>').join('')
      +'</div></div>';
  }).join('');

  app.innerHTML = `
    <div class="wrap homeScreen">
      ${_appTopBar(true)}
      ${continueHtml}
      ${groupsHtml}
    </div>
  `;

  _bindTopBarBtns();
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
    el.addEventListener('click',()=>alert('Genre filter coming soon.'));
  });
}
