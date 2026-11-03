export const GARDEN_ARENA_RADIUS=620;
export const GARDEN_COVER_HP=90;
const layout=[[-250,-220],[250,-220],[-342,30],[342,30],[-193,270],[193,270]];

export const gardenFinalReady=state=>state.map==='garden'&&state.level>=30&&state.bossesDefeated===3;
export const createGardenCover=()=>layout.map(()=>GARDEN_COVER_HP);
export const validGardenCover=hp=>Array.isArray(hp)&&hp.length===layout.length&&
  layout.every((_,i)=>Number.isFinite(hp[i])&&hp[i]>=0&&hp[i]<=GARDEN_COVER_HP);

export function gardenCover(arena){
  if(arena?.kind!=='garden')return [];
  return layout.map(([x,y],index)=>({kind:'arena-cover',index,x:arena.x+x,y:arena.y+y,radius:34,hp:arena.cover[index]}));
}

/** Return the first intact pillar crossed by a hostile shot or beam. */
export function strikeGardenCover(state,from,to,damage,width=0){
  const arena=state.arena;
  if(arena?.kind!=='garden')return null;
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
  if(!length)return null;
  const ux=dx/length,uy=dy/length,radius=34+width;
  let hit=-1,first=length;
  for(let i=0;i<layout.length;i++){
    if(arena.cover[i]<=0)continue;
    const [ox,oy]=layout[i],x=arena.x+ox-from.x,y=arena.y+oy-from.y;
    const along=x*ux+y*uy,side=x*uy-y*ux;
    if(Math.abs(side)>radius)continue;
    const half=Math.sqrt(radius**2-side**2),enter=Math.max(0,along-half);
    if(along+half<0||enter>first)continue;
    first=enter;hit=i;
  }
  if(hit<0)return null;
  arena.cover[hit]=Math.max(0,arena.cover[hit]-damage);
  return {x:from.x+ux*first,y:from.y+uy*first,distance:first};
}
