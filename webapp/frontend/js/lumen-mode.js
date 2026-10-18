"use strict";

// The library loads only this small entry point. The simulation and artwork are lazy.
const LumenMode = (() => {
  let controller = null, loading = null, generation = 0;
  function art() {
    return '<svg class="game-art lumen-art" viewBox="0 0 360 220" fill="none" aria-hidden="true"><rect width="360" height="220" rx="14" fill="#102E32"/><path d="M0 55h360M0 110h360M0 165h360M60 0v220M120 0v220M180 0v220M240 0v220M300 0v220" stroke="#244246"/><ellipse cx="180" cy="144" rx="84" ry="40" fill="#193F40"/><ellipse cx="180" cy="134" rx="59" ry="27" stroke="#70D8B0" stroke-dasharray="4 9"/><path d="m153 115 27-58 27 58-27 19Z" fill="#BADED2"/><path d="m180 70 12 42-12 13-12-13Z" fill="#80E9C2"/><path d="M159 139h42l-6 10h-30Z" fill="#CA9D6B"/><path d="M40 190c0-55 30-63 29-98 32 21 19 53 9 76 29-28 49-25 55-18-15 31-50 38-93 40Zm253-9c-19-42-5-64 12-82 2 25 4 31 3 46 11-28 21-30 29-30-1 26-13 49-44 66Z" fill="#33594D"/><circle cx="86" cy="68" r="7" fill="#EFA977"/><circle cx="278" cy="54" r="5" fill="#EFA977"/><circle cx="256" cy="169" r="7" fill="#7DDABD"/><path d="m119 170 6-9 6 9-6 9Z" fill="#A9EBCF"/><circle cx="222" cy="86" r="2" fill="#D6F9E2"/><circle cx="133" cy="47" r="2" fill="#D6F9E2"/></svg>';
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
      loading ||= import("/static/js/lumen/game.mjs?v=1").catch(error => {loading=null;throw error;});
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
  return {art,getResume,click,onScreen,enter:()=>open(),resume:()=>open(true)};
})();
