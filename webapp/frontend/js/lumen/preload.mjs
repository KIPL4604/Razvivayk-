import {assetBytes,progressReporter} from './asset-cache.mjs';
import {latestMenuMap,menuBackgroundFile} from './menu-background.mjs';
import {preloadWeaponIcons} from './weapon-icons.mjs';
import {WEAPON_ICONS} from './weapon-icon-data.mjs';
const base=new URL('../../assets/lumen/',import.meta.url),urls=new Map(),decoded=new Map();
let manifestPromise,fontPromise;
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
export const backgroundReady=meta=>decoded.has(menuBackgroundFile(latestMenuMap(meta)));
export async function preloadMenuBackground(meta,onProgress){
 const value=await manifest(),file=menuBackgroundFile(latestMenuMap(meta));
 const entry=value.backgrounds.find(entry=>entry.file===file);
 if(!entry)throw new Error('Map background unavailable');
 await batch([entry],onProgress);
}
export async function preloadMenu(onProgress,meta){
 const value=await manifest(),file=menuBackgroundFile(latestMenuMap(meta));
 const background=value.backgrounds.find(entry=>entry.file===file);
 if(!background)throw new Error('Map background unavailable');
 await batch([...value.files,background],onProgress);
 if(!await preloadWeaponIcons(Object.keys(WEAPON_ICONS),{visible:true}))throw new Error('Weapon artwork unavailable');
 fontPromise ||= (async()=>{const font=new FontFace('LumenSquare',`url("${assetURL('fonts/Tektur-game.ttf')}")`);await font.load();document.fonts.add(font);})().catch(error=>{fontPromise=null;throw error;});
 await fontPromise;
 for(const [file,id]of [['ui.png','ui'],['panel.png','panel'],['weapons.png','weapons'],['arsenal.png','arsenal'],['expedition.png','expedition'],['expansion-items.png','expansion']])document.documentElement.style.setProperty('--lumen-cached-'+id,`url("${assetURL(file)}")`);
 document.documentElement.style.setProperty('--lumen-cached-scout',`url("${assetURL('scout.png')}")`);
 onProgress?.({phase:'ready',percent:100,remainingSeconds:0});
 // Retire only the old public reel files; game worlds and personal saves stay intact.
 try{const cache=await caches.open('teramont-lumen-assets-v1');for(const key of await cache.keys())if(/\/lumen\/menu-(loop\.(mp4|webm)|poster\.jpg)$/.test(new URL(key.url).pathname))await cache.delete(key);}catch(_){}
}
export async function preloadScene(scene,hero,onProgress){
 const value=await manifest(),world=scene.map||'garden';
 const names=new Set([`story-world-${world}-small.webp`,`story-world-${world}.webp`,`story-hero-${hero}.png`,...(scene.portrait?[`story-${scene.portrait}.png`]:[])]);
 const entries=[...value.files,...value.scenes].filter(e=>names.has(e.file));
 if(entries.length!==names.size)throw new Error('Incomplete scene manifest');
 await batch(entries,onProgress);
}
