"use strict";

// The library loads only this small entry point. The simulation and artwork are lazy.
const LumenMode = (() => {
  let controller=null,loading=null,entry=null,generation=0,homeHTML='',pending=false;
  const setupMount=()=>document.querySelector('#lumenSetupMount');
  const current=ticket=>ticket===generation&&activeScreen==='lumen';
  function resizeTitle(){
    if(!controller&&activeScreen==='lumen'&&homeHTML)entry?.menuViewport(tg);
  }
  window.addEventListener('resize',resizeTitle);
  window.visualViewport?.addEventListener('resize',resizeTitle);
  for(const event of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged']){
    try{window.Telegram?.WebApp?.onEvent?.(event,resizeTitle);}catch(_){}
  }
  async function ensureController(ticket){
    loading ||= import('/static/js/lumen/game.mjs?v=world-warmup-1').catch(error=>{loading=null;throw error;});
    const module=await loading;
    if(!current(ticket))return false;
    if(!controller){
      controller=module.createGame({getSaved:()=>saved,persist:saveState,navigate:showScreen,telegram:tg,toast:showToast});
      controller.onScreen('lumen');
    }
    return true;
  }
  function closePending(){
    generation++;pending=false;entry.showHome(setupMount(),homeHTML,tg);
  }
  async function loadAction(action,value){
    const ticket=++generation,mount=setupMount();
    pending=true;
    entry.showMenuLoading(mount,{closeAction:'cancel-load'});
    try{
      if(!await ensureController(ticket))return;
    }catch(_){
      if(current(ticket))entry.showMenuLoading(mount,{closeAction:'cancel-load',retryAction:'refresh',error:true});
      return;
    }
    pending=false;
    if(action==='resume')entry.showHome(mount,homeHTML,tg);
    controller.action(action,value);
  }
  function art() {
    return '<img class="game-art lumen-art" src="/static/assets/lumen/cover.png" alt="" width="384" height="240" loading="lazy">';
  }
  function getResume() {
    const record = saved.lumen;
    return record?.run && ["playing", "upgrade"].includes(record.run.status)
      ? {type:"lumen", lastTouchedAt:record.lastTouchedAt || 0} : null;
  }
  function open(resume = false) {
    return GameAssets.enter("lumen", () => openReady(resume));
  }
  async function openReady(resume) {
    const ticket=++generation;
    pending=false;homeHTML="";
    showScreen("lumen");
    const mount=setupMount();
    mount.innerHTML = '<div class="lumen-loading lumen-entry-loading"><small>ЛЮМЕН / ПОСЛЕДНИЙ МАЯК</small><h1>Зажигаем маяк</h1><span id="lumenEntryPhase" role="status">Получаем список ресурсов</span><div class="lumen-entry-meter" role="progressbar" aria-label="Загрузка меню Люмена" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="lumen-load-dots" aria-hidden="true">'+ '<i></i>'.repeat(8)+'</div><div class="lumen-entry-meta"><strong id="lumenEntryPercent">0%</strong><span id="lumenEntryEta">Оцениваем время…</span></div><p>Сначала загрузим фон и графику меню. Выбранный мир подготовим перед экспедицией.</p><button type="button" class="text-button" data-screen-link="home">К играм</button></div>';
    let importing=true;
    try {
      entry ||= await import('/static/js/lumen/menu-entry.mjs');
      if(!current(ticket))return;
      importing=false;
      const html=await entry.prepareHome(saved.lumen,value=>{
        if(ticket!==generation||activeScreen!=='lumen')return;
        const phase=document.querySelector('#lumenEntryPhase');if(!phase)return;
        phase.textContent=({download:'Загружаем фон и графику меню',decode:'Подготавливаем графику',ready:'Меню готово'})[value.phase]||'Загружаем меню';
        document.querySelector('#lumenEntryPercent').textContent=value.percent+'%';
        const meter=mount.querySelector('[role="progressbar"]');meter.setAttribute('aria-valuenow',value.percent);meter.firstElementChild.style.width=value.percent+'%';
        document.querySelector('#lumenEntryEta').textContent=value.remainingSeconds? '≈ '+value.remainingSeconds+' с':value.phase==='decode'?'Подготовка…':value.phase==='ready'?'Готово':'Оцениваем время…';
        mount.querySelectorAll('.lumen-load-dots i').forEach((dot,i)=>dot.classList.toggle('loaded',value.percent>=(i+1)*12.5));
      });
      if(!current(ticket))return;
      if(resume){importing=true;if(!await ensureController(ticket))return;importing=false;}
      homeHTML=html;
      if(controller){
        controller.setup();
        if(resume)controller.resume();
      }else entry.showHome(mount,html,tg);
    } catch (_) {
      if(ticket !== generation || activeScreen !== "lumen") return;
      const retryAction=importing?'refresh':resume?'open-resume':'open';
      const retryLabel=importing?'Обновить приложение':'Повторить загрузку';
      mount.innerHTML = '<div class="lumen-loading" role="alert">Не удалось загрузить Люмен.<span>Проверь соединение и повтори. Сохранённая экспедиция останется на устройстве.</span><button class="primary-button" data-lumen-action="'+retryAction+'" type="button">'+retryLabel+'</button><button type="button" class="text-button" data-screen-link="home">К играм</button></div>';
    }
  }
  function click(button) {
    if(button.dataset.resume === "lumen") {open(true);return true;}
    const action = button.dataset.lumenAction;
    if(!action)return false;
    if(action === "reload"){
      if(tg?.initData && typeof tg.close === "function") {tg.disableClosingConfirmation?.();tg.close();}
      else location.reload();
      return true;
    }
    const value=button.dataset.lumenValue;
    if(action==='open'||action==='open-resume')open(action==='open-resume');
    else if(action==='cancel-load'&&pending)closePending();
    else if(action==='refresh')location.reload();
    else if(controller)controller.action(action,value);
    else if(action==='setup')open();
    else if(action==='catalog')showScreen('home');
    else if((action==='menu'||action==='resume')&&homeHTML)loadAction(action,value);
    return true;
  }
  function onScreen(name){
    if(!['lumen','lumen-game'].includes(name)){
      generation++;pending=false;homeHTML='';
      if(!controller){
        document.documentElement.classList.remove('lumen-menu-active','lumen-active');
        document.documentElement.style.removeProperty('--lumen-height');
      }
    }
    controller?.onScreen(name);
  }
  function back(){
    if(pending){closePending();return;}
    if(!controller?.back())showScreen('home');
  }
  document.addEventListener('keydown',event=>{
    if(controller||activeScreen!=='lumen')return;
    if(event.code==='Escape'){event.preventDefault();if(!event.repeat)back();}
    if(event.code==='Tab'&&pending)window.MenuUI?.trap(setupMount().querySelector('[role="dialog"]'),event);
  });
  return {art,getResume,click,onScreen,back,enter:()=>open(),resume:()=>open(true)};
})();
