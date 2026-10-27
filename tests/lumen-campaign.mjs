import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,chooseUpgrade,serialize,restore} from '../webapp/frontend/js/lumen/engine.mjs';
import {MAPS,MAX_WEAPON_STAGE,weaponStats,CHARACTERS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {normalizeMeta,recordProgress,mapAvailable,buyCharacter,characterRequirement} from '../webapp/frontend/js/lumen/economy.mjs';
const grant=(r,id)=>{r.status='upgrade';r.choices=[id];assert(chooseUpgrade(r,id));};

test('level-goal maps end at their exact target, with no final choice or boss gate',()=>{
  for(const map of Object.keys(MAPS).filter(id=>!MAPS[id].bossGoal)){
    const r=createRun({map});r.level=MAPS[map].goal-1;r.xp=r.xpNext+10;
    step(r,{},1/60);assert.equal(r.level,MAPS[map].goal);assert.equal(r.status,'won');assert.equal(r.endReason,'level');assert.deepEqual(r.choices,[]);assert.equal(r.bossesDefeated,0);
    const snapshot=serialize(r);step(r,{x:1},1);assert.deepEqual(serialize(r),snapshot);assert(restore(snapshot));
  }
});
test('map unlock survives reload; losing or clearing a locked map does not unlock it',()=>{
  let meta=normalizeMeta(null);assert(!mapAvailable(meta,'quarry'));assert(!mapAvailable(meta,'constructor'));
  const r=createRun();r.level=29;r.xp=r.xpNext;step(r,{},1/60);recordProgress(meta,r);recordProgress(meta,r);
  meta=normalizeMeta(JSON.parse(JSON.stringify(meta)));assert.deepEqual(meta.clearedMaps,['garden']);assert(mapAvailable(meta,'quarry'));
  const q=createRun({map:'quarry'});q.level=34;q.xp=q.xpNext;step(q,{},1/60);recordProgress(meta,q);assert.deepEqual(meta.clearedMaps,['garden','quarry']);
  const fresh=normalizeMeta(null);recordProgress(fresh,q);assert.deepEqual(fresh.clearedMaps,[]);
  r.status='lost';recordProgress(fresh,r);assert(!mapAvailable(fresh,'quarry'));
});
test('banked XP can complete a map directly from the pending upgrade choice',()=>{
  const r=createRun();r.level=29;r.xp=r.xpNext;r.status='upgrade';r.choices=['orbit'];
  assert(chooseUpgrade(r,'orbit'));assert.equal(r.status,'won');assert.equal(r.level,30);assert.deepEqual(r.choices,[]);assert(restore(serialize(r)));
});
test('coins alone cannot buy paid heroes; a found VIII weapon qualifies after loss and reload',()=>{
  for(const [id,hero] of Object.entries(CHARACTERS).filter(([,h])=>h.price)){
    let meta=normalizeMeta({coins:2000});assert(!buyCharacter(meta,id));assert.equal(meta.coins,2000);
    const r=createRun();for(let i=0;i<7;i++)grant(r,hero.weapon);
    recordProgress(meta,r);assert.equal(characterRequirement(meta,id).best,7);assert(!buyCharacter(meta,id));
    grant(r,hero.weapon);r.status='lost';r.player.hp=0;r.endReason='health';
    const resumed=restore(serialize(r));assert(resumed);recordProgress(meta,resumed);meta=normalizeMeta(JSON.parse(JSON.stringify(meta)));
    assert(characterRequirement(meta,id).eligible);assert(buyCharacter(meta,id));assert.equal(meta.coins,2000-hero.price);assert(!buyCharacter(meta,id));
  }
});
test('partial stages from separate runs never add, and native weapons do not count as found',()=>{
  const meta=normalizeMeta({coins:2000});
  for(let attempt=0;attempt<2;attempt++){const r=createRun();for(let i=0;i<4;i++)grant(r,'orbit');recordProgress(meta,r);}
  assert.equal(meta.weaponBest.orbit,4);assert(!buyCharacter(meta,'duelist'));
  const r=createRun({character:'duelist'});for(let i=1;i<8;i++)grant(r,'orbit');assert.deepEqual(r.foundWeapons,[]);recordProgress(meta,r);assert.equal(meta.weaponBest.orbit,4);
});
test('eight stages deliver four orbiting blades; the cap rejects stage IX',()=>{
  const r=createRun();for(let i=0;i<8;i++)grant(r,'orbit');assert.equal(r.upgrades.orbit,MAX_WEAPON_STAGE);assert.equal(weaponStats('orbit',8).count,4);
  r.status='upgrade';r.choices=['orbit'];assert.equal(chooseUpgrade(r,'orbit'),false);
});
test('v2 active saves keep wallet-independent state and migrate discovered weapons and pending choices',()=>{
  const v2=serialize(createRun());v2.version=2;delete v2.map;delete v2.foundWeapons;
  v2.time=479;v2.player.x=125;v2.upgrades={spark:3,ice:5};v2.coinsEarned=85;v2.status='upgrade';v2.choices=['ice'];
  const r=restore(v2);assert(r);assert.equal(r.version,9);assert.equal(r.map,'garden');assert.deepEqual(r.foundWeapons,['ice']);assert.equal(r.coinsEarned,85);assert.equal(r.player.x,125);
  assert(chooseUpgrade(r,'ice'));assert.equal(r.upgrades.ice,6);assert(restore(serialize(r)));
  v2.level=33;v2.status='playing';v2.choices=[];const completed=restore(v2);assert(completed);step(completed,{},1/60);assert.equal(completed.status,'won');
});
test('new map, discovery and mastery records reject malformed data without granting unlocks',()=>{
  const valid=serialize(createRun());for(const change of [{map:'unknown'},{foundWeapons:['spark']},{foundWeapons:['flame']},{foundWeapons:['constructor']}])assert.equal(restore({...valid,...change}),null);
  const meta=normalizeMeta({coins:500,weaponBest:{flame:9,ice:'8',orbit:Infinity},clearedMaps:['unknown','quarry']});assert.deepEqual(meta.weaponBest,{});assert.deepEqual(meta.clearedMaps,[]);assert(!buyCharacter(meta,'alchemist'));
});
test('previously purchased heroes and coins remain intact under the new unlock rules',()=>{
  const meta=normalizeMeta({version:1,coins:87,unlocked:['alchemist','duelist']});assert.equal(meta.coins,87);assert(meta.unlocked.includes('alchemist'));assert(meta.unlocked.includes('duelist'));assert(characterRequirement(meta,'duelist').eligible);assert.deepEqual(meta.clearedMaps,[]);
});
