/* ═══════════════════════════════════════════════════════════
   views/catalog.js  —  Екран «Каталог книг»
   ═══════════════════════════════════════════════════════════ */

const _SVG_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const _SVG_SUN  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

/* User menu SVG icon (person) */
const _SVG_USER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
const _SVG_LOGO = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';

/* Safe i18n helper — returns fallback if key not found (I18n.t returns key string on miss) */
function _t(key, fallback){
  try{
    const v = I18n.t(key);
    return (v && v !== key) ? v : fallback;
  }catch(e){ return fallback; }
}

/**
 * Верхняя полоска — 3-column grid:
 *   col-1 (appTopBarLogo)  — мини-обложка «продолжить» (показывается при скролле)
 *   col-2 (appTopBarLeft)  — вкладки Книги / Бібліотека (центр)
 *   col-3 (appTopBarRight) — кнопки луна/солнце + юзер
 *
 * @param {boolean} isCatalog
 * @param {object|null} cont       — объект книги для мини-обложки
 * @param {boolean} hideMiniCont   — скрыть мини-обложку (показываем при скролле)
 */
function _appTopBar(isCatalog, cont, hideMiniCont, pct){
  const isNight = !!(typeof state !== 'undefined' && state.reading && state.reading.night);
  const themeIcon = isNight ? _SVG_SUN : _SVG_MOON;

  let miniCont = '';
  if(cont){
    const coverSrc = cont.cover ? escapeHtml(cont.cover) : '';
    const titleAttr = escapeHtml((typeof getBookTitle === 'function' ? getBookTitle(cont) : cont.title_en) || 'Continue reading');
    const hideStyle = hideMiniCont ? ' style="display:none"' : '';
    const pctNum = (typeof pct === 'number' && pct >= 0) ? Math.round(pct) : 0;
    miniCont = '<div class="topMiniContWrap" id="topMiniContWrap"' + hideStyle + '>'
      + '<button class="topMiniCont" id="topMiniCont" title="' + titleAttr + '">'
      + '<div class="topMiniCover">'
      + (coverSrc ? '<img src="' + coverSrc + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">' : '')
      + '</div>'
      + '</button>'
      + '<div class="topMiniRing" style="--p:' + pctNum + '%">'
      + '<span class="topMiniRingPct">' + pctNum + '%</span>'
      + '</div>'
      + '</div>';
  }

  return '<div class="appTopBar" id="appTopBar">'
    + '<div class="appTopBarLogo" id="appTopBarLogo"><span class="appLogo">' + _SVG_LOGO + '</span>' + miniCont + '</div>'
    + '<div class="appTopBarLeft" id="appTopBarLeft">'
    + '<div class="appTopTabs" id="appTopTabsMain">'
    + '<button class="tab ' + (isCatalog ? '' : 'muted') + '" id="topTabBooks">' + _t('tabs_books','Книги') + '</button>'
    + '<button class="tab ' + (isCatalog ? 'muted' : '') + '" id="topTabLibrary">' + _t('tabs_library','Моя бібліотека') + '</button>'
    + '</div>'
    + '</div>'
    + '<div class="appTopBarRight">'
    + '<button class="appTopBtn" id="appTopTheme" title="Toggle theme" aria-label="Toggle theme">' + themeIcon + '</button>'
    + '<button class="appTopBtn" id="appTopUser" title="User settings" aria-label="User settings">' + _SVG_USER + '</button>'
    + '</div></div>';
}

/**
 * Wide "Continue reading" card for the main page.
 * Uses pkg.progress (0-100) — same field as library.js uses.
 */
function _contCardHtml(cont){
  if(!cont) return '';

  let pct = 0;
  let progressLine = '';

  try{
    const last = ProgressManager.getGlobalLastInteraction();

    // Primary: listPkgProgress — same source as library "In progress" view
    // Field name is "progress" (0-100), not "pct"
    const pkgs = ProgressManager.listPkgProgress(cont.id);
    if(pkgs && pkgs.length){
      // Pick the package matching last interaction, otherwise the most recent
      let bestPkg = pkgs[0];
      if(last && String(last.bookId) === String(cont.id)){
        const match = pkgs.find(p =>
          p.sourceLang === last.sourceLang && p.targetLang === last.targetLang
        );
        if(match) bestPkg = match;
      }

      // progress field stores 0-100 (same as library.js: Math.round(Number(x.progress||0)))
      pct = Math.round(Number(bestPkg.progress || 0));

      // Build progress line
      const modeStr = String(bestPkg.mode || (last ? last.mode : '') || '');
      const modeLabel = modeStr === 'listen' ? _t('mode_listen','Слухати') : _t('mode_read','Читати');
      const sl = (bestPkg.sourceLang || '').toUpperCase();
      const tl = (bestPkg.targetLang || '').toUpperCase();
      const langStr = sl && tl && sl !== tl ? sl + '→' + tl : (sl || tl);
      const parts = [langStr, modeLabel, pct ? pct + '%' : ''].filter(Boolean);
      progressLine = parts.join(' • ');

    } else if(last && String(last.bookId) === String(cont.id)){
      // Fallback: getPkgProgress — also uses .progress field
      const lvl = (typeof Config !== 'undefined' && Config.normalizeLevel)
        ? Config.normalizeLevel(last.level || 'original')
        : (last.level || 'original');
      const pkg = ProgressManager.getPkgProgress(cont.id, last.sourceLang, last.targetLang, lvl);
      if(pkg) pct = Math.round(Number(pkg.progress || 0));

      const modeStr = String(last.mode || '');
      const modeLabel = modeStr === 'listen' ? _t('mode_listen','Слухати') : _t('mode_read','Читати');
      const sl = (last.sourceLang || '').toUpperCase();
      const tl = (last.targetLang || '').toUpperCase();
      const langStr = sl && tl && sl !== tl ? sl + '→' + tl : (sl || tl);
      const parts = [langStr, modeLabel, pct ? pct + '%' : ''].filter(Boolean);
      progressLine = parts.join(' • ');
    }
  }catch(e){}

  const coverSrc = cont.cover ? escapeHtml(cont.cover) : '';
  const title = escapeHtml(getBookTitle(cont) || 'Book');
  const meta = escapeHtml(formatMetaAuthorSeries(cont));
  const label = _t('cont_reading', 'ПРОДОВЖИТИ ЧИТАННЯ');

  return '<div class="sectionLabel" style="padding-top:18px">' + label + '</div>'
    + '<div class="cardWide" id="contReadCard" style="cursor:pointer">'
    + '<div class="coverImg">' + (coverSrc ? '<img src="' + coverSrc + '" alt="">' : '') + '</div>'
    + '<div class="info">'
    + '<p class="title">' + title + '</p>'
    + '<p class="meta">' + meta + '</p>'
    + (progressLine ? '<p class="meta1">' + progressLine + '</p>' : '')
    + '</div>'
    + '<div class="circle" style="--p:' + pct + '%;flex-shrink:0">'
    + '<div class="inner">' + pct + '%</div>'
    + '</div>'
    + '</div>';
}

/* User menu dropdown — rendered into body, closed on outside click */
function _openUserMenu(anchorBtn){
  const existing = document.getElementById('userMenuDropdown');
  if(existing){ existing.remove(); return; }

  const lang = I18n.getUiLang();
  const langs = I18n.getAvailableLangs();
  const langLabels = { en: 'English', uk: 'Українська', ru: 'Русский' };
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
    + '<div class="umLabel" id="umLangLabel">' + _t('user_menu_lang','Мова') + '</div>'
    + '<div class="umLangRow">' + langOptions + '</div>'
    + '</div>'
    + '<div class="umDivider"></div>'
    + '<div class="umSection">'
    + '<div class="umLabel" id="umFontLabel">' + _t('user_menu_font','Шрифт') + '</div>'
    + '<div class="umFontRow">'
    + '<button class="umFontBtn" id="umFontMinus" aria-label="Decrease font">A−</button>'
    + '<span class="umFontVal" id="umFontVal">' + curFontSize + 'px</span>'
    + '<button class="umFontBtn" id="umFontPlus" aria-label="Increase font">A+</button>'
    + '</div>'
    + '</div>';

  document.body.appendChild(menu);
  const rect = anchorBtn.getBoundingClientRect();
  const mw = 220;
  let left = Math.min(rect.right - mw, window.innerWidth - mw - 8);
  if(left < 8) left = 8;
  menu.style.top = (rect.bottom + 6) + 'px';
  menu.style.left = left + 'px';

  menu.querySelectorAll('.umLangBtn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const l = btn.dataset.lang;
      I18n.setUiLang(l);
      try{ applyUiLang(); }catch(err){}
      try{
        const route = state.route && state.route.name;
        if(route === 'catalog') renderCatalog();
        else if(route === 'library') renderLibrary();
      }catch(err){}
      menu.remove();
    });
  });

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
  if(lbl) lbl.textContent = _t('user_menu_lang','Мова');
  const flbl = menu.querySelector('#umFontLabel');
  if(flbl) flbl.textContent = _t('user_menu_font','Шрифт');
  const curLang = I18n.getUiLang();
  menu.querySelectorAll('.umLangBtn').forEach(b => b.classList.toggle('active', b.dataset.lang === curLang));
}

