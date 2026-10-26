import {ROOMS,WIDTH,HEIGHT} from './world.mjs';
import {NAV} from './tuning.mjs';
import {propRects} from './props.mjs';
const cache=new WeakMap();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function free(s,x,floor,solid){
  for(const h of [6,14,22,30,38,46,54]){
    const half=h>42?6:NAV.bodyHalf;
    if(solid(s,x,floor-h)||solid(s,x-half,floor-h)||solid(s,x+half,floor-h))return false;
  }
  return true;
}
function graph(s,solid){
  const room=s.rooms[s.room],key=s.room+':'+(room.navRevision||0)+':'+room.gateOpen+':'+(s.mass>36);
  let saved=cache.get(s);if(saved?.key===key)return saved;
  const nodes=[],columns=new Map(),add=(x,floor,virtual=false)=>{
    const existing=nodes.find(n=>n.x===x&&n.floor===floor);
    if(existing)return existing;
    const n={id:nodes.length,x,y:floor-26,floor,virtual,edges:[]};nodes.push(n);
    const col=columns.get(x)||[];col.push(n);columns.set(x,col);return n;
  };
  const levels=new Set();for(let y=96;y<=HEIGHT-48;y+=NAV.grid)levels.add(y);
  for(const o of room.objects)for(const b of propRects(o))if(b.y>=96&&b.y<=HEIGHT-48)levels.add(b.y);
  for(const b of ROOMS[s.room].treads)levels.add(b.y);
  for(let x=NAV.grid/2+48;x<WIDTH-48;x+=NAV.grid)for(const floor of levels){
    if(solid(s,x,floor+1)&&!solid(s,x,floor-1)&&free(s,x,floor,solid))add(x,floor);
  }
  const link=(a,b,kind='walk',ladder=null)=>{
    if(!a||!b||a===b||a.edges.some(e=>e.to===b.id))return;
    a.edges.push({to:b.id,kind,ladder,cost:distance(a,b)*(kind==='climb'?NAV.climbCost:1)});
    b.edges.push({to:a.id,kind,ladder,cost:distance(a,b)*(kind==='climb'?NAV.climbCost:1)});
  };
  for(const a of nodes)for(const b of columns.get(a.x+NAV.grid)||[]){
    if(Math.abs(b.floor-a.floor)>NAV.maxStep)continue;
    const raised=Math.min(a.floor,b.floor);
    if(free(s,(a.x+b.x)/2,raised,solid))link(a,b);
  }
  for(const [x,top,bottom] of ROOMS[s.room].ladders){
    if(!free(s,x,top,solid)||!free(s,x,bottom,solid))continue;
    const a=add(x,top,true),b=add(x,bottom,true);
    a.ladder=b.ladder={x,top,bottom};
    link(a,b,'climb',{x,top,bottom});
    for(const end of [a,b])for(const n of nodes){
      if(n.virtual||Math.abs(n.floor-end.floor)>NAV.grid||Math.abs(n.x-x)>NAV.landingReach)continue;
      let clear=true;
      for(let t=0;t<=1;t+=.2)if(!free(s,x+(n.x-x)*t,Math.min(n.floor,end.floor),solid)){clear=false;break;}
      if(clear)link(end,n,'landing',{x,top,bottom});
    }
  }
  saved={key,nodes};cache.set(s,saved);return saved;
}
function nearest(nodes,x,y){let best=null,d=Infinity;for(const n of nodes){const score=Math.abs(n.x-x)+Math.abs(n.y-y)*NAV.verticalWeight;if(score<d){d=score;best=n;}}return best;}
export function planHuman(s,e,goal,solid,flee=false){
  const g=graph(s,solid),start=nearest(g.nodes,e.x,e.y);if(!start)return [];
  const costs=new Map([[start.id,0]]),prev=new Map(),open=[start.id],closed=new Set();
  while(open.length){
    open.sort((a,b)=>costs.get(a)-costs.get(b));const id=open.shift();if(closed.has(id))continue;closed.add(id);
    for(const edge of g.nodes[id].edges){
      const danger=flee?Math.max(0,NAV.dangerRadius-distance(g.nodes[edge.to],goal))*NAV.dangerWeight:0;
      const c=costs.get(id)+edge.cost+danger;if(c>=(costs.get(edge.to)??Infinity))continue;
      costs.set(edge.to,c);prev.set(edge.to,{from:id,...edge});open.push(edge.to);
    }
  }
  let target=flee?start:nearest(g.nodes.filter(n=>costs.has(n.id)),goal.x,goal.y),score=-Infinity;
  if(flee)for(const n of g.nodes){
    if(!costs.has(n.id))continue;
    const value=distance(n,goal)-costs.get(n.id)*NAV.escapeTravelPenalty+(n.floor!==start.floor?NAV.levelSafety:0);
    if(value>score){score=value;target=n;}
  }
  if(!target)return [];
  const route=[];let id=target.id;
  while(id!==start.id){const edge=prev.get(id);if(!edge)return [];route.unshift({...g.nodes[id],kind:edge.kind,ladder:edge.ladder});id=edge.from;}
  // First approach is on the actor's present landing. Never snap to a graph node.
  return [{...start,kind:e.climbing?'climb':start.virtual?'landing':'walk',ladder:e.climbing?.ladder||start.ladder},...route];
}
export function navigateHuman(s,e,goal,dt,solid,move,{flee=false,speed=NAV.walkSpeed}={}){
  e.repath=Math.max(0,(e.repath||0)-dt);
  const stamp=s.rooms[s.room].navRevision||0;
  if(!e.route?.length||(!e.climbing&&(!e.repath||stamp!==e.routeRevision))){
    e.route=planHuman(s,e,goal,solid,flee);e.repath=NAV.repath;e.routeRevision=stamp;
  }
  const target=e.route?.[0];if(!target){e.walking=false;return false;}
  const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy);
  if(d<NAV.arrival){e.route.shift();if(target.kind==='climb'||target.kind==='landing')e.climbing=null;return !e.route.length;}
  const climbing=target.kind==='climb'||target.kind==='landing'||!!e.climbing;
  if(climbing){
    e.climbing={ladder:target.ladder};const amount=Math.min(1,(target.kind==='climb'?NAV.climbSpeed:speed)*dt/(d||1));
    const b={x:e.x,y:e.y+12,r:14,npc:true,climbing:true};move(s,b,dx*amount,dy*amount);
    const moved=Math.hypot(b.x-e.x,b.y-e.y-12);e.x=b.x;e.y=b.y-12;e.walking=true;e.vy=0;e.vx=0;e.climbPhase=(e.climbPhase||0)+moved/NAV.rungSpacing;
  }else{
    const amount=Math.min(Math.abs(dx),speed*dt),stepX=Math.sign(dx)*amount;
    const b={x:e.x,y:e.y+12,r:14,npc:true};
    const lift=Math.max(0,e.y-target.y);
    if(lift<=NAV.maxStep&&lift)move(s,b,0,-lift);
    const before=b.x;move(s,b,stepX,Math.max(0,target.y-e.y));
    e.x=b.x;e.y=b.y-12;e.walking=Math.abs(b.x-before)>.05;e.vx=0;
    if(solid(s,e.x,e.y+27))e.vy=0;
    if(!e.walking){e.route=[];e.repath=0;}
  }
  if(Math.abs(dx)>1)e.dir=Math.sign(dx);
  return false;
}
