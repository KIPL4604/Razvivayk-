import {restore,ROOMS} from './engine.mjs';
export function latestMenuSector(record){
 if(record?.completed===true)return ROOMS.length-1;
 const states=[restore(record?.run),restore(record?.checkpoint)].filter(Boolean);
 return Math.max(0,...states.flatMap(state=>[state.room,...state.visited]));
}
