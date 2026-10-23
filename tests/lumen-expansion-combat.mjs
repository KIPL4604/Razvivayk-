import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,serialize,restore,LIMITS} from '../webapp/frontend/js/lumen/engine.mjs';
import {WEAPONS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {updateExpansionWeapons,EXPANSION_WEAPON_IDS} from '../webapp/frontend/js/lumen/expansion-combat.mjs';

const tick=1/60;
const enemy=(id,x,y=0,extra={})=>({id,kind:'mote',x,y,hp:100000,maxHp:100000,radius:12,speed:0,damage:10,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:4,slowTime:0,actionTimer:0,elite:false,...extra});
function run(id,stage=1,enemies=[enemy(1,80)]){
  const state=createRun({seed:9});state.upgrades={[id]:stage};state.enemies=enemies;
  state.nextId=Math.max(0,...enemies.map(e=>e.id))+1;state.spawnTimer=3;
  return state;
}
function advance(state,seconds){for(let n=0;n<Math.ceil(seconds/tick);n++)step(state,{},tick);}
const dependencies={
  hit:(state,e,damage,push=0)=>{e.hp-=damage;const distance=Math.hypot(e.x-state.player.x,e.y-state.player.y)||1;e.x+=(e.x-state.player.x)/distance*push;e.y+=(e.y-state.player.y)/distance*push;},
  effect:(state,kind,x,y,radius,life)=>state.effects.push({kind,x,y,radius,life,maxLife:life}),
  limits:LIMITS,
};

test('all ten added weapons deal actual damage at I and VIII through the fixed-step engine',()=>{
  assert.equal(EXPANSION_WEAPON_IDS.length,10);
  for(const id of EXPANSION_WEAPON_IDS)for(const stage of [1,8]){
    assert.equal(WEAPONS[id].max,8);
    const state=run(id,stage);advance(state,.9);
    assert(state.enemies.some(e=>e.hp<100000),`${id} ${stage} caused no damage`);
    assert(state.attackSerial>0,`${id} did not attack`);
    assert(restore(serialize(state)),`${id} ${stage} cannot resume`);
  }
});

test('needles pierce a line and a fan hits separate targets',()=>{
  const needle=run('needle',1,[enemy(1,80),enemy(2,150),enemy(3,220)]);advance(needle,.4);
  assert(needle.enemies.every(e=>e.hp<e.maxHp),'a needle must penetrate three lined-up enemies');
  const fan=run('fan',1,[enemy(1,180),enemy(2,180,-38),enemy(3,180,38)]);advance(fan,.6);
  assert(fan.enemies.every(e=>e.hp<e.maxHp),'the spread must damage all three lanes');
});

test('bell repels the close ring; frostnova slows it without touching distant enemies',()=>{
  const bell=run('bell',1,[enemy(1,110),enemy(2,650)]);step(bell,{},tick);
  assert(bell.enemies[0].x>110);assert(bell.enemies[0].hp<100000);assert.equal(bell.enemies[1].hp,100000);
  const frost=run('frostnova',1,[enemy(1,110),enemy(2,650)]);step(frost,{},tick);
  assert(frost.enemies[0].slowTime>=1.5);assert.equal(frost.enemies[1].slowTime,0);
});

test('mines stay planted, arm before proximity damage, and blast nearby targets only once',()=>{
  const state=run('mine',1,[enemy(1,80),enemy(2,120)]);
  updateExpansionWeapons(state,tick,dependencies);const planted={...state.zones[0]};
  assert.equal(state.enemies[0].hp,100000);assert.equal(planted.kind,'mine');
  state.player.x=-100;
  updateExpansionWeapons(state,.1,dependencies);
  assert.equal(state.zones[0].x,planted.x);assert.equal(state.zones[0].y,planted.y);assert.equal(state.enemies[0].hp,100000);
  updateExpansionWeapons(state,.14,dependencies);
  assert(state.enemies.every(e=>e.hp<100000));assert.equal(state.zones.length,0);
  const hp=state.enemies.map(e=>e.hp);updateExpansionWeapons(state,.1,dependencies);
  assert.deepEqual(state.enemies.map(e=>e.hp),hp);
});

test('meteors warn before the blast; gravity pulls and slows without moving the guardian excessively',()=>{
  const meteor=run('meteor',1);updateExpansionWeapons(meteor,tick,dependencies);
  assert.equal(meteor.zones[0].kind,'meteor');assert.equal(meteor.enemies[0].hp,100000);
  updateExpansionWeapons(meteor,.3,dependencies);assert.equal(meteor.enemies[0].hp,100000);
  updateExpansionWeapons(meteor,.36,dependencies);assert(meteor.enemies[0].hp<100000);assert.equal(meteor.zones.length,0);
  const gravity=run('gravity',1,[enemy(1,100),enemy(2,160),enemy(3,160,20,{kind:'guardian',guardianStage:1})]);
  updateExpansionWeapons(gravity,tick,dependencies);const x=gravity.enemies[1].x,bossX=gravity.enemies[2].x;
  updateExpansionWeapons(gravity,.1,dependencies);
  assert(gravity.enemies[1].x<x);assert(gravity.enemies[1].slowTime>0);assert(gravity.enemies[1].hp<100000);
  assert(gravity.enemies[2].x<bossX);assert(bossX-gravity.enemies[2].x<x-gravity.enemies[1].x);
});

test('drones steer toward an unhit enemy and keep their flight speed',()=>{
  const state=run('drone',1,[enemy(1,200,100)]);
  state.weaponTimers.drone=1;
  state.projectiles=[{id:2,x:0,y:0,vx:390,vy:0,radius:6,damage:30,life:1.8,weapon:'drone',hostile:false,pierce:1,hits:[],returning:false}];
  state.nextId=3;updateExpansionWeapons(state,.1,dependencies);
  assert(state.projectiles[0].vy>0);assert(Math.abs(Math.hypot(state.projectiles[0].vx,state.projectiles[0].vy)-390)<1e-8);
});

test('legendary lance penetrates a line with elite bonus; eclipse clears nearby hostile fire',()=>{
  const lance=run('sunlance',1,[enemy(1,100),enemy(2,200),enemy(3,300,0,{elite:true}),enemy(4,100,160)]);
  updateExpansionWeapons(lance,tick,dependencies);
  const losses=lance.enemies.map(e=>e.maxHp-e.hp);
  assert(losses[0]>0&&losses[1]>0);assert(losses[2]>losses[0]*1.7);assert.equal(losses[3],0);
  const eclipse=run('eclipse',1,[enemy(1,90)]);
  const shot=(id,x,hostile)=>({id,x,y:0,vx:0,vy:0,radius:6,damage:5,life:2,weapon:hostile?'hostile':'spark',hostile,pierce:0,hits:[],returning:false});
  eclipse.projectiles=[shot(2,50,true),shot(3,600,true),shot(4,50,false)];eclipse.nextId=5;
  updateExpansionWeapons(eclipse,tick,dependencies);
  assert.deepEqual(eclipse.projectiles.map(p=>p.id),[3,4]);assert(eclipse.enemies[0].hp<100000);
});

test('every added weapon composes damage, area and frequency buffs including the hourglass surge',()=>{
  for(const id of EXPANSION_WEAPON_IDS){
    const basic=run(id),enhanced=run(id);
    Object.assign(enhanced.upgrades,{focus:2,haste:2,chronogear:2,amplifier:3,hourglass:3});
    enhanced.training.lens=5;enhanced.relicState.surge=1;
    updateExpansionWeapons(basic,tick,dependencies);updateExpansionWeapons(enhanced,tick,dependencies);
    const payload=s=>s.projectiles[0]||s.zones[0];
    const damage=s=>payload(s)?.damage??s.enemies[0].maxHp-s.enemies[0].hp;
    const radius=s=>(payload(s)||s.effects[0]).radius;
    assert(Math.abs(damage(enhanced)/damage(basic)-1.4*1.05)<1e-8,`${id} damage buffs`);
    assert(Math.abs(radius(enhanced)/radius(basic)-1.36)<1e-8,`${id} area buff`);
    assert(Math.abs(basic.weaponTimers[id]/enhanced.weaponTimers[id]-2.14)<1e-8,`${id} haste composition`);
    enhanced.relicState.surge=0;enhanced.weaponTimers[id]=0;
    updateExpansionWeapons(enhanced,tick,dependencies);
    assert(Math.abs(basic.weaponTimers[id]/enhanced.weaponTimers[id]-1.54)<1e-8,`${id} surge should expire`);
  }
});

test('new attacks respect entity limits and resume deterministically with pending zones and homing shots',()=>{
  for(const id of EXPANSION_WEAPON_IDS){
    const state=run(id,8,[enemy(1,150)]);
    state.effects=Array.from({length:LIMITS.effects},()=>({kind:'pulse',x:0,y:0,radius:30,life:1,maxLife:1}));
    state.zones=Array.from({length:LIMITS.zones},(_,n)=>({id:state.nextId++,kind:'thorn',x:n*10,y:200,radius:20,damage:1,life:4,maxLife:4,tick:.3}));
    state.projectiles=Array.from({length:LIMITS.projectiles-1},()=>({id:state.nextId++,x:-1000,y:500,vx:0,vy:0,radius:3,damage:1,life:1,weapon:'spark',hostile:false,pierce:0,hits:[],returning:false}));
    updateExpansionWeapons(state,tick,dependencies);
    assert(state.effects.length<=LIMITS.effects,id);assert(state.zones.length<=LIMITS.zones,id);assert(state.projectiles.length<=LIMITS.projectiles,id);
    const resumed=restore(serialize(state));assert(resumed,`${id} pending state rejected`);
    advance(state,.8);advance(resumed,.8);assert.deepEqual(serialize(resumed),serialize(state),`${id} changed after restore`);
  }
});
