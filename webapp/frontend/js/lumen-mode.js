"use strict";

// The library loads only this small entry point. The simulation and artwork are lazy.
const LumenMode = (() => {
  let controller = null, loading = null, generation = 0;
  function art() {
    return '<img class="game-art lumen-art" src="/static/assets/lumen/cover.png" alt="" width="384" height="240" loading="lazy">';
  }
  function getResume() {
    const record = saved.lumen;
    return record?.run && ["playing", "upgrade"].includes(record.run.status)
      ? {type:"lumen", lastTouchedAt:record.lastTouchedAt || 0} : null;
  }
  async function open(resume = false) {
    const ticket = ++generation;
    showScreen("lumen");
    const mount = document.querySelector("#lumenSetupMount");
    mount.innerHTML = '<div class="lumen-loading lumen-entry-loading"><small>ЛЮМЕН / ПОСЛЕДНИЙ МАЯК</small><h1>Зажигаем маяк</h1><span id="lumenEntryPhase" role="status">Получаем список ресурсов</span><div class="lumen-entry-meter" role="progressbar" aria-label="Загрузка меню Люмена" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="lumen-load-dots" aria-hidden="true">'+ '<i></i>'.repeat(8)+'</div><div class="lumen-entry-meta"><strong id="lumenEntryPercent">0%</strong><span id="lumenEntryEta">Оцениваем время…</span></div><p>Сначала загрузим фон и графику меню. Выбранный мир подготовим перед экспедицией.</p><button type="button" class="text-button" data-screen-link="home">К играм</button></div>';
    try {
      const preload=await import('/static/js/lumen/preload.mjs');
      await preload.preloadMenu(value=>{
        if(ticket!==generation||activeScreen!=='lumen')return;
        const phase=document.querySelector('#lumenEntryPhase');if(!phase)return;
        phase.textContent=({download:'Загружаем фон и графику меню',decode:'Подготавливаем графику',ready:'Меню готово'})[value.phase]||'Загружаем меню';
        document.querySelector('#lumenEntryPercent').textContent=value.percent+'%';
        const meter=mount.querySelector('[role="progressbar"]');meter.setAttribute('aria-valuenow',value.percent);meter.firstElementChild.style.width=value.percent+'%';
        document.querySelector('#lumenEntryEta').textContent=value.remainingSeconds? '≈ '+value.remainingSeconds+' с':value.phase==='decode'?'Подготовка…':value.phase==='ready'?'Готово':'Оцениваем время…';
        mount.querySelectorAll('.lumen-load-dots i').forEach((dot,i)=>dot.classList.toggle('loaded',value.percent>=(i+1)*12.5));
      },saved.lumen?.meta);
      loading ||= import("/static/js/lumen/game.mjs?v=static-map-1").catch(error => {loading=null;throw error;});
      const module = await loading;
      controller ||= module.createGame({getSaved:()=>saved, persist:saveState, navigate:showScreen, telegram:tg, toast:showToast});
      if(ticket !== generation || activeScreen !== "lumen") return;
      if(resume) controller.resume(); else controller.setup();
    } catch (_) {
      if(ticket !== generation || activeScreen !== "lumen") return;
      mount.innerHTML = '<div class="lumen-loading" role="alert">Не удалось загрузить Люмен.<span>Проверь соединение и повтори. Сохранённая экспедиция останется на устройстве.</span><button class="primary-button" data-lumen-action="open" type="button">Повторить загрузку</button><button type="button" class="text-button" data-screen-link="home">К играм</button></div>';
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
    if(action === "setup" && !controller)open();
    else if(action === "open")open();
    else controller?.action(action, button.dataset.lumenValue);
    return true;
  }
  function onScreen(name) {if(!["lumen", "lumen-game"].includes(name))generation++;controller?.onScreen(name);}
  function back(){if(!controller?.back())showScreen('home');}
  return {art,getResume,click,onScreen,back,enter:()=>open(),resume:()=>open(true)};
})();
