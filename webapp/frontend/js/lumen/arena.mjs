import {BOSS_VARIANTS,updateBossAttacks,validateBossFields} from './bosses.mjs';

export const ARENA_RADIUS=330;
export const ARENA_TICK_COUNT=32;
export const ARENA_HAZARD_INSET=65;
export const ARENA_PHASES=Object.freeze(['forming','fighting','reward','celebrating','complete']);
const TAU=Math.PI*2;
const inBattle=arena=>arena&&['forming','fighting'].includes(arena.phase);
const emit=(state,effect,kind,x,y,radius,life)=>{
  if(state.effects.length>=80)state.effects.shift();
  effect(state,kind,x,y,radius,life);
};

export function startArena(state,{effect}){
  if(state.map!=='crater'||state.level<40||state.arena||state.status==='lost')return false;
  const p=state.player,direction=Math.hypot(p.facingX,p.facingY)||1;
  const x=p.x+(p.facingX||0)/direction*150,y=p.y+(p.facingY||0)/direction*150;
  for(const enemy of state.enemies)emit(state,effect,'dissolve',enemy.x,enemy.y,enemy.radius+8,.4);
  state.enemies=[];state.projectiles=[];state.zones=[];state.gems=[];state.chests=[];
  state.choices=[];state.status='playing';state.endReason='';state.remainder=0;
  const stats=BOSS_VARIANTS.matriarch,bossId=state.nextId++;
  state.arena={phase:'forming',x,y,radius:ARENA_RADIUS,time:0,bossId,rewardId:0};
  state.enemies.push({id:bossId,kind:'arena-boss',bossType:'matriarch',attackStage:0,x,y,hp:stats.hp,maxHp:stats.hp,
    radius:stats.radius,speed:0,damage:stats.damage,value:0,phase:0,hitFlash:0,guardianStage:0,fireTimer:.8,elite:false,slowTime:0,actionTimer:0});
  for(let n=0;n<ARENA_TICK_COUNT;n++){
    const phase=n/ARENA_TICK_COUNT*TAU;
    state.enemies.push({id:state.nextId++,kind:'arena-tick',x:x+Math.cos(phase)*ARENA_RADIUS,y:y+Math.sin(phase)*ARENA_RADIUS,
      hp:100000,maxHp:100000,radius:26,speed:0,damage:180,value:0,phase,hitFlash:0,guardianStage:0,fireTimer:0,elite:false,slowTime:0,actionTimer:0});
  }
  emit(state,effect,'warning',x,y,ARENA_RADIUS,2.5);return true;
}

export function enforceArenaBoundary(state,{hurt}={}){
  const arena=state.arena;if(!inBattle(arena)||state.status==='lost')return false;
  const p=state.player,dx=p.x-arena.x,dy=p.y-arena.y,distance=Math.hypot(dx,dy),safe=arena.radius-p.radius-36;
  if(arena.phase==='fighting'&&distance>=arena.radius-ARENA_HAZARD_INSET&&hurt)hurt(state,Math.max(80,p.maxHp*.45),.4);
  if(distance>safe){p.x=arena.x+dx/distance*safe;p.y=arena.y+dy/distance*safe;}
  return distance>=arena.radius-ARENA_HAZARD_INSET;
}

export function updateArena(state,dt,hooks){
  const arena=state.arena;if(!arena||state.status!=='playing')return false;
  if(inBattle(arena)){
    for(const enemy of state.enemies){
      if(enemy.kind==='arena-tick'){
        enemy.x=arena.x+Math.cos(enemy.phase)*arena.radius;enemy.y=arena.y+Math.sin(enemy.phase)*arena.radius;
      }else if(enemy.id===arena.bossId){enemy.x=arena.x;enemy.y=arena.y;}
    }
  }
  if(arena.phase==='forming'){
    arena.time=Math.min(2.5,arena.time+dt);
    if(arena.time>=2.5-1e-9){arena.phase='fighting';arena.time=0;}
  }else if(arena.phase==='fighting'){
    const boss=state.enemies.find(e=>e.id===arena.bossId&&e.kind==='arena-boss');
    if(boss&&boss.hp>0)updateBossAttacks(state,boss,dt,hooks);
  }else if(arena.phase==='celebrating'){
    arena.time=Math.min(3,arena.time+dt);
    if(arena.time>=3-1e-9){arena.phase='complete';arena.time=3;state.status='won';state.endReason='boss';state.choices=[];state.remainder=0;}
  }
  return true;
}