/* Global scroll listener */
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

  // Find last-interacted book for continue-reading card
  let cont = null;
  try{
    const g = ProgressManager.getGlobalLastInteraction();
    if(g && g.bookId){
      cont = state.catalog.find(b=>b.id===g.bookId) || null;
    }
    if(!cont){
      let bestTs = -1;
      for(const b of state.catalog){
        const pkgs = ProgressManager.listPkgProgress(b.id);
        if(pkgs && pkgs.length){
          const ts = Number(pkgs[0].ts||0);
          if(ts > bestTs){ bestTs = ts; cont = b; }
        }
      }
    }
  }catch(e){}

  // openCont: resume reading or open details
  const openCont = cont ? ()=>{
    try{
      const last=ProgressManager.getGlobalLastInteraction();
      const bid=cont.id;
      if(last&&String(last.bookId||'')===String(bid||'')){
        state.reading.sourceLang=last.sourceLang||state.reading.sourceLang;
        state.reading.targetLang=last.targetLang||state.reading.targetLang;
        const lvl=(typeof Config!=='undefined'&&Config.normalizeLevel)?Config.normalizeLevel(last.level||'original'):(last.level||'original');
        const pkg=ProgressManager.getPkgProgress(bid,state.reading.sourceLang,state.reading.targetLang,lvl);
        const idx=pkg&&typeof pkg.activeIndex==='number'?Number(pkg.activeIndex||0):0;
        if(String(last.mode||'')==='read') go({name:'bireader',bookId:bid,level:last.level||'original',sourceLang:last.sourceLang,targetLang:last.targetLang,startIndex:idx});
        else go({name:'reader',bookId:bid,level:last.level||'original',sourceLang:last.sourceLang,targetLang:last.targetLang,startIndex:idx});
        return;
      }
    }catch(e){}
    go({name:'details',bookId:cont.id});
  } : null;

  const groupsHtml = groupNames.map(g=>{
    const items = groups[g].slice(0,10);
    return '<div class="groupCard">'
      +'<div class="groupTitleRow"><h3 class="groupTitle">'+escapeHtml(I18n.tGenre(g))+'</h3>'
      +'<button class="chevBtn" data-group="'+escapeHtml(g)+'">&#8250;</button></div>'
      +'<div class="hScroll">'
      +items.map(b=>'<div class="bookTile" data-open="'+escapeHtml(b.id)+'">'
        +'<div class="tileCover">'+(b.cover?'<img src="'+escapeHtml(b.cover)+'" alt="">':'')+'</div>'
        +'<div class="tileMeta"><p class="tileTitle">'+escapeHtml(getBookTitle(b)||'Book')+'</p>'
        +'<p class="tileSub">'+escapeHtml(formatMetaAuthorSeries(b))+'</p></div></div>').join('')
      +'</div></div>';
  }).join('');

  // Compute progress % for topbar ring
  let contPct = 0;
  try{
    if(cont){
      const _last2 = ProgressManager.getGlobalLastInteraction();
      const _pkgs2 = ProgressManager.listPkgProgress(cont.id);
      if(_pkgs2 && _pkgs2.length){
        let _bp = _pkgs2[0];
        if(_last2 && String(_last2.bookId)===String(cont.id)){
          const _m = _pkgs2.find(p=>p.sourceLang===_last2.sourceLang && p.targetLang===_last2.targetLang);
          if(_m) _bp = _m;
        }
        contPct = Math.round(Number(_bp.progress||0));
      }
    }
  }catch(e){}

  app.innerHTML = `
    <div class="wrap homeScreen">
      ${_appTopBar(true, cont, true, contPct)}
      ${cont ? _contCardHtml(cont) : ''}
      ${groupsHtml}
    </div>
  `;

  _bindTopBarBtns();
  _bindTabsScroll(true);

  // Bind big continue-reading card
  if(cont && openCont){
    const contCardEl = document.getElementById('contReadCard');
    if(contCardEl) contCardEl.onclick = openCont;
  }

  // Bind topbar mini cover click + show/hide on scroll
  if(cont && openCont){
    const mc = document.getElementById('topMiniCont');
    const contCardEl = document.getElementById('contReadCard');
    if(mc) mc.onclick = openCont;
    const mw = document.getElementById('topMiniContWrap');
    if(mw && contCardEl){
      function _scrollShowMini(){
        const r = contCardEl.getBoundingClientRect();
        const tb = document.getElementById('appTopBar');
        const barH = tb ? tb.offsetHeight : 56;
        mw.style.display = (r.bottom < barH) ? '' : 'none';
      }
      _tabsScrollHandler = _scrollShowMini;
      window.addEventListener('scroll', _scrollShowMini, { passive: true });
      _scrollShowMini();
    }
  }

  app.querySelectorAll('[data-open]').forEach(el=>{
    el.addEventListener('click',()=>go({name:'details',bookId:el.dataset.open}));
  });
  app.querySelectorAll('[data-group]').forEach(el=>{
    el.addEventListener('click',()=>{ try{ renderGenreAll(el.dataset.group); }catch(err){ console.error(err); } });
  });
}

