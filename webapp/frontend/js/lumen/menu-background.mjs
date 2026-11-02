import {mapAvailable,normalizeMeta} from './economy.mjs';
export function latestMenuMap(meta){
 const safe=normalizeMeta(meta);
 return ['castle','quarry','garden'].find(id=>mapAvailable(safe,id))||'garden';
}
export const menuBackgroundFile=map=>'menu-backgrounds/'+map+'.webp';
