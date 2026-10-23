import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,chooseUpgrade,serialize,restore} from '../webapp/frontend/js/lumen/engine.mjs';
import {WEAPONS,WEAPON_IDS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {xpForLevel} from '../webapp/frontend/js/lumen/progression.mjs';
import {bankCoins,normalizeMeta,recordProgress} from '../webapp/frontend/js/lumen/economy.mjs';
import {bodyRadius,PLAYER_BODY} from '../webapp/frontend/js/lumen/physics.mjs';
import {startArena,updateArena,enforceArenaBoundary,bossDeath,markArenaChestOpened,validateArena,ARENA_RADIUS,ARENA_TICK_COUNT} from '../webapp/frontend/js/lumen/arena.mjs';

const dt=1/60;
const effect=(s,kind,x,y,radius,life)=>s.effects.push({kind,x,y,radius,life,maxLife:life});
const hooks={effect,limits:{enemies:240,projectiles:100,effects:80,chests:12},hurt:(s,damage,grace)=>{
  if(s.player.invulnerable>0)return false;
  if(s.relicState.shield)s.relicState.shield--;else s.player.hp=Math.max(0,s.player.hp-damage);
  s.player.invulnerable=grace;if(!s.player.hp){s.status='lost';s.endReason='health';}return true;
}};
function run(){const s=createRun({seed:19});s.map='crater';s.level=40;return s;}
function advance(s,seconds){for(let i=0;i<Math.round(seconds/dt);i++){s.player.invulnerable=Math.max(0,s.player.invulnerable-dt);updateArena(s,dt,hooks);}}
function engineAdvance(s,seconds,input={}){for(let i=0;i<Math.round(seconds/dt);i++)step(s,input,dt);}
function integratedRun(){
  const s=createRun({seed:45,map:'crater'});s.level=39;s.xpNext=xpForLevel(39);s.xp=s.xpNext;
  step(s,{},dt);assert.equal(s.level,40);assert.equal(s.arena.phase,'forming');return s;
}
function roundTrip(s){const snapshot=serialize(s),copy=restore(snapshot);assert(copy,`cannot restore phase ${s.arena?.phase}`);assert.deepEqual(serialize(copy),snapshot);return copy;}
function engineBossDeath(s){
  const boss=s.enemies.find(e=>e.kind==='arena-boss');boss.hp=1;boss.fireTimer=4;boss.actionTimer=0;
  s.projectiles.push({id:s.nextId++,x:boss.x,y:boss.y,vx:0,vy:0,radius:4,damage:1,life:1,weapon:'spark',hostile:false,pierce:0,hits:[],returning:false});
  step(s,{},dt);assert.equal(s.arena.phase,'reward');assert.equal(s.status,'playing');
}

test('level 40 creates one anchored ring and a central boss without awarding early victory or kills',()=>{
  const s=run();s.enemies=[{id:s.nextId++,kind:'mote',x:30,y:20,hp:10,radius:10}];s.projectiles=[{hostile:true}];s.zones=[{kind:'flame'}];
  assert(startArena(s,hooks));assert.equal(s.arena.phase,'forming');assert.equal(s.status,'playing');
  assert.equal(s.enemies.filter(e=>e.kind==='arena-tick').length,ARENA_TICK_COUNT);assert.equal(s.enemies.length,33);
  const boss=s.enemies.find(e=>e.kind==='arena-boss');assert.equal(boss.bossType,'matriarch');assert.equal(boss.x,s.arena.x);assert.equal(boss.y,s.arena.y);
  assert.equal(s.projectiles.length,0);assert.equal(s.zones.length,0);assert.equal(s.kills,0);assert.equal(s.coinsEarned,0);
  for(const e of s.enemies.filter(e=>e.kind==='arena-tick'))assert(Math.abs(Math.hypot(e.x-s.arena.x,e.y-s.arena.y)-ARENA_RADIUS)<1e-8);
  const snapshot=JSON.stringify(s);assert.equal(startArena(s,hooks),false);assert.equal(JSON.stringify(s),snapshot);assert(validateArena(s.arena,s));
});

test('forming warnings precede the fight and ring anchors do not follow the player',()=>{
  const s=run();startArena(s,hooks);const arena={x:s.arena.x,y:s.arena.y};
  advance(s,2.4);assert.equal(s.arena.phase,'forming');assert.equal(s.projectiles.length,0);
  s.player.x+=50;advance(s,.2);assert.equal(s.arena.phase,'fighting');assert.equal(s.arena.time,0);
  assert.equal(s.arena.x,arena.x);assert.equal(s.arena.y,arena.y);
  advance(s,2);assert(s.projectiles.some(p=>p.hostile));assert(validateArena(s.arena,s));
});

test('deadly ring always contains the player, honors shields, and never hits twice in one tick',()=>{
  const s=run();startArena(s,hooks);s.arena.phase='fighting';s.arena.time=0;s.relicState.shield=1;
  s.player.x=s.arena.x+ARENA_RADIUS+100;s.player.y=s.arena.y;
  const hp=s.player.hp;assert(enforceArenaBoundary(s,hooks));assert(s.player.x<s.arena.x+ARENA_RADIUS);
  assert.equal(s.player.hp,hp);assert.equal(s.relicState.shield,0);
  enforceArenaBoundary(s,hooks);assert.equal(s.player.hp,hp);
  s.player.invulnerable=0;enforceArenaBoundary(s,hooks);assert(s.player.hp<hp);assert(s.player.x<=s.arena.x+ARENA_RADIUS-s.player.radius-36+1e-8);
});

test('boss death collapses the ring and produces exactly one durable mega reward',()=>{
  const s=run();startArena(s,hooks);s.arena.phase='fighting';const boss=s.enemies.find(e=>e.id===s.arena.bossId);boss.hp=0;
  assert(bossDeath(s,boss,hooks));assert.equal(s.arena.phase,'reward');assert.equal(s.kills,1);assert.equal(s.bossesDefeated,0);
  assert.equal(s.enemies.length,0);assert.equal(s.chests.length,1);assert.equal(s.chests[0].coins,800);assert(s.chests[0].mega);
  const once=JSON.stringify(s);assert(bossDeath(s,boss,hooks));assert.equal(JSON.stringify(s),once);assert(validateArena(s.arena,s));
  const copy=JSON.parse(JSON.stringify(s));assert(validateArena(copy.arena,copy));assert(!markArenaChestOpened(copy,{...copy.chests[0],id:999}));
  const chest=copy.chests[0];copy.chests=[];assert(markArenaChestOpened(copy,chest));assert.equal(copy.arena.phase,'celebrating');
  assert.equal(markArenaChestOpened(copy,chest),false);advance(copy,2.9);assert.equal(copy.status,'playing');advance(copy,.2);
  assert.equal(copy.status,'won');assert.equal(copy.endReason,'boss');assert.equal(copy.arena.phase,'complete');assert(validateArena(copy.arena,copy));
});

test('full chest storage retains ordinary coins and still leaves a dedicated mega chest',()=>{
  const s=run();startArena(s,hooks);s.arena.phase='fighting';
  s.chests=Array.from({length:12},()=>({id:s.nextId++,x:0,y:0,coins:25,upgrade:false,boss:false}));
  const boss=s.enemies.find(e=>e.id===s.arena.bossId);boss.hp=0;bossDeath(s,boss,hooks);
  assert.equal(s.chests.length,12);assert.equal(s.chests.reduce((sum,c)=>sum+c.coins,0),1100);
  assert.equal(s.chests.filter(c=>c.mega).length,1);assert(validateArena(s.arena,s));
});

test('arena validation rejects moved anchors, missing walls, duplicate reward states and premature wins',()=>{
  const s=run();startArena(s,hooks);
  for(const change of [{radius:999},{phase:'unknown'},{time:3.1},{rewardId:500}])assert(!validateArena({...s.arena,...change},s));
  const missing=JSON.parse(JSON.stringify(s));missing.enemies.pop();assert(!validateArena(missing.arena,missing));
  const moved=JSON.parse(JSON.stringify(s));moved.enemies.find(e=>e.kind==='arena-tick').x+=30;assert(!validateArena(moved.arena,moved));
  const won=JSON.parse(JSON.stringify(s));won.status='won';won.endReason='boss';assert(!validateArena(won.arena,won));
  assert(validateArena(null,createRun()));assert(!validateArena(null,s));
});

test('the complete 39 to 40 upgrade path opens combat instead of a result screen',()=>{
  const s=createRun({seed:45,map:'crater'});s.level=38;s.xpNext=xpForLevel(38);s.xp=s.xpNext+xpForLevel(39);
  step(s,{},dt);assert.equal(s.status,'upgrade');assert.equal(s.level,39);assert.equal(s.arena,null);
  assert(chooseUpgrade(s,s.choices[0]));assert.equal(s.level,40);assert.equal(s.status,'playing');assert.equal(s.endReason,'');
  assert.equal(s.arena.phase,'forming');assert.equal(s.enemies.length,33);assert.deepEqual(s.choices,[]);
  const before=s.time;engineAdvance(s,2.5);assert.equal(s.arena.phase,'fighting');assert(s.time>before);assert.equal(s.status,'playing');
  assert(!chooseUpgrade(s,'repair'));s.xp+=1e5;step(s,{},dt);assert.equal(s.level,40);assert.deepEqual(s.choices,[]);roundTrip(s);
});

test('warning formation clamps safely without contact damage and late frame gaps cannot cross the ring',()=>{
  const s=integratedRun(),hp=s.player.hp;
  s.player.x=s.arena.x+1000;s.player.y=s.arena.y;step(s,{x:1,y:0},10);
  assert.equal(s.arena.phase,'forming');assert.equal(s.player.hp,hp);
  const distance=Math.hypot(s.player.x-s.arena.x,s.player.y-s.arena.y);
  assert(distance<=ARENA_RADIUS-s.player.radius-36+1e-8);
  for(const tick of s.enemies.filter(e=>e.kind==='arena-tick'))assert(Math.hypot(s.player.x-tick.x,s.player.y-tick.y)>=PLAYER_BODY+bodyRadius(tick)-1e-8);
  s.player.x=s.arena.x;s.player.y=s.arena.y;step(s,{},dt);assert.equal(s.player.hp,hp,'the central boss must honor formation grace too');
  s.player.x=s.arena.x+200;s.player.y=s.arena.y;engineAdvance(s,2.5);assert.equal(s.arena.phase,'fighting');
  s.upgrades.laurel=1;s.relicState.shield=1;s.player.x=s.arena.x+1000;
  step(s,{x:1,y:0},10);assert.equal(s.player.hp,hp);assert.equal(s.relicState.shield,0);
  assert(Math.hypot(s.player.x-s.arena.x,s.player.y-s.arena.y)<ARENA_RADIUS);roundTrip(s);
});

test('all arena phases preserve their boss, ring, timers and unique reward across saves',()=>{
  let s=integratedRun();s=roundTrip(s);engineAdvance(s,1.25);s=roundTrip(s);assert.equal(s.arena.phase,'forming');
  engineAdvance(s,1.3);assert.equal(s.arena.phase,'fighting');engineAdvance(s,1);s=roundTrip(s);
  const boss=s.enemies.find(e=>e.kind==='arena-boss');assert(boss.actionTimer>0,'save while an attack is telegraphing');
  const same=roundTrip(s);engineAdvance(s,.3);engineAdvance(same,.3);assert.deepEqual(serialize(same),serialize(s));
  engineBossDeath(s);s=roundTrip(s);const chest=s.chests[0];assert.equal(s.arena.rewardId,chest.id);
  s.player.x=chest.x;s.player.y=chest.y;step(s,{},dt);assert.equal(s.arena.phase,'celebrating');s=roundTrip(s);
  engineAdvance(s,1.5);s=roundTrip(s);assert.equal(s.status,'playing');engineAdvance(s,1.5);assert.equal(s.status,'won');s=roundTrip(s);
  assert.equal(s.arena.phase,'complete');assert.equal(s.endReason,'boss');
  const terminal=serialize(s);step(s,{x:1,y:1},10);assert.deepEqual(serialize(s),terminal);
});

test('mega chest credits exactly 800 once for both unfinished and maxed weapon builds and waits three seconds',()=>{
  for(const maxed of [false,true]){
    let s=integratedRun();engineAdvance(s,2.5);
    if(maxed)s.upgrades={spark:8,needle:8,meteor:8,sunlance:8};
    engineBossDeath(s);const meta=normalizeMeta({clearedMaps:['garden','quarry']});
    recordProgress(meta,s);assert(!meta.clearedMaps.includes('crater'));assert.equal(bankCoins(meta,s),0);
    const chest=s.chests[0];s.player.x=chest.x;s.player.y=chest.y;step(s,{},dt);
    assert.equal(s.coinsEarned,800);assert.equal(s.openedChests,1);assert.equal(s.lootLog.at(-1).coins,800);
    assert.equal(s.arena.phase,'celebrating');assert.equal(s.arena.time,0);assert(s.effects.some(e=>e.kind==='chest'&&e.mega));
    assert.equal(bankCoins(meta,s),800);assert.equal(bankCoins(meta,s),0);s=roundTrip(s);assert.equal(bankCoins(meta,s),0);
    engineAdvance(s,3-dt);assert.equal(s.status,'playing');assert.equal(s.arena.phase,'celebrating');assert(s.arena.time<3);
    step(s,{},dt);assert.equal(s.status,'won');assert.equal(s.arena.time,3);assert.equal(s.chests.length,0);assert.equal(s.openedChests,1);
    recordProgress(meta,s);assert(meta.clearedMaps.includes('crater'));assert.equal(meta.coins,800);assert.equal(bankCoins(meta,roundTrip(s)),0);
  }
});

test('every weapon can damage the boss and no weapon can destroy or displace the wall',()=>{
  for(const id of WEAPON_IDS){
    const s=integratedRun();s.upgrades={[id]:WEAPONS[id].max};engineAdvance(s,2.5);
    const boss=s.enemies.find(e=>e.kind==='arena-boss'),anchors=s.enemies.map(e=>({id:e.id,x:e.x,y:e.y}));
    s.player.x=boss.x;s.player.y=boss.y+125;s.player.facingX=0;s.player.facingY=-1;
    engineAdvance(s,1.5);assert.equal(s.status,'playing',id);assert(boss.hp<boss.maxHp,`${id} cannot hit the arena boss`);
    for(const anchor of anchors){const e=s.enemies.find(e=>e.id===anchor.id);assert(e,`${id} destroyed an anchor`);assert.equal(e.x,anchor.x,id);assert.equal(e.y,anchor.y,id);if(e.kind==='arena-tick')assert.equal(e.hp,100000,id);}
    roundTrip(s);
  }
});

test('gravity and crowd separation preserve anchors even when the player and fields overlap the wall',()=>{
  const s=integratedRun();s.upgrades={gravity:8,bell:8,pulse:8,eclipse:8,amplifier:3,laurel:3};s.relicState.shield=3;
  engineAdvance(s,2.5);const anchors=s.enemies.map(e=>({id:e.id,x:e.x,y:e.y}));
  s.zones.push({id:s.nextId++,kind:'gravity',x:s.arena.x+280,y:s.arena.y,radius:240,damage:40,life:3,maxLife:3,tick:0});
  s.player.x=s.arena.x+1000;s.player.y=s.arena.y;step(s,{x:1,y:0},.25);
  for(const a of anchors){const e=s.enemies.find(e=>e.id===a.id);assert.equal(e.x,a.x);assert.equal(e.y,a.y);if(e.kind==='arena-tick')assert.equal(e.hp,100000);}
  assert(Math.hypot(s.player.x-s.arena.x,s.player.y-s.arena.y)<=ARENA_RADIUS-s.player.radius-36+1e-8);roundTrip(s);
});

test('saves reject arena entities and mega chests without a matching arena contract on every map',()=>{
  const source=integratedRun();
  for(const map of ['garden','quarry','crater']){
    const detached=serialize(source);detached.map=map;detached.level=1;detached.arena=null;
    assert.equal(restore(detached),null,`${map} accepted detached arena entities`);
    const chest=serialize(createRun({map}));chest.chests=[{id:1,x:0,y:0,coins:800,upgrade:true,boss:true,mega:true}];chest.nextId=2;
    assert.equal(restore(chest),null,`${map} accepted a detached mega chest`);
  }
  for(const change of [s=>{s.enemies.pop();},s=>{s.enemies[1].x+=1;},s=>{s.arena.rewardId=s.nextId++;},s=>{s.status='won';s.endReason='boss';}]){
    const snapshot=serialize(source);change(snapshot);assert.equal(restore(snapshot),null);
  }
  const missing=serialize(createRun());missing.arena=undefined;assert.equal(restore(missing),null);
});

test('a controlled legal 38-choice build defeats all 36000 boss HP with normal movement and receives the reward',()=>{
  // A chosen build isolates the final fight from discovery RNG. HP, damage,
  // cooldowns, movement, shields and every boss attack run without overrides.
  let s=createRun({map:'crater',seed:492,character:'heliarch'}),choices=0;
  for(const [id,rank]of Object.entries({sunlance:8,spark:8,meteor:6,drone:4,focus:3,haste:2,vitality:2,laurel:3,heart:1,aegis:1,amplifier:1})){
    while((s.upgrades[id]||0)<rank){s.status='upgrade';s.choices=[id];assert(chooseUpgrade(s,id));choices++;}
  }
  assert.equal(choices,38);s.level=39;s.xpNext=xpForLevel(39);s.xp=s.xpNext;step(s,{},dt);
  assert.equal(s.enemies.find(e=>e.kind==='arena-boss').hp,36000);
  let frames=0;
  while(s.status==='playing'&&s.arena.phase!=='reward'&&frames<120*60){
    const a=s.arena,p=s.player,dx=p.x-a.x,dy=p.y-a.y,distance=Math.hypot(dx,dy)||1,radial=(228-distance)*.04;
    step(s,{x:-dy/distance+dx/distance*radial,y:dx/distance+dy/distance*radial},dt);
    if(++frames===300)s=roundTrip(s);
  }
  assert.equal(s.status,'playing');assert.equal(s.arena.phase,'reward');assert(s.player.hp>0);assert.equal(s.kills,1);assert.equal(s.enemies.length,0);
  assert(frames>2.5*60&&frames<120*60);assert.equal(s.chests.length,1);
  for(let n=0;n<3*60&&s.arena.phase==='reward';n++){
    const chest=s.chests[0],dx=chest.x-s.player.x,dy=chest.y-s.player.y,distance=Math.hypot(dx,dy)||1;
    step(s,{x:dx/distance,y:dy/distance},dt);
  }
  assert.equal(s.arena.phase,'celebrating');engineAdvance(s,3);assert.equal(s.status,'won');assert.equal(s.coinsEarned,800);
  const meta=normalizeMeta({clearedMaps:['garden','quarry']});assert.equal(bankCoins(meta,s),800);assert.equal(bankCoins(meta,roundTrip(s)),0);
});

test('hostile projectiles cannot outlive boss death inside an already-running projectile iterator',()=>{
  const s=integratedRun();engineAdvance(s,2.5);const boss=s.enemies.find(e=>e.kind==='arena-boss');
  boss.hp=1;boss.fireTimer=4;boss.actionTimer=0;s.player.hp=1;s.player.invulnerable=0;
  const shot=(hostile,x,y)=>({id:s.nextId++,x,y,vx:0,vy:0,radius:4,damage:1,life:1,weapon:hostile?'hostile':'spark',hostile,pierce:0,hits:[],returning:false});
  // The killing shot is processed before the overlapping hostile shot. Removing
  // it from state.projectiles must also invalidate the active for-of iterator.
  s.projectiles=[shot(false,boss.x,boss.y),shot(true,s.player.x,s.player.y)];
  step(s,{},dt);assert.equal(s.arena.phase,'reward');assert.equal(s.status,'playing');assert.equal(s.player.hp,1);
  assert(!s.projectiles.some(p=>p.hostile));assert.equal(s.chests.length,1);roundTrip(s);
});
