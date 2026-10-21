"use strict";
const SpecimenMode=(()=>{
  let controller=null,loading=null,generation=0;
  const art=()=>'<img class="game-art specimen-art" src="/static/assets/specimen/cover.png?v=3" alt="" width="384" height="240" loading="lazy">';
  function catalog(){return '<button class="campaign-card specimen-catalog" type="button" data-sp-action="open" '+(gameFilter!=="Все"?'hidden':'')+' aria-label="Нулевой образец. Пиксельный экшен. Первый прототип">'+art()+'<span class="campaign-card-copy"><span class="campaign-category">Прототип · Экшен</span><strong>Нулевой образец</strong><span class="campaign-card-progress"><span>Побег из лаборатории · 6 комнат</span>'+uiIcon('arrow')+'</span></span></button>';}
  async function enter(){
    const ticket=++generation;showScreen('specimen');const mount=document.querySelector('#specimenMount');
    if(!controller)mount.innerHTML='<div class="sp-loading" role="status">Устанавливаем связь с образцом…</div>';
    try{
      loading||=import('/static/js/specimen/game.mjs?v=5').then(m=>m.createGame({getSaved:()=>saved,persist:saveState,navigate:showScreen,telegram:tg,toast:showToast})).catch(e=>{loading=null;throw e;});
      controller=await loading;if(ticket!==generation||activeScreen!=='specimen')return;controller.enter();
    }catch{if(ticket!==generation||activeScreen!=='specimen')return;mount.innerHTML='<div class="sp-loading" role="alert">Не удалось загрузить сектор.<span>Проверь соединение и попробуй снова.</span><button type="button" data-sp-action="reload">Повторить загрузку</button><button type="button" data-sp-action="exit">В каталог</button></div>';}
  }
  function click(button){const action=button.dataset.spAction;if(!action&&button.dataset.resume!=='specimen')return false;if(action==='open'||button.dataset.resume==='specimen')enter();else if(action==='reload'){location.reload();}else if(action==='exit'&&!controller)showScreen('home');else controller?.action(action);return true;}
  function onScreen(name){const active=name==='specimen';document.documentElement.classList.toggle('specimen-active',active);if(!active)generation++;controller?.onScreen(name);}
  function getResume(){const r=saved.specimen;return r?.run?.status==='playing'?{type:'specimen',lastTouchedAt:r.lastTouchedAt||0}:null;}
  return{art,catalog,enter,click,onScreen,getResume,back:()=>controller?.back()||showScreen('home'),snapshot:()=>controller?.snapshot()};
})();
