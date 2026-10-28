import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,chooseUpgrade,serialize,restore} from '../webapp/frontend/js/lumen/engine.mjs';
import {WEAPONS,ARTIFACTS,WEAPON_IDS,MAX_WEAPONS,MAX_ARTIFACTS,CHARACTERS,MAPS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {normalizeMeta,recordProgress} from '../webapp/frontend/js/lumen/economy.mjs';
const dt=1/60;
const grant=(r,id)=>{r.status='upgrade';r.choices=[id];return chooseUpgrade(r,id);};
const quiet=()=>{const r=createRun();r.spawnedGuardians=3;r.spawnedElites=4;return r;};
const advance=(r,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++){r.spawnTimer=3;step(r,{},dt);}};
const impact=(r,damage=30)=>{
  r.player.invulnerable=0;r.spawnTimer=3;
  r.projectiles.push({id:r.nextId++,x:r.player.x,y:r.player.y,vx:0,vy:0,radius:3,damage,life:1,hostile:true,weapon:'hostile',pierce:0,hits:[],returning:false});
  step(r,{},dt);
};
test('four weapons and five artifacts are enforced on offers and forged choices',()=>{
  assert.equal(MAX_WEAPONS,4);assert.equal(MAX_ARTIFACTS,5);
  const r=quiet();for(const id of ['orbit','ice','storm','collector','chronogear','amplifier','aegis','laurel'])assert(grant(r,id));
  assert(!grant(r,'meteor'));assert(!grant(r,'heart'));r.status='playing';r.choices=[];
  for(let i=0;i<15;i++){
    r.xp=r.xpNext;step(r,{},dt);
    assert(r.choices.every(id=>!WEAPONS[id]||r.upgrades[id]));assert(r.choices.every(id=>!ARTIFACTS[id]||r.upgrades[id]));
    assert(r.choices.some(id=>WEAPONS[id]&&r.upgrades[id]));assert(chooseUpgrade(r,r.choices[0]));
    assert.equal(WEAPON_IDS.filter(id=>r.upgrades[id]).length,4);
  }
});
test('at full capacity an owned weapon still reaches VIII and artifact reaches III',()=>{
  const r=quiet();for(const id of ['orbit','ice','storm','collector','chronogear','amplifier','aegis','laurel'])assert(grant(r,id));
  for(let i=1;i<8;i++)assert(grant(r,'storm'));
  for(let i=1;i<3;i++)assert(grant(r,'laurel'));
  assert.equal(r.upgrades.storm,8);assert.equal(r.upgrades.laurel,3);assert(restore(serialize(r)));
});
test('rarity sampling makes legendary discoveries possible and uncommon',()=>{
  const seen={common:0,rare:0,epic:0,legendary:0},ids=new Set();
  for(let seed=1;seed<=12000;seed++){
    const r=createRun({seed});r.xp=r.xpNext;step(r,{},dt);
    const fresh=r.choices.filter(id=>WEAPONS[id]&&!r.upgrades[id]);assert.equal(fresh.length,1);
    seen[WEAPONS[fresh[0]].rarity]++;ids.add(fresh[0]);
  }
  assert(seen.legendary>90&&seen.legendary<300,JSON.stringify(seen));
  assert(seen.common>seen.rare&&seen.rare>seen.epic&&seen.epic>seen.legendary);
  assert(ids.has('sunlance')&&ids.has('eclipse'));assert.equal(ids.size,19);
});
test('owned legendary upgrades have the same reservation as ordinary weapons',()=>{
  let legendary=0;
  for(let seed=1;seed<=500;seed++){
    const r=createRun({seed:(seed*2654435761)>>>0});r.upgrades={spark:1,sunlance:1,ice:1,orbit:1};r.xp=r.xpNext;step(r,{},dt);
    if(r.choices.includes('sunlance'))legendary++;
  }
  assert(legendary>80,legendary);
});
test('laurel fully blocks a lethal hit, consumes one charge, and refills on simulation time',()=>{
  const r=quiet();assert(grant(r,'laurel'));assert.equal(r.relicState.shield,1);
  impact(r,999);assert.equal(r.player.hp,r.player.maxHp);assert.equal(r.status,'playing');assert.equal(r.relicState.shield,0);
  assert(r.effects.some(e=>e.kind==='shield'));
  r.status='upgrade';r.choices=['spark'];const paused=serialize(r);step(r,{},.25);assert.deepEqual(serialize(r),paused);
  assert(chooseUpgrade(r,'spark'));advance(r,19);assert.equal(r.relicState.shield,0);
  const restored=restore(serialize(r));assert(restored);advance(r,1.1);advance(restored,1.1);
  assert.equal(r.relicState.shield,1);assert.deepEqual(serialize(restored),serialize(r));
  impact(r,999);impact(r,999);assert.equal(r.status,'lost');
});
test('three laurel ranks supply three charges, repeated save loads never refill them',()=>{
  let r=quiet();for(let i=0;i<3;i++)assert(grant(r,'laurel'));
  for(let remaining=2;remaining>=0;remaining--){impact(r,500);assert.equal(r.relicState.shield,remaining);r=restore(serialize(r));assert(r);assert.equal(r.relicState.shield,remaining);}
  advance(r,15.9);assert.equal(r.relicState.shield,0);advance(r,.2);assert.equal(r.relicState.shield,1);
});
test('seed heals over time without exceeding max HP; carapace only protects low HP',()=>{
  const r=quiet();assert(grant(r,'heart'));r.player.hp=100;advance(r,5);assert(Math.abs(r.player.hp-102)<1e-8);
  r.player.hp=r.player.maxHp-.01;advance(r,1);assert.equal(r.player.hp,r.player.maxHp);
  const a=quiet();assert(grant(a,'carapace'));impact(a,20);assert.equal(a.player.hp,90);
  a.player.hp=30;impact(a,20);assert.equal(a.player.hp,13);
});
test('wind speed requires full health, and reactive spark damages nearby attackers',()=>{
  const r=quiet();assert(grant(r,'compass'));step(r,{x:1},dt);assert(Math.abs(r.player.x-160*1.05/60)<1e-8);
  r.player.hp--;const before=r.player.x;step(r,{x:1},dt);assert(Math.abs(r.player.x-before-160/60)<1e-8);
  assert(grant(r,'ember'));r.enemies=[{id:r.nextId++,kind:'mote',x:r.player.x+65,y:0,hp:10,maxHp:10,radius:10,speed:0,damage:7,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:3,slowTime:0,actionTimer:0,elite:false}];
  impact(r,7);assert.equal(r.kills,1);
});
test('hourglass accelerates attacks after both damage and a shield block',()=>{
  for(const shield of [false,true]){
    const r=quiet();assert(grant(r,'hourglass'));if(shield)assert(grant(r,'laurel'));
    impact(r,10);assert(r.relicState.surge>1.9);
    r.upgrades={...r.upgrades,bell:1};r.weaponTimers.bell=0;step(r,{},dt);
    assert(Math.abs(r.weaponTimers.bell-(3.4-.15)/1.2)<1e-8);assert(restore(serialize(r)));
    advance(r,2.1);assert.equal(r.relicState.surge,0);
  }
});
test('v6 migration keeps native and strongest four, archives exact stages and unlock progress',()=>{
  const old=serialize(createRun());old.version=6;delete old.relicState;delete old.archivedWeapons;
  old.upgrades={spark:1,orbit:8,pulse:7,ice:6,flame:5,storm:8};old.foundWeapons=['orbit','pulse','ice','flame','storm'];old.masteredWeapons=['orbit','storm'];
  old.status='upgrade';old.choices=['ice','collector','meteor'];const original=JSON.stringify(old);
  const r=restore(old);assert(r);assert.equal(r.version,10);assert.deepEqual(r.upgrades,{spark:1,orbit:8,pulse:7,storm:8});
  assert.deepEqual(r.archivedWeapons,{ice:6,flame:5});assert.deepEqual(r.choices,['collector']);assert.equal(JSON.stringify(old),original);
  const meta=normalizeMeta();recordProgress(meta,r);assert.equal(meta.weaponBest.flame,5);assert.equal(meta.weaponBest.storm,8);
  assert.deepEqual(serialize(restore(serialize(r))),serialize(r));
});
test('new saves reject excess equipment, stale discovery choices and impossible shield state',()=>{
  const valid=serialize(createRun());
  for(const change of [{upgrades:{spark:1,orbit:1,ice:1,storm:1,flame:1}},
    {upgrades:{spark:1,...Object.fromEntries(Object.keys(ARTIFACTS).slice(0,6).map(id=>[id,1]))}},
    {relicState:{shield:1,recharge:0,surge:0}}])assert.equal(restore({...valid,...change}),null);
  const r=quiet();r.upgrades={spark:1,orbit:1,ice:1,storm:1};r.status='upgrade';r.choices=['meteor'];assert.equal(restore(serialize(r)),null);
});
test('fusion at capacity frees a slot and preserves discovered mastery',()=>{
  const r=quiet();r.upgrades={spark:8,ice:8,orbit:1,pulse:1};r.foundWeapons=['ice','orbit','pulse'];
  assert(grant(r,'prism'));assert.equal(WEAPON_IDS.filter(id=>r.upgrades[id]).length,3);assert(r.masteredWeapons.includes('ice'));
  assert(grant(r,'meteor'));assert.equal(WEAPON_IDS.filter(id=>r.upgrades[id]).length,4);assert(restore(serialize(r)));
});
test('map goals and quarry HP multiplier retain their established values',()=>{
  assert.equal(MAPS.garden.goal,30);assert.equal(MAPS.quarry.goal,35);assert.equal(MAPS.quarry.hp,1.2);
  assert.equal(Object.keys(CHARACTERS).length,12);assert.equal(Object.keys(ARTIFACTS).length,10);
});

test('reactive spark cannot revive a lethal hit by killing a guardian',()=>{
  const r=quiet();assert(grant(r,'ember'));r.player.hp=1;
  r.enemies=[{id:r.nextId++,kind:'guardian',guardianStage:1,x:80,y:0,hp:1,maxHp:1,radius:31,speed:0,damage:10,value:100,phase:0,hitFlash:0,fireTimer:3,slowTime:0,actionTimer:0,elite:false}];
  impact(r,10);assert.equal(r.kills,1);assert.equal(r.player.hp,0);assert.equal(r.status,'lost');assert(restore(serialize(r)));
});
