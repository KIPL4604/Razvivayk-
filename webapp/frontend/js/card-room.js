"use strict";
const CardRoom=(()=>{
  let current='',ownedFullscreen=false;
  const active=()=>['card-game','poker-game'].includes(current);
  // Iconimate Arrows Out 631cc560723a; Phosphor geometry, MIT (see notices).
  const arrows=[
    'M216,48V96a8,8,0,0,1-16,0V67.31l-42.34,42.35a8,8,0,0,1-11.32-11.32L188.69,56H160a8,8,0,0,1,0-16h48A8,8,0,0,1,216,48Z',
    'M208,152a8,8,0,0,0-8,8v28.69l-42.34-42.35a8,8,0,0,0-11.32,11.32L188.69,200H160a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V160A8,8,0,0,0,208,152Z',
    'M98.34,146.34,56,188.69V160a8,8,0,0,0-16,0v48a8,8,0,0,0,8,8H96a8,8,0,0,0,0-16H67.31l42.35-42.34a8,8,0,0,0-11.32-11.32Z',
    'M67.31,56H96a8,8,0,0,0,0-16H48a8,8,0,0,0-8,8V96a8,8,0,0,0,16,0V67.31l42.34,42.35a8,8,0,0,0,11.32-11.32Z'
  ];
  function icon(name){
    if(name==='fullscreen')return '<svg class="cardroom-expand-icon" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">'+arrows.map((d,i)=>'<path d="'+d+'" style="--arrow:'+i+'"/>').join('')+'</svg>';
    const paths={back:'M19 12H5m6-6-6 6 6 6',help:'M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01',close:'m6 6 12 12M6 18 18 6',menu:'M5 6h14M5 12h14M5 18h14',next:'m9 5 7 7-7 7',prev:'m15 5-7 7 7 7',undo:'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12'};
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(name==='help'?'<circle cx="12" cy="12" r="9"/>':'')+'<path d="'+(paths[name]||paths.menu)+'"/></svg>';
  }
  function viewport(){
    if(!active())return;
    const party=document.querySelector('.cardroom.active');if(party)party.scrollTop=0;const mount=document.querySelector('#cardGameMount');if(mount)mount.scrollTop=0;
    const root=document.documentElement,webview=Boolean(tg?.initData);
    root.style.setProperty('--cardroom-height',(webview&&tg.viewportHeight>0?tg.viewportHeight:visualViewport?.height||innerHeight)+'px');
    for(const side of ['top','bottom','left','right'])root.style.setProperty('--cardroom-safe-'+side,Math.max(tg?.safeAreaInset?.[side]||0,tg?.contentSafeAreaInset?.[side]||0)+'px');
  }
  function updateFullscreen(){const full=Boolean(document.fullscreenElement||tg?.isFullscreen);document.querySelectorAll('[data-cardroom-action="fullscreen"]').forEach(b=>{b.setAttribute('aria-pressed',String(full));b.setAttribute('aria-label',full?'Выйти из полного экрана':'Полный экран');});viewport();}
  function fullscreen(){
    if(tg?.initData&&tg.isVersionAtLeast?.('8.0')){try{tg.isFullscreen?tg.exitFullscreen():tg.requestFullscreen();}catch(_){showToast('Полный экран недоступен в этом клиенте Telegram.');}return;}
    if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});return;}
    if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().then(()=>{ownedFullscreen=true;updateFullscreen();}).catch(()=>showToast('Браузер не разрешил полный экран. Стол занимает доступную область.'));
    else showToast('Полный экран недоступен. Стол занимает доступную область.');
  }
  function onScreen(name){
    const before=active();current=name;const now=active();
    document.documentElement.classList.toggle('cards-lounge',['cards','poker'].includes(name));
    if(now){const panel=document.querySelector('.cardroom.active');if(panel&&!panel.querySelector('.cardroom-bandana')){const fabric=document.createElement('div');fabric.className='cardroom-bandana';fabric.setAttribute('aria-hidden','true');fabric.innerHTML='<i></i><i></i>';panel.prepend(fabric);}}
    document.documentElement.classList.toggle('cardroom-active',now);
    if(now){for(const id of ['pokerFullscreenIcon','cardGameFullscreenIcon','cardGameMenuIcon']){const e=document.querySelector('#'+id);if(e&&!e.firstElementChild)e.innerHTML=icon(id==='cardGameMenuIcon'?'menu':'fullscreen');}viewport();if(tg?.isVersionAtLeast?.('7.7'))try{tg.disableVerticalSwipes();}catch(_){}updateFullscreen();}
    if(before&&!now){document.querySelectorAll('.cardroom-dialog[open]').forEach(d=>d.close());if(ownedFullscreen&&document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});ownedFullscreen=false;document.documentElement.style.removeProperty('--cardroom-height');}
  }
  function capture(root){return new Map([...root.querySelectorAll('[data-card-key]')].map(e=>[e.dataset.cardKey,e.getBoundingClientRect()]));}
  function animate(root,previous=new Map()){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const deck=root.querySelector('[data-deck-origin]')?.getBoundingClientRect();
    [...root.querySelectorAll('[data-card-key]')].forEach((e,i)=>{
      const rect=e.getBoundingClientRect(),old=previous.get(e.dataset.cardKey);
      if(!rect.width||!rect.height)return;
      if(old){const x=old.x-rect.x,y=old.y-rect.y;if(Math.hypot(x,y)>2)e.animate([{translate:`${x}px ${y}px`},{translate:'0px 0px'}],{duration:320,easing:'cubic-bezier(.23,1,.32,1)'});}
      else if(deck)e.animate([{translate:`${deck.x-rect.x}px ${deck.y-rect.y}px`,opacity:0},{translate:'0px 0px',opacity:1}],{duration:360,delay:Math.min(i*24,160),easing:'cubic-bezier(.23,1,.32,1)',fill:'backwards'});
    });
  }
  document.addEventListener('wheel',e=>{if(active()&&!e.target.closest('dialog,[data-cardroom-scroll]'))e.preventDefault();},{passive:false});
  document.addEventListener('touchmove',e=>{if(active()&&!e.target.closest('dialog,[data-cardroom-scroll]'))e.preventDefault();},{passive:false});
  window.addEventListener('resize',viewport);visualViewport?.addEventListener('resize',viewport);document.addEventListener('fullscreenchange',updateFullscreen);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-cardroom-action="fullscreen"]');if(b){e.preventDefault();fullscreen();}});
  document.addEventListener('keydown',e=>{if(active()&&e.code==='Space'&&!e.target.closest('button,input,select,dialog'))e.preventDefault();});
  function init(){try{for(const event of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'])tg?.onEvent?.(event,updateFullscreen);tg?.onEvent?.('fullscreenFailed',()=>{if(active())showToast('Telegram не разрешил полный экран. Стол уже занимает доступную область.');});}catch(_){}}
  document.addEventListener('DOMContentLoaded',init);
  return {icon,onScreen,capture,animate,fullscreen,sync:updateFullscreen};
})();
