import {TENDRIL as P} from './tuning.mjs';
import {tickFilament} from './filament.mjs';
import {isCargo} from './props.mjs';
// One offensive appendage, independent of planted locomotion supports.
// Sweep in <=2px steps: the first wall or target always wins.
export function tickTendril(s,held,targets,solid,dt){
  s.tendrilCooldown=Math.max(0,(s.tendrilCooldown||0)-dt);
  let t=s.tendril;
  if(!t&&held&&!s.grab&&!s.tendrilCooldown){t=s.tendril={x:s.x,y:s.y,dx:s.aimX,dy:s.aimY,travel:0,phase:'extend',path:null};}
  if(!t)return null;
  if(!held||s.grab)t.phase='retract';
  let hit=null;
  if(t.phase==='extend'){
    const reach=s.attackReach,advance=Math.max(0,Math.min(P.speed*dt,reach-t.travel)),count=Math.max(1,Math.ceil(advance/P.sweepStep));
    for(let i=0;i<count;i++){
      const x=t.x+t.dx*advance/count,y=t.y+t.dy*advance/count;
      if(solid(s,x,y)||Math.hypot(x-s.x,y-s.y)>reach){t.phase='retract';t.wall=true;break;}
      t.x=x;t.y=y;t.travel+=advance/count;
      hit=targets.find(o=>Math.hypot(o.x-x,o.y-y)<P.radius+(o.type==='enemy'?P.humanRadius:isCargo(o)?Math.max(o.w||32,o.h||32)/2:P.objectRadius));
      if(hit){t.phase='retract';break;}
    }
    if(t.travel>=reach-.01)t.phase='retract';
  }else{
    const dx=s.x-t.x,dy=s.y-t.y,d=Math.hypot(dx,dy),amount=Math.min(1,P.retract*dt/(d||1));t.x+=dx*amount;t.y+=dy*amount;
    if(amount===1){s.tendril=null;s.tendrilCooldown=P.retry;return null;}
  }
  const root=s.nodes[0],distance=Math.hypot(t.x-root.x,t.y-root.y);
  if(distance>s.attackReach){const amount=s.attackReach/distance;t.x=root.x+(t.x-root.x)*amount;t.y=root.y+(t.y-root.y)*amount;t.phase='retract';hit=null;}
  const samples=Math.max(1,Math.ceil(Math.hypot(t.x-root.x,t.y-root.y)/P.sweepStep));
  for(let i=1;i<samples;i++)if(solid(s,root.x+(t.x-root.x)*i/samples,root.y+(t.y-root.y)*i/samples)){
    t.x=root.x+(t.x-root.x)*(i-1)/samples;t.y=root.y+(t.y-root.y)*(i-1)/samples;t.phase='retract';hit=null;break;
  }
  tickFilament(s,t,s.nodes[0],t,t.phase==='extend'?P.extendTaut:P.retractTaut,solid,dt);
  return hit?{id:hit.id,type:hit.type}:null;
}
