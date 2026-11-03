export const GARDEN_ARENA_RADIUS=620;
export const GARDEN_COVER_HP=90;
export const QUARRY_ARENA_RADIUS=590;
const layouts={
  garden:{hp:GARDEN_COVER_HP,radius:34,points:[[-250,-220],[250,-220],[-342,30],[342,30],[-193,270],[193,270]]},
  quarry:{hp:105,radius:41,points:[[-230,-200],[230,-200],[-355,62],[355,62],[-205,285],[205,285]]},
  castle:{hp:110,radius:39,points:[[-380,-285],[380,-285],[-520,0],[520,0],[-290,300],[290,300]]},
};

export const gardenFinalReady=state=>state.map==='garden'&&state.level>=30&&state.bossesDefeated===3;
export const createArenaCover=kind=>layouts[kind].points.map(()=>layouts[kind].hp);
export function validArenaCover(kind,hp){
  const layout=layouts[kind];
  return Array.isArray(hp)&&hp.length===layout.points.length&&
    layout.points.every((_,i)=>Number.isFinite(hp[i])&&hp[i]>=0&&hp[i]<=layout.hp);
}

export function arenaCover(arena){
  if(!arena?.cover||!Object.hasOwn(layouts,arena.kind))return [];
  const {points,radius,hp:maxHp}=layouts[arena.kind];
  return points.map(([x,y],index)=>({kind:'arena-cover',index,x:arena.x+x,y:arena.y+y,radius,maxHp,hp:arena.cover[index]}));
}

/** Return the first intact pillar crossed by a hostile shot or beam. */
export function strikeArenaCover(state,from,to,damage,width=0){
  const arena=state.arena;
  if(!arena?.cover)return null;
  const layout=layouts[arena.kind];
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
  if(!length)return null;
  const ux=dx/length,uy=dy/length,radius=layout.radius+width;
  let hit=-1,first=length;
  for(let i=0;i<layout.points.length;i++){
    if(arena.cover[i]<=0)continue;
    const [ox,oy]=layout.points[i],x=arena.x+ox-from.x,y=arena.y+oy-from.y;
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
