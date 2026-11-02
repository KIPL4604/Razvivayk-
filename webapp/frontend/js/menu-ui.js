/* Shared presentation only: preferences, safe menu gestures and dialog focus. */
(() => {
  const key = 'teramont.ui.preferences.v1';
  let preferences = {};
  try { preferences = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch {}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function apply() {
    document.documentElement.dataset.theme = preferences.theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.menuMotion = preferences.motion === false || reduced.matches ? 'off' : 'on';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', preferences.theme === 'light' ? '#f4f4f2' : '#141414');
    const telegram=window.Telegram?.WebApp,color=preferences.theme==='light'?'#f4f4f2':'#141414';
    if(telegram?.initData){for(const method of ['setHeaderColor','setBackgroundColor']){try{telegram[method]?.(color);}catch{}}if(telegram.isVersionAtLeast?.('7.10')){try{telegram.setBottomBarColor?.(color);}catch{}}}
    document.querySelectorAll('[data-menu-reel]').forEach(syncMedia);
    document.querySelectorAll('[data-ui-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.uiTheme===document.documentElement.dataset.theme)));
    const moving=preferences.motion!==false&&!reduced.matches;
    document.querySelectorAll('[data-motion-label]').forEach(b=>{b.textContent=moving?'Фон: движение':'Фон: пауза';b.setAttribute('aria-pressed',String(moving));});
    document.dispatchEvent(new CustomEvent('menu-preferences'));
  }
  function set(name, value) { preferences[name] = value; try {localStorage.setItem(key, JSON.stringify(preferences));} catch {} apply(); }
  function syncMedia(video) {
    const hidden = !video.closest('.screen.active') || !video.getClientRects().length || document.hidden;
    if (hidden || preferences.motion === false || reduced.matches) { video.pause(); return; }
    video.play().catch(() => {}); // Poster remains if autoplay or decoding is unavailable.
  }
  function animate(element,direction=1){window.PageMotion?.reveal(element,direction);}
  // Iconimate Arrow Right 7453ab9b2fcf; Muhammad Ammar / Phosphor, MIT.
  // Vanilla adaptation: one deliberate pass, no ambient replay or dependencies.
  const arrowPath='M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z';
  function arrow(direction=1){return '<span class="menu-page-arrow'+(direction<0?' is-previous':'')+'" aria-hidden="true"><svg viewBox="0 0 256 256" fill="currentColor"><path d="'+arrowPath+'"/></svg></span>';}
  function arrowFeedback(event){
    if(reduced.matches||preferences.motion===false)return;
    const button=event.target.closest('button:not(:disabled)'),path=button?.querySelector('.menu-page-arrow path');
    if(!path||event.type==='pointerover'&&button.contains(event.relatedTarget))return;
    path.getAnimations().forEach(a=>a.cancel());
    path.animate([{transform:'translateX(0)',offset:0},{transform:'translateX(224px)',offset:.34},{transform:'translateX(-228px)',offset:.3401},{transform:'translateX(0)',offset:1}],{duration:750,easing:'cubic-bezier(.16,1,.3,1)'});
  }
  function pager(element,change,options){window.PageMotion?.pager(element,change,options);}
  function trap(element, event) {
    if (event.key !== 'Tab' || !element) return;
    const items=[...element.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select,[tabindex="0"]')].filter(e=>e.getClientRects().length);
    if(!items.length){event.preventDefault();element.focus();return;}
    const index=items.indexOf(document.activeElement);
    if(event.shiftKey && index<=0){event.preventDefault();items.at(-1).focus();}
    else if(!event.shiftKey && (index===items.length-1 || index===-1)){event.preventDefault();items[0].focus();}
  }
  window.MenuUI={set,get:name=>preferences[name],apply,pager,animate,trap,syncMedia,arrow,screenTransition:(...args)=>window.PageMotion?.screenTransition(...args),transition:(...args)=>window.PageMotion?.transition(...args)};
  for(const name of ['pointerover','pointerdown','focusin'])document.addEventListener(name,arrowFeedback);
  document.addEventListener('visibilitychange',()=>document.querySelectorAll('[data-menu-reel]').forEach(syncMedia));
  reduced.addEventListener('change',apply);
  document.addEventListener('click',e=>{
    const control=e.target.closest('[data-ui-theme],[data-ui-motion]');
    if(!control)return;
    if(control.hasAttribute('data-ui-theme'))set('theme',control.dataset.uiTheme);
    else set('motion',preferences.motion===false);
  });
  apply();
})();
