/* The title screen uses the same authored menu, without importing simulation. */
import {renderMenu} from './menu.mjs?v=texture-sound-1';
import {CHARACTERS} from './catalog.mjs';
import {normalizeMeta,mapAvailable} from './economy.mjs';
import {preloadMenu,menuBackgroundURL} from './preload.mjs';

export async function prepareHome(raw,onProgress){
 const value=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const meta=normalizeMeta(value.meta);
 const character=Object.hasOwn(CHARACTERS,value.selection?.character)&&meta.unlocked.includes(value.selection.character)?value.selection.character:'scout';
 let map=mapAvailable(meta,value.selection?.map)?value.selection.map:'garden';
 if(map==='crater')map=mapAvailable(meta,'castle')?'castle':'quarry';
 await preloadMenu(onProgress,meta);
 const record={...value,meta,settings:{sound:value.settings?.sound===true,volume:value.settings?.volume??70}};
 return renderMenu({page:'home',book:'weapons',character,map,record,icon:()=>'<span class="lumen-coin-icon" aria-hidden="true"></span>',recipes:()=>''});
}

export function menuViewport(tg){
 const root=document.documentElement;
 const height=tg?.initData&&tg.viewportHeight>0?tg.viewportHeight:window.visualViewport?.height||innerHeight;
 root.style.setProperty('--lumen-height',height+'px');
 for(const edge of ['top','bottom','left','right']){
  const inset=Math.max(tg?.safeAreaInset?.[edge]||0,tg?.contentSafeAreaInset?.[edge]||0);
  root.style.setProperty('--lumen-safe-'+edge,inset+'px');
 }
}

export function showHome(mount,html,tg){
 document.documentElement.classList.add('lumen-menu-active','lumen-active');
 menuViewport(tg);
 if(tg?.isVersionAtLeast?.('7.7')){try{tg.disableVerticalSwipes();}catch(_){}}
 mount.innerHTML=html;
 const background=mount.querySelector('.lumen-menu-background');
 background.src=menuBackgroundURL(background.dataset.backgroundMap);
 window.MenuUI?.apply();
 mount.querySelector('.lumen-main-actions [data-lumen-value="play"]')?.focus({preventScroll:true});
}

export function showMenuLoading(mount,{closeAction='menu',retryAction='menu',page='home',error=false}={}){
 const shell=mount.querySelector('.lumen-shell');
 if(!shell)return;
 shell.dataset.page='loading';
 for(const element of shell.querySelectorAll('.lumen-title-screen,.lumen-menu-top,.lumen-menu-footer')){
  element.inert=true;element.setAttribute('aria-hidden','true');
 }
 shell.querySelector('.lumen-window-wrap')?.remove();
 const retryLabel=retryAction==='refresh'?'Обновить приложение':'Повторить';
 shell.insertAdjacentHTML('beforeend',`<div class="lumen-window-wrap"><section class="lumen-game-window" role="dialog" aria-modal="true" aria-labelledby="lumenLoadingHeading"><header class="lumen-window-toolbar"><span id="lumenLoadingHeading">Люмен</span><button type="button" data-lumen-action="${closeAction}" data-lumen-value="home" aria-label="Закрыть окно">×</button></header><div class="lumen-menu-content">${error?'<p role="alert">Не удалось загрузить ресурсы. Проверь соединение.</p><button class="lumen-secondary-button" type="button" data-lumen-action="'+retryAction+'" data-lumen-value="'+page+'">'+retryLabel+'</button>':'<p role="status">Подготавливаем ресурсы…</p>'}</div></section></div>`);
 shell.querySelector(error?'.lumen-menu-content button':'.lumen-window-toolbar button')?.focus({preventScroll:true});
}
