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
    mount.innerHTML = '<div class="lumen-loading" role="status">Зажигаем маяк…<span>Загружаем игру</span></div>';
    try {
      loading ||= import("/static/js/lumen/game.mjs?v=arsenal-7").catch(error => {loading=null;throw error;});
      const module = await loading;
      controller ||= module.createGame({getSaved:()=>saved, persist:saveState, navigate:showScreen, telegram:tg, toast:showToast});
      if(ticket !== generation || activeScreen !== "lumen") return;
      if(resume) controller.resume(); else controller.setup();
    } catch (_) {
      if(ticket !== generation || activeScreen !== "lumen") return;
      mount.innerHTML = '<div class="lumen-loading" role="alert">Не удалось загрузить игру.<span>Проверь соединение и перезагрузи страницу. Сохранённый забег останется на устройстве.</span><button class="primary-button" data-lumen-action="reload" type="button">Перезагрузить страницу</button></div>';
    }
  }
  function click(button) {
    if(button.dataset.resume === "lumen") {open(true);return true;}
    const action = button.dataset.lumenAction;
    if(!action)return false;
    if(action === "reload"){location.reload();return true;}
    if(action === "setup" && !controller)open();
    else if(action === "open")open();
    else controller?.action(action, button.dataset.lumenValue);
    return true;
  }
  function onScreen(name) {if(!["lumen", "lumen-game"].includes(name))generation++;controller?.onScreen(name);}
  function back(){if(!controller?.back())showScreen('home');}
  return {art,getResume,click,onScreen,back,enter:()=>open(),resume:()=>open(true)};
})();
