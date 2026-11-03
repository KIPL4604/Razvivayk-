import {assetBytes,progressReporter} from './asset-cache.mjs';
import {latestMenuMap,menuBackgroundFile} from './menu-background.mjs';
import {preloadWeaponIcons} from './weapon-icons.mjs';
import {CHARACTERS} from './catalog.mjs';
import {WEAPON_ICONS} from './weapon-icon-data.mjs';
const base=new URL('../../assets/lumen/',import.meta.url),urls=new Map(),decoded=new Map();
let manifestPromise,fontPromise,fontReady=false,weaponsReady=false;
const pendingBackgrounds=new Map();
const previewFile=map=>menuBackgroundFile(map).slice(0,-5)+'-preview.webp';
async function manifest(){
 manifestPromise ||= fetch(new URL('menu-manifest.json',base),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Menu manifest unavailable');return r.json();}).catch(e=>{manifestPromise=null;throw e;});
 return manifestPromise;
}
export const assetURL=name=>urls.get(name)||new URL(name,base).href;
export function assetHTML(html){return html.replace(/\/static\/assets\/lumen\/([a-zA-Z0-9_./-]+)/g,(original,name)=>urls.get(name)||original);}
async function batch(entries,onProgress){
 const report=progressReporter(entries,onProgress);let cursor=0;report(null,0);
 await Promise.all(Array.from({length:Math.min(3,entries.length)},async()=>{
  while(cursor<entries.length){const entry=entries[cursor++];
   const bytes=await assetBytes(entry,size=>report(entry,size));
   if(!urls.has(entry.file))urls.set(entry.file,URL.createObjectURL(new Blob([bytes],{type:entry.file.endsWith('.mp4')?'video/mp4':entry.file.endsWith('.webp')?'image/webp':entry.file.endsWith('.png')?'image/png':entry.file.endsWith('.jpg')?'image/jpeg':'font/ttf'})));
   if(/\.(png|webp|jpg)$/.test(entry.file)&&!decoded.has(entry.file)){
    const img=new Image();img.src=urls.get(entry.file);await img.decode();decoded.set(entry.file,img);
   }
  }
 }));report(null,0,'decode');
}
export function menuBackgroundURL(map){
 const file=menuBackgroundFile(map);
 return assetURL(decoded.has(file)?file:previewFile(map));
}
export const backgroundReady=meta=>decoded.has(previewFile(latestMenuMap(meta)));
function upgradeBackground(map,entry){
 if(!entry||pendingBackgrounds.has(map)||decoded.has(entry.file))return;
 pendingBackgrounds.set(map,batch([entry]).then(()=>{
  const url=assetURL(entry.file);
  document.querySelectorAll('img[data-background-map="'+map+'"]').forEach(image=>{image.src=url;});
 }).catch(()=>{}).finally(()=>pendingBackgrounds.delete(map)));
}
export async function preloadMenuBackground(meta,onProgress){
 const value=await manifest(),map=latestMenuMap(meta);
 const preview=value.backgrounds.find(entry=>entry.file===previewFile(map));
 if(!preview)throw new Error('Map preview unavailable');
 await batch([preview],onProgress);
 upgradeBackground(map,value.backgrounds.find(entry=>entry.file===menuBackgroundFile(map)));
}
const CORE_UI=['fonts/Tektur-game.ttf','ui.png','panel.png','weapons.png','arsenal.png','expedition.png','expansion-items.png','scout.png'];
function installSprites(){
 for(const [file,id]of [['ui.png','ui'],['panel.png','panel'],['weapons.png','weapons'],['arsenal.png','arsenal'],['expedition.png','expedition'],['expansion-items.png','expansion'],['scout.png','scout']]){
  if(urls.has(file))document.documentElement.style.setProperty('--lumen-cached-'+id,`url("${assetURL(file)}")`);
 }
}
async function font(){
 fontPromise ||= (async()=>{const face=new FontFace('LumenSquare',`url("${assetURL('fonts/Tektur-game.ttf')}")`);await face.load();document.fonts.add(face);fontReady=true;})().catch(error=>{fontPromise=null;throw error;});
 await fontPromise;
}
function finish(onProgress){onProgress?.({phase:'ready',percent:100,remainingSeconds:0});}
export async function preloadMenu(onProgress,meta){
 const value=await manifest(),map=latestMenuMap(meta);
 const preview=value.backgrounds.find(entry=>entry.file===previewFile(map));
 const coin=value.files.find(entry=>entry.file==='menu-coin.png');
 if(!preview||!coin)throw new Error('Incomplete title assets');
 await batch([preview,coin],onProgress);
 document.documentElement.style.setProperty('--lumen-menu-coin','url("'+assetURL(coin.file)+'")');
 finish(onProgress);
 upgradeBackground(map,value.backgrounds.find(entry=>entry.file===menuBackgroundFile(map)));
}
const weaponFiles=Object.values(WEAPON_ICONS).map(entry=>entry.file);
async function installWeaponIcons(){
 if(weaponsReady)return;
 if(!await preloadWeaponIcons(Object.keys(WEAPON_ICONS),{visible:true}))throw new Error('Weapon artwork unavailable');
 weaponsReady=true;
}
function menuPageFiles(page,{map,character}){
 switch(page){
  case 'play':return [character+'.png', 'story-world-'+map+'-small.webp'];
  case 'characters':return Object.keys(CHARACTERS).map(id=>id+'.png');
  case 'weapons':return [...weaponFiles,'expedition.png','expansion-items.png'];
  case 'training':return ['ui.png','expedition.png','expansion-items.png'];
  default:return [];
 }
}
export function menuPageReady(page,selection){
 return menuPageFiles(page,selection).every(file=>decoded.has(file))
   && (page!=='play'||fontReady)
   && (page!=='weapons'||weaponsReady);
}
export async function preloadMenuPage(page,selection){
 const value=await manifest(),files=menuPageFiles(page,selection);
 const names=new Set(page==='play'?[...files,'fonts/Tektur-game.ttf']:files);
 const entries=value.files.filter(entry=>names.has(entry.file));
 if(entries.length!==names.size)throw new Error('Incomplete menu page manifest');
 await batch(entries);installSprites();
 if(page==='play')await font();
 if(page==='weapons')await installWeaponIcons();
}
export async function preloadScene(scene,hero,onProgress,{previewLandscape=false}={}){
 const value=await manifest(),world=scene.map||'garden';
 const names=new Set([...CORE_UI,`story-world-${world}-small.webp`,...(!previewLandscape?[`story-world-${world}.webp`]:[]),`story-hero-${hero}.png`,...(scene.portrait?[`story-${scene.portrait}.png`]:[])]);
 const entries=[...value.files,...value.scenes].filter(e=>names.has(e.file));
 if(entries.length!==names.size)throw new Error('Incomplete scene manifest');
 await batch(entries,onProgress);installSprites();await font();
}
export async function loadSceneDetail(world){
 const value=await manifest(),file=`story-world-${world}.webp`;
 const entry=value.scenes.find(item=>item.file===file);
 if(!entry)throw new Error('Incomplete scene manifest');
 await batch([entry]);
 return assetURL(file);
}
