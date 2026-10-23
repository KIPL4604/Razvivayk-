import {WEAPON_IDS,weaponStats} from './catalog.mjs';
import {updateExpansionWeapons,EXPANSION_WEAPON_IDS,EXPANSION_ZONE_KINDS} from './expansion-combat.mjs';
const TAU=Math.PI*2;
const squared=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
export function updateWeapons(state,dt,{hit,effect,limits}){
  const p=state.player,scale=(1+(state.upgrades.focus||0)*.2)*(1+(state.training?.lens||0)*.01),haste=1+(state.upgrades.haste||0)*.15+(state.upgrades.chronogear||0)*.12+(state.relicState?.surge>0?(state.upgrades.hourglass||0)*.2:0),area=1+(state.upgrades.amplifier||0)*.12;
  const nearest=(from,range=640,seen=[])=>{
    let target=null,distance=range*range;
    for(const e of state.enemies){if(e.hp<=0||e.kind==='arena-tick'||seen.includes(e.id))continue;const d=squared(e,from);if(d<distance){target=e;distance=d;}}
    return target;
  };
  function shoot(id,stats,target,index){
    if(state.projectiles.length>=limits.projectiles)return;
    const aim=Math.atan2(target.y-p.y,target.x-p.x)+(index-(stats.count-1)/2)*.18;
    state.projectiles.push({id:state.nextId++,x:p.x,y:p.y,vx:Math.cos(aim)*stats.speed,vy:Math.sin(aim)*stats.speed,
      radius:(id==='flame'?6:stats.radius)*area,damage:stats.damage*scale,life:id==='flame'?Math.min(2.8,Math.hypot(target.x-p.x,target.y-p.y)/stats.speed):['cleaver','sunrise'].includes(id)?1.6:1.8,
      hostile:false,weapon:id,pierce:stats.pierce||0,hits:[],returning:false});
  }
  function zone(kind,x,y,stats){
    if(state.zones.length>=limits.zones)state.zones.shift();
    state.zones.push({id:state.nextId++,kind,x,y,radius:stats.radius*area,damage:stats.damage*scale,life:kind==='flame'?2.6:4,maxLife:kind==='flame'?2.6:4,tick:0});
  }
  for(const z of state.zones){
    if(EXPANSION_ZONE_KINDS.includes(z.kind))continue;
    z.life-=dt;z.tick-=dt;if(z.tick>0||z.life<=0)continue;
    for(const e of state.enemies)if(e.hp>0&&squared(e,z)<(e.radius+z.radius)**2){hit(state,e,z.damage,0,z.kind);if(z.kind==='briar')e.slowTime=1.2;}
    z.tick=['flame','briar'].includes(z.kind)?.35:.6;
  }
  state.zones=state.zones.filter(z=>z.life>0);
  state.orbitAngle=(state.orbitAngle+dt*1.9)%TAU;
  for(const id of WEAPON_IDS){
    if(EXPANSION_WEAPON_IDS.includes(id))continue;
    const rank=state.upgrades[id]||0;if(!rank)continue;
    const base=weaponStats(id,rank),stats={...base,radius:base.radius*(['orbit','pulse','cyclone','storm'].includes(id)?area:1)},key=id==='spark'?'boltTimer':id==='orbit'?'orbitTimer':id==='pulse'?'pulseTimer':null;
    const timer=Math.max(0,(key?state[key]:state.weaponTimers[id]||0)-dt);
    if(key)state[key]=timer;else state.weaponTimers[id]=timer;
    if(timer>0)continue;
    let target;
    if(['spark','flame','ice','storm','cleaver','chakram','spear','prism'].includes(id)){target=nearest(p);if(!target)continue;}
    if(id==='orbit'||id==='cyclone'){
      for(let i=0;i<stats.count;i++){
        const a=state.orbitAngle+i/stats.count*TAU,point={x:p.x+Math.cos(a)*stats.radius,y:p.y+Math.sin(a)*stats.radius};
        for(const e of state.enemies)if(squared(e,point)<(e.radius+16)**2)hit(state,e,stats.damage*scale,0,id);
      }
      if(id==='cyclone'){
        let from=p,to=nearest(p,stats.radius+160);const seen=[];
        for(let n=0;n<3+rank&&to;n++){
          hit(state,to,stats.damage*scale,0,id);seen.push(to.id);effect(state,'arc',from.x,from.y,12,.25);Object.assign(state.effects.at(-1),{toX:to.x,toY:to.y,weapon:id});from=to;to=nearest(from,180,seen);
        }
      }
    }else if(id==='pulse'){
      for(let i=0;i<stats.count;i++){
        const radius=stats.radius*(1-i*.12);effect(state,'pulse',p.x,p.y,radius,.55+i*.12);state.effects.at(-1).weapon=id;
        for(const e of state.enemies)if(squared(e,p)<(radius+e.radius)**2)hit(state,e,stats.damage*scale,e.kind==='guardian'?8:35,id);
      }
    }else if(id==='storm'){
      let from=p;const seen=[];
      for(let i=0;i<stats.count&&target;i++){
        hit(state,target,stats.damage*scale,0,id);seen.push(target.id);
        effect(state,'arc',from.x,from.y,12,.2);Object.assign(state.effects.at(-1),{toX:target.x,toY:target.y,weapon:id});
        from=target;target=nearest(from,stats.radius,seen);
      }
    }else if(id==='thorn'||id==='briar'){
      const enemy=nearest(p,200),center=enemy||{x:p.x+p.facingX*60,y:p.y+p.facingY*60};
      for(let i=0;i<stats.count;i++){const a=i/stats.count*TAU;zone(id,center.x+Math.cos(a)*(stats.count>1?42:0),center.y+Math.sin(a)*(stats.count>1?42:0),stats);}
    }else if(id==='sunrise'){
      const radius=(170+rank*20)*area;effect(state,'fusion',p.x,p.y,radius,.5);state.effects.at(-1).weapon=id;
      for(const e of state.enemies)if(squared(e,p)<(radius+e.radius)**2)hit(state,e,stats.damage*scale,30,id);
      for(let i=0;i<stats.count;i++){const a=i/stats.count*TAU;shoot(id,{...stats,count:1},{x:p.x+Math.cos(a)*200,y:p.y+Math.sin(a)*200},0);}
    }else for(let i=0;i<stats.count;i++)shoot(id,stats,target,i);
    if(key)state[key]=stats.cooldown/haste;else state.weaponTimers[id]=stats.cooldown/haste;
    if(id!=='orbit')state.attackSerial++;
  }
  updateExpansionWeapons(state,dt,{hit,effect,limits});
}

export function flameImpact(state,projectile,limits){
  if(state.zones.length>=limits.zones)state.zones.shift();
  const stats=weaponStats('flame',state.upgrades.flame||1);
  state.zones.push({id:state.nextId++,kind:'flame',x:projectile.x,y:projectile.y,radius:stats.radius*(1+(state.upgrades.amplifier||0)*.12),damage:projectile.damage,life:2.6,maxLife:2.6,tick:0});
}
