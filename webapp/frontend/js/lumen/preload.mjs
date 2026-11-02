import {assetBytes,progressReporter} from './asset-cache.mjs';
import {preloadWeaponIcons} from './weapon-icons.mjs';
import {WEAPON_ICONS} from './weapon-icon-data.mjs';
const base=new URL('../../assets/lumen/',import.meta.url),urls=new Map(),decoded=new Map();
let manifestPromise,menuPromise,lastMenuProgress;
const menuListeners=new Set();
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
export async function preloadMenu(onProgress){
 if(onProgress){menuListeners.add(onProgress);if(lastMenuProgress)onProgress(lastMenuProgress);}
 if(!menuPromise)menuPromise=(async()=>{
  const emit=value=>{lastMenuProgress=value;menuListeners.forEach(listener=>listener(value));};
  const value=await manifest();
  // Finish the reel first so other image requests cannot starve its transfer.
  const videoEntry=value.files.find(e=>e.file==='menu-loop.mp4'),rest=value.files.filter(e=>e!==videoEntry);
  const report=progressReporter(value.files,emit);
  await batch([videoEntry],p=>report(videoEntry,p.received,'video'));
  await batch(rest,p=>{
   // The nested batch reports aggregate bytes; its synthetic key never enters the cache.
   report({file:'menu-images'},p.received,p.phase==='decode'?'decode':'images');
  });
  if(!await preloadWeaponIcons(Object.keys(WEAPON_ICONS),{visible:true}))throw new Error('Weapon artwork unavailable');
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.src=assetURL('menu-loop.mp4');
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{clean();reject(new Error('Video decode timeout'));},15000);const clean=()=>{clearTimeout(timer);video.onloadeddata=null;video.onerror=null;};video.onloadeddata=()=>{clean();resolve();};video.onerror=()=>{clean();reject(new Error('Video decode failed'));};video.load();});
  video.pause();video.removeAttribute('src');video.load();
  const font=new FontFace('LumenSquare',`url("${assetURL('fonts/Tektur-game.ttf')}")`);await font.load();document.fonts.add(font);
  for(const [file,id]of [['ui.png','ui'],['panel.png','panel'],['weapons.png','weapons'],['arsenal.png','arsenal'],['expedition.png','expedition'],['expansion-items.png','expansion']])document.documentElement.style.setProperty('--lumen-cached-'+id,`url("${assetURL(file)}")`);
  document.documentElement.style.setProperty('--lumen-cached-scout',`url("${assetURL('scout.png')}")`);
  emit({phase:'ready',percent:100,remainingSeconds:0});
 })().catch(e=>{menuPromise=null;throw e;});
 try{return await menuPromise;}finally{menuListeners.delete(onProgress);}
}
export async function preloadScene(scene,hero,onProgress){
 const value=await manifest(),world=scene.map||'garden';
 const names=new Set([`story-world-${world}-small.webp`,`story-world-${world}.webp`,`story-hero-${hero}.png`,...(scene.portrait?[`story-${scene.portrait}.png`]:[])]);
 const entries=[...value.files,...value.scenes].filter(e=>names.has(e.file));
 if(entries.length!==names.size)throw new Error('Incomplete scene manifest');
 await batch(entries,onProgress);
}
