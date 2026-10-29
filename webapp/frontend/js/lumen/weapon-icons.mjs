import {WEAPON_ICONS} from './weapon-icon-data.mjs';

const base=new URL('../../assets/lumen/',import.meta.url);
const ready=new Map(),pending=new Map(),retryAt=new Map(),queue=[];
let active=0;
let visibleScan=false,observer;
const watched=new WeakSet(),observing=new Set();

function watchVisibleIcons(){
 if(visibleScan)return;visibleScan=true;
 queueMicrotask(()=>{
  visibleScan=false;
  if(typeof IntersectionObserver==='function')observer ||= new IntersectionObserver(entries=>{
   const visible=entries.filter(entry=>entry.isIntersecting);
   visible.forEach(entry=>{observer.unobserve(entry.target);observing.delete(entry.target);});
   if(visible.length)void preloadWeaponIcons(visible.map(entry=>entry.target.dataset.weaponIcon),{visible:true});
  });
  for(const icon of observing)if(!icon.isConnected){observer.unobserve(icon);observing.delete(icon);}
  for(const icon of document.querySelectorAll('[data-weapon-icon]')){
   if(watched.has(icon))continue;watched.add(icon);
   if(observer){observing.add(icon);observer.observe(icon);}
   else if(icon.getClientRects().length)void preloadWeaponIcons([icon.dataset.weaponIcon],{visible:true});
  }
 });
}

function drain(){
 while(active<2&&queue.length){
  const {id,resolve}=queue.shift();active++;
  (async()=>{
   let url;
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12_000);
   try{
    const response=await fetch(new URL(WEAPON_ICONS[id].file,base),{signal:controller.signal,priority:'low'});
    if(!response.ok)throw new Error('Weapon icon unavailable');
    const blob=await response.blob();if(blob.size!==WEAPON_ICONS[id].bytes)throw new Error('Incomplete weapon icon');
    url=URL.createObjectURL(blob);const image=new Image();image.src=url;await image.decode();
    if(image.naturalWidth!==48||image.naturalHeight!==48)throw new Error('Invalid weapon icon');
    ready.set(id,url);retryAt.delete(id);document.documentElement.style.setProperty('--lumen-weapon-'+id,`url("${url}")`);
    document.documentElement.style.setProperty('--lumen-weapon-placeholder-'+id,'none');
    resolve(true);
   }catch(_){if(url)URL.revokeObjectURL(url);retryAt.set(id,performance.now()+30_000);resolve(false);}
   finally{clearTimeout(timeout);pending.delete(id);active--;drain();}
  })();
 }
}

/** Bounded, nonblocking prefetch. Reads IDs only; it cannot roll an upgrade. */
export function preloadWeaponIcons(ids=[],{visible=false}={}){
 const requests=[...new Set(ids)].filter(id=>Object.hasOwn(WEAPON_ICONS,id)).map(id=>{
  if(ready.has(id))return Promise.resolve(true);
  if(!visible&&(retryAt.get(id)||0)>performance.now())return Promise.resolve(false);
  if(!pending.has(id)){
   let resolve;const promise=new Promise(done=>resolve=done);pending.set(id,promise);queue.push({id,resolve});
  }
  return pending.get(id);
 });
 queueMicrotask(drain);return Promise.all(requests).then(results=>results.every(Boolean));
}

/** Existing dimensions/classes stay intact; the bitmap is shared as a blob URL. */
export function weaponIcon(id){
 if(!Object.hasOwn(WEAPON_ICONS,id))return '';
 const source=WEAPON_ICONS[id].source,className=source==='weapons.png'?'lumen-weapon-icon':source==='expedition.png'?'lumen-new-icon':'lumen-expansion-icon';
 watchVisibleIcons();
 return `<span class="${className}" data-weapon-icon="${id}" style="position:relative;background-image:var(--lumen-weapon-${id},none);background-size:100% 100%;background-position:center" aria-hidden="true"><span class="lumen-pixel-icon" style="--icon:14;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:var(--lumen-weapon-placeholder-${id},inline-block)"></span></span>`;
}

export const prefetchWeaponChoices=preloadWeaponIcons;
