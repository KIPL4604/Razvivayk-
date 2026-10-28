import {WEAPONS,weaponStats} from './catalog.mjs';

export const EXPANSION_WEAPON_IDS=Object.freeze(['needle','fan','bell','mine','frostnova','drone','meteor','gravity','sunlance','eclipse']);
export const EXPANSION_ZONE_KINDS=Object.freeze(['mine','meteor','gravity']);
const TAU=Math.PI*2;
const squared=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;

// New attacks share the original hit/XP/loot pipeline and bounded state arrays.
export function updateExpansionWeapons(state,dt,{hit,effect,limits}){
  const p=state.player,scale=(1+(state.upgrades.focus||0)*.2)*(1+(state.training?.lens||0)*.01);
  const haste=1+(state.upgrades.haste||0)*.15+(state.upgrades.chronogear||0)*.12+(state.relicState?.surge>0?(state.upgrades.hourglass||0)*.2:0);
  const area=1+(state.upgrades.amplifier||0)*.12;
  function nearest(from,range=650,seen=[]){
    let target=null,distance=range*range;
    for(const e of state.enemies){
      if(e.hp<=0||e.kind==='arena-tick'||seen.includes(e.id))continue;
      const d=squared(e,from);if(d<distance){distance=d;target=e;}
    }
    return target;
  }
  function emit(kind,x,y,radius,life,weapon){
    if(state.effects.length>=limits.effects)state.effects.shift();
    effect(state,kind,x,y,radius,life);
    const event=state.effects.at(-1);if(weapon)event.weapon=weapon;return event;
  }
  function blast(center,damage,push=0,weapon){
    for(const e of state.enemies)if(e.hp>0&&squared(e,center)<(center.radius+e.radius)**2){
      hit(state,e,damage,e.kind==='guardian'?push*.18:e.elite?push*.4:push,weapon);
    }
  }
  function plant(kind,x,y,stats,maxLife,tick=0){
    if(state.zones.length>=limits.zones)state.zones.shift();
    state.zones.push({id:state.nextId++,kind,x,y,radius:stats.radius*area,damage:stats.damage*scale,life:maxLife,maxLife,tick});
  }
  function shoot(id,stats,target,index){
    if(state.projectiles.length>=limits.projectiles)return;
    const offset=index-(stats.count-1)/2;
    const origin=id==='drone'?{x:p.x+Math.cos(state.orbitAngle+index/stats.count*TAU)*20,y:p.y+Math.sin(state.orbitAngle+index/stats.count*TAU)*20}:p;
    const angle=Math.atan2(target.y-origin.y,target.x-origin.x)+offset*(id==='fan'?.21:id==='needle'?.055:0);
    state.projectiles.push({id:state.nextId++,x:origin.x,y:origin.y,vx:Math.cos(angle)*stats.speed,vy:Math.sin(angle)*stats.speed,
      radius:stats.radius*area,damage:stats.damage*scale,life:id==='drone'?2.4:1.6,hostile:false,weapon:id,pierce:stats.pierce||0,hits:[],returning:false});
  }

  for(const z of state.zones){
    if(!EXPANSION_ZONE_KINDS.includes(z.kind))continue;
    z.life-=dt;z.tick=Math.max(0,z.tick-dt);
    if(z.kind==='meteor'){
      if(z.life<=0){blast(z,z.damage,24,z.kind);emit('fusion',z.x,z.y,z.radius,.4,z.kind);}
      continue;
    }
    if(z.life<=0)continue;
    if(z.kind==='mine'){
      if(z.tick<=0&&state.enemies.some(e=>e.hp>0&&squared(e,z)<(28*area+e.radius)**2)){
        blast(z,z.damage,32,z.kind);emit('fusion',z.x,z.y,z.radius,.35,z.kind);z.life=0;
      }
      continue;
    }
    for(const e of state.enemies)if(e.hp>0&&squared(e,z)<(z.radius+e.radius)**2){
      e.slowTime=Math.max(e.slowTime||0,.7);
      const dx=z.x-e.x,dy=z.y-e.y,distance=Math.hypot(dx,dy)||1;
      const resistance=(e.kind==='guardian'||e.elite) ? .25 : 1;
      const pull=Math.min(Math.max(0,distance-e.radius-4),dt*65*resistance);
      if(!['arena-tick','arena-boss','castle-door'].includes(e.kind)){e.x+=dx/distance*pull;e.y+=dy/distance*pull;}
      if(z.tick<=0)hit(state,e,z.damage,0,z.kind);
    }
    if(z.tick<=0){z.tick=.45;emit('pulse',z.x,z.y,z.radius,.35,z.kind);}
  }
  state.zones=state.zones.filter(z=>!EXPANSION_ZONE_KINDS.includes(z.kind)||z.life>0);

  // Steering uses the existing projectile position/velocity/hit list, so saves
  // retain the exact flight without a second targeting or randomness system.
  for(const projectile of state.projectiles){
    if(projectile.hostile||projectile.weapon!=='drone'||projectile.life<=0)continue;
    const target=nearest(projectile,700,projectile.hits);if(!target)continue;
    const angle=Math.atan2(projectile.vy,projectile.vx),aim=Math.atan2(target.y-projectile.y,target.x-projectile.x);
    const difference=Math.atan2(Math.sin(aim-angle),Math.cos(aim-angle)),turn=Math.max(-dt*6,Math.min(dt*6,difference));
    const speed=Math.hypot(projectile.vx,projectile.vy);
    projectile.vx=Math.cos(angle+turn)*speed;projectile.vy=Math.sin(angle+turn)*speed;
  }

  for(const id of EXPANSION_WEAPON_IDS){
    const rank=Math.min(WEAPONS[id]?.max||8,state.upgrades[id]||0);if(!rank)continue;
    const timer=Math.max(0,(state.weaponTimers[id]||0)-dt);state.weaponTimers[id]=timer;if(timer>0)continue;
    const stats=weaponStats(id,rank);let target=nearest(p);
    if(['needle','fan','drone','meteor','gravity','sunlance'].includes(id)&&!target)continue;
    if(id==='needle'||id==='fan'||id==='drone'){
      const seen=[];
      for(let n=0;n<stats.count;n++){
        if(id==='drone'){target=nearest(p,650,seen)||nearest(p);seen.push(target.id);}
        shoot(id,stats,target,n);
      }
    }else if(id==='bell'||id==='frostnova'){
      const center={x:p.x,y:p.y,radius:stats.radius*area};
      emit('pulse',p.x,p.y,center.radius,.5,id);
      if(id==='bell')blast(center,stats.damage*scale,55+rank*4,id);
      else for(const e of state.enemies)if(e.hp>0&&squared(e,center)<(center.radius+e.radius)**2){
        hit(state,e,stats.damage*scale,0,id);e.slowTime=Math.max(e.slowTime||0,Math.min(2,1.5+rank*.06));
      }
    }else if(id==='mine'){
      const dx=target?target.x-p.x:p.facingX,dy=target?target.y-p.y:p.facingY;
      const angle=Math.atan2(dy,dx),distance=target?Math.min(96,Math.hypot(dx,dy)):70;
      for(let n=0;n<stats.count;n++){
        const a=angle+(n-(stats.count-1)/2)*.65;
        plant(id,p.x+Math.cos(a)*distance,p.y+Math.sin(a)*distance,stats,4.8,.22);
      }
    }else if(id==='meteor'||id==='gravity'){
      const seen=[];
      for(let n=0;n<stats.count;n++){
        target=nearest(p,650,seen)||target;seen.push(target.id);
        const offset=n&&seen.filter(value=>value===target.id).length>1?36*n:0;
        plant(id,target.x+offset,target.y,stats,id==='meteor'?.65:3.6);
      }
    }else if(id==='sunlance'){
      const bosses=state.enemies.filter(e=>e.hp>0&&(e.kind==='guardian'||e.elite)&&squared(e,p)<650**2);
      if(bosses.length)target=bosses.reduce((a,b)=>squared(a,p)<=squared(b,p)?a:b);
      const base=Math.atan2(target.y-p.y,target.x-p.x),range=stats.range||650;
      for(let n=0;n<stats.count;n++){
        const angle=base+(n-(stats.count-1)/2)*.07,dx=Math.cos(angle),dy=Math.sin(angle),width=stats.radius*area;
        Object.assign(emit('arc',p.x,p.y,width,.22,id),{toX:p.x+dx*range,toY:p.y+dy*range});
        for(const e of state.enemies){
          const x=e.x-p.x,y=e.y-p.y,along=x*dx+y*dy;
          if(e.hp>0&&along>=0&&along<=range&&Math.abs(x*dy-y*dx)<width+e.radius){
            hit(state,e,stats.damage*scale*(['guardian','arena-boss'].includes(e.kind)||e.elite?1.8:1),0,id);
          }
        }
      }
    }else if(id==='eclipse'){
      const center={x:p.x,y:p.y,radius:stats.radius*area};
      emit('fusion',p.x,p.y,center.radius,.55,id);blast(center,stats.damage*scale,38,id);
      state.projectiles=state.projectiles.filter(shot=>!shot.hostile||squared(shot,p)>(center.radius+shot.radius)**2);
    }
    state.weaponTimers[id]=Math.min(6,stats.cooldown/haste);state.attackSerial++;
  }
}