export function bossDeath(state,enemy,{effect,limits={chests:12}}){
  const arena=state.arena;
  if(!arena||enemy.kind!=='arena-boss'||enemy.id!==arena.bossId)return false;
  if(!inBattle(arena))return true;
  if(enemy.hp>0||arena.phase!=='fighting')return true;
  state.kills++;
  for(const tick of state.enemies)if(tick.kind==='arena-tick')emit(state,effect,'dissolve',tick.x,tick.y,34,.7);
  emit(state,effect,'guardian',arena.x,arena.y,220,1.5);
  state.enemies=state.enemies.filter(e=>e.kind!=='arena-tick'&&e.id!==enemy.id);
  state.projectiles=state.projectiles.filter(p=>!p.hostile);
  // A dedicated chest must remain collectible even if another system filled
  // storage during the fight. Consolidate ordinary coins instead of losing them.
  if(state.chests.length>=limits.chests){
    const retained=state.chests.slice(0,limits.chests-1),overflow=state.chests.slice(limits.chests-1);
    for(const chest of overflow){retained[0].coins+=chest.coins;retained[0].upgrade ||= chest.upgrade;retained[0].boss ||= chest.boss;}
    state.chests=retained;
  }
  arena.rewardId=state.nextId++;arena.phase='reward';arena.time=0;
  state.chests.push({id:arena.rewardId,x:arena.x,y:arena.y,coins:800,upgrade:true,boss:true,mega:true});
  return true;
}

export function markArenaChestOpened(state,chest){
  const arena=state.arena;
  if(!arena||arena.phase!=='reward'||chest.id!==arena.rewardId||chest.mega!==true)return false;
  arena.phase='celebrating';arena.time=0;return true;
}

export function validateArena(value,state){
  if(value===null)return (state.map!=='crater'||state.level<40)&&
    !state.enemies.some(e=>e.kind==='arena-boss'||e.kind==='arena-tick')&&!state.chests.some(c=>c.mega);
  const number=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
  const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
  if(!value||typeof value!=='object'||Array.isArray(value)||state.map!=='crater'||state.level<40||!ARENA_PHASES.includes(value.phase)||
    !number(value.x,-1e7,1e7)||!number(value.y,-1e7,1e7)||value.radius!==ARENA_RADIUS||!number(value.time,0,3)||
    !integer(value.bossId,1,state.nextId-1)||!integer(value.rewardId,0,state.nextId-1))return false;
  const ticks=state.enemies.filter(e=>e.kind==='arena-tick'),bosses=state.enemies.filter(e=>e.kind==='arena-boss'),mega=state.chests.filter(c=>c.mega);
  if(inBattle(value)){
    if(value.rewardId!==0||mega.length||ticks.length!==ARENA_TICK_COUNT||bosses.length!==1||state.enemies.length!==33||
      (value.phase==='forming'?value.time>2.5:value.time!==0)||!['playing','lost'].includes(state.status))return false;
    const boss=bosses[0];
    if(boss.id!==value.bossId||boss.bossType!=='matriarch'||!validateBossFields(boss)||boss.maxHp!==BOSS_VARIANTS.matriarch.hp||boss.radius!==48||
      boss.damage!==32||boss.value!==0||boss.guardianStage!==0||Math.abs(boss.x-value.x)>1e-6||Math.abs(boss.y-value.y)>1e-6||boss.speed!==0)return false;
    const phases=new Set();
    for(const tick of ticks){
      const index=Math.round(tick.phase/TAU*ARENA_TICK_COUNT);
      if(!number(tick.phase,0,TAU)||index<0||index>=ARENA_TICK_COUNT||phases.has(index)||Math.abs(tick.phase-index/ARENA_TICK_COUNT*TAU)>1e-6||
        tick.hp!==100000||tick.maxHp!==100000||tick.radius!==26||tick.damage!==180||tick.value!==0||tick.guardianStage!==0||tick.speed!==0||
        Math.abs(tick.x-value.x-Math.cos(tick.phase)*value.radius)>1e-6||Math.abs(tick.y-value.y-Math.sin(tick.phase)*value.radius)>1e-6)return false;
      phases.add(index);
    }
    return true;
  }
  if(ticks.length||bosses.length||!value.rewardId)return false;
  if(value.phase==='reward')return value.time===0&&mega.length===1&&mega[0].id===value.rewardId&&mega[0].coins===800&&mega[0].boss===true&&mega[0].upgrade===true&&['playing','lost'].includes(state.status);
  if(mega.length)return false;
  if(value.phase==='celebrating')return value.time<3&&['playing','lost'].includes(state.status);
  return value.time===3&&state.status==='won'&&state.endReason==='boss';
}
