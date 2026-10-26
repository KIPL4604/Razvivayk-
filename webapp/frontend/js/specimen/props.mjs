// Shared dimensions/materials: drawing, cargo, navigation and collision use these.
export const PROP_TYPES=Object.freeze({
  desk:{w:64,h:36,hp:3,material:'metal',slot:0,offsetY:8,parts:true},
  chair:{w:22,h:36,hp:2,material:'plastic',slot:1},
  monitor:{w:28,h:26,hp:2,material:'plastic',slot:2},
  tubes:{w:30,h:16,hp:1,material:'glass',slot:3},
  woodbox:{w:32,h:32,hp:2,material:'wood',slot:4,cargo:true,mass:.9},
  woodlong:{w:56,h:32,hp:2,material:'wood',slot:5,cargo:true,mass:1.5},
  microscope:{w:24,h:28,hp:2,material:'metal',slot:9},
  cabinet:{w:32,h:58,hp:3,material:'metal',slot:10}
});
export const isScientist=e=>e.kind==='scientist'||e.kind==='tech';
export const isMilitary=e=>e.kind==='guard'||e.kind==='flamer';
export const isCargo=o=>o.kind==='crate'||PROP_TYPES[o.kind]?.cargo===true;
export const isFragile=o=>!!PROP_TYPES[o.kind]||o.kind==='glass'||o.kind==='panel';
const colliderCache=new WeakMap(),EMPTY=Object.freeze([]);
export function propBounds(o){
  const type=PROP_TYPES[o.kind];
  return{x:o.x-(o.w||type?.w||32)/2,y:o.y+(type?.offsetY||0)-(o.h||type?.h||32)/2,w:o.w||type?.w||32,h:o.h||type?.h||32};
}
export function propRects(o){
  if(o.broken||(!isFragile(o)&&!isCargo(o)))return EMPTY;
  const old=colliderCache.get(o);
  if(old&&old.x===o.x&&old.y===o.y&&old.w===o.w&&old.h===o.h)return old.rects;
  const b=propBounds(o);
  const rects=PROP_TYPES[o.kind]?.parts?[
    {...b,h:6},{x:b.x+3,y:b.y+6,w:5,h:b.h-6},{x:b.x+b.w-8,y:b.y+6,w:5,h:b.h-6}
  ]:[b];
  colliderCache.set(o,{x:o.x,y:o.y,w:o.w,h:o.h,rects});return rects;
}
export function makeProp(id,kind,x,y,extra={}){
  const type=PROP_TYPES[kind];
  return{id,kind,x,y,w:type.w,h:type.h,hp:type.hp,broken:false,...(type.cargo?{vx:0,vy:0,spin:0,angle:0,thrown:false}:{}),...extra};
}