/* ── All-books view for a genre/series ─────────────────────── */
function renderGenreAll(groupName){
  _disconnectTabsObserver();
  const books = (state.catalog || []).filter(b => (b.series || 'Books').trim() === groupName);
  const svgBack = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>';

  app.innerHTML = `
    <div class="wrap homeScreen">
      <div class="genreTopBar">
        <button class="appTopBtn" id="btnGenreBack" style="flex-shrink:0" title="Back">${svgBack}</button>
        <h2 class="genreTopTitle">${escapeHtml(I18n.tGenre(groupName))}</h2>
        <div style="width:38px;flex-shrink:0"></div>
      </div>
      <div class="genreGrid">
        ${books.map(b =>
          '<div class="bookTile" data-open="' + escapeHtml(b.id) + '">'
          + '<div class="tileCover">' + (b.cover ? '<img src="' + escapeHtml(b.cover) + '" alt="">' : '') + '</div>'
          + '<div class="tileMeta"><p class="tileTitle">' + escapeHtml(getBookTitle(b) || 'Book') + '</p>'
          + '<p class="tileSub">' + escapeHtml(formatMetaAuthorSeries(b)) + '</p></div></div>'
        ).join('')}
      </div>
    </div>
  `;

  const btnBack = document.getElementById('btnGenreBack');
  if(btnBack) btnBack.onclick = () => renderCatalog();

  app.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => go({name:'details', bookId:el.dataset.open}));
  });
}
