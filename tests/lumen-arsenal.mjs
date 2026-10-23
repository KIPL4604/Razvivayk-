import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,step,chooseUpgrade,restore,serialize,LIMITS} from '../webapp/frontend/js/lumen/engine.mjs';
import {CHARACTERS,WEAPON_IDS,weaponStats} from '../webapp/frontend/js/lumen/catalog.mjs';
import {normalizeMeta,bankCoins} from '../webapp/frontend/js/lumen/economy.mjs';

const mob=(overrides={})=>({id:1,kind:'mote',x:60,y:0,hp:1000,maxHp:1000,radius:12,speed:0,damage:7,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:3,elite:false,slowTime:0,actionTimer:0,...overrides});
const advance=(run,seconds)=>{for(let i=0;i<seconds*60;i++)step(run,{},1/60);};

test('each of the six heroes starts only with its own functioning weapon',()=>{
  for(const [id,hero] of Object.entries(CHARACTERS)){
    const r=createRun({character:id});assert.deepEqual(r.upgrades,{[hero.weapon]:1});
    const target=mob({x:hero.weapon==='orbit'?82:60});r.enemies=[target];r.nextId=2;r.spawnTimer=3;
    advance(r,1.5);assert(target.hp<target.maxHp,`${id} native attack did not hit`);
    assert(restore(serialize(r)),`${id} could not resume`);
  }
});

test('all eight weapons inflict damage; III and V change actual projectile counts',()=>{
  for(const id of WEAPON_IDS){
    const r=createRun();r.upgrades={[id]:1};const target=mob({x:id==='orbit'?82:60});r.enemies=[target];r.nextId=2;r.spawnTimer=3;
    advance(r,1.5);assert(target.hp<1000,`${id} has no damage`);
  }
  for(const id of ['spark','ice','flame','cleaver'])for(const stage of [1,2,3,5]){
    const r=createRun();r.upgrades={[id]:stage};r.enemies=[mob({x:400})];r.nextId=2;
    step(r,{},1/60);assert.equal(r.projectiles.length,weaponStats(id,stage).count);
  }
});

test('ice slows, axes return, and fire and thorns persist as damaging ground fields',()=>{
  const ice=createRun();ice.upgrades={ice:1};ice.enemies=[mob()];ice.nextId=2;
  advance(ice,.2);assert(ice.enemies[0].slowTime>0);
  const axe=createRun();axe.upgrades={cleaver:1};axe.enemies=[mob({x:600})];axe.nextId=2;
  advance(axe,.9);assert(axe.projectiles.some(p=>p.returning&&p.vx<0));
  for(const id of ['flame','thorn']){
    const r=createRun();r.upgrades={[id]:1};r.enemies=[mob()];r.nextId=2;
    advance(r,.4);assert(r.zones.some(z=>z.kind===id));const hp=r.enemies[0].hp;
    r.weaponTimers[id]=5;advance(r,1);assert(r.enemies[0].hp<hp);assert(restore(serialize(r)));
  }
});

test('boss and elite deaths drop chests; pickup upgrades an owned weapon and credits once',()=>{
  for(const elite of [true,false]){
    const r=createRun({runId:`loot-${elite}`});r.enemies=[mob({hp:1,maxHp:1,x:60,kind:elite?'beetle':'guardian',elite,guardianStage:elite?0:1})];r.nextId=2;
    advance(r,.2);assert.equal(r.chests.length,1);assert.equal(r.chests[0].boss,!elite);
    const copy=restore(serialize(r));assert(copy);copy.player.x=copy.chests[0].x;copy.player.y=copy.chests[0].y;
    step(copy,{},1/60);assert.equal(copy.chests.length,0);assert.equal(copy.openedChests,1);assert(copy.coinsEarned>0);
    if(!elite)assert.equal(copy.upgrades.spark,2);
    const meta=normalizeMeta(null);assert.equal(bankCoins(meta,copy),copy.coinsEarned);
    const resumed=restore(serialize(copy));assert(resumed);assert.equal(bankCoins(meta,resumed),0);
    advance(resumed,.2);assert.equal(resumed.openedChests,1);assert.equal(bankCoins(meta,resumed),0);
  }
});

test('maxed weapon chest awards extra coins, and a four-weapon build cannot offer a fifth',()=>{
  const r=createRun();r.upgrades={spark:8};r.chests=[{id:1,x:0,y:0,coins:60,upgrade:true,boss:true}];r.nextId=2;
  step(r,{},1/60);assert.equal(r.upgrades.spark,8);assert.equal(r.coinsEarned,85);
  r.upgrades=Object.fromEntries(WEAPON_IDS.slice(0,4).map(id=>[id,1]));
  for(let i=0;i<12;i++){
    r.xp=r.xpNext;step(r,{},1/60);
    assert(r.choices.every(id=>!WEAPON_IDS.includes(id)||r.upgrades[id]>0));
    assert(chooseUpgrade(r,r.choices[0]));
  }
});

test('three bosses have different shot patterns; all six common species spawn in pressure',()=>{
  const counts=[];
  for(const stage of [1,2,3]){
    const r=createRun();r.upgrades={};r.enemies=[mob({kind:'guardian',guardianStage:stage,x:400,fireTimer:0})];r.nextId=2;
    step(r,{},1/60);counts.push(r.projectiles.filter(p=>p.hostile).length);
  }
  assert.deepEqual(counts,[6,8,10]);
  const r=createRun({seed:9});r.time=350;r.spawnedElites=4;r.spawnedGuardians=3;r.upgrades={};
  const species=new Set();for(let i=0;i<1800;i++){r.player.hp=r.player.maxHp;step(r,{x:1},1/60);for(const e of r.enemies)species.add(e.kind);}
  assert.deepEqual([...species].sort(),['mote','beetle','wasp','crawler','spitter','wisp'].sort());
});

test('real version1 record migrates without moving the player, losing XP or duplicating kit',()=>{
  const old=JSON.parse(readFileSync(new URL('./fixtures/lumen-v1.json',import.meta.url),'utf8'));
  old.player.x=123;old.xp=4;old.upgrades={orbit:2};
  const r=restore(old);assert(r);assert.equal(r.version,7);assert.equal(r.player.x,123);assert.equal(r.xp,4);
  assert.deepEqual(r.upgrades,{spark:1,orbit:3});assert.equal(r.coinsEarned,0);assert.deepEqual(serialize(restore(serialize(r))),serialize(r));
  assert.equal(old.version,1);assert.deepEqual(old.upgrades,{orbit:2});
});

test('new save collections, timers, and loot reject corrupt or oversized data',()=>{
  const valid=serialize(createRun());
  for(const changed of [{zones:Array(LIMITS.zones+1).fill({})},{chests:[{id:1,x:0,y:0,coins:Infinity,upgrade:true,boss:true}]},
    {weaponTimers:{constructor:1}},{coinsEarned:-1},{runId:'../bad'},
    {lootLog:[{id:1,coins:2,weapon:'constructor',stage:1,time:1}]}])assert.equal(restore({...valid,...changed}),null);
});
