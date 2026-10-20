import test from 'node:test';import assert from 'node:assert/strict';
import {CHARACTERS,WEAPON_IDS,WEAPONS,weaponStats} from '../webapp/frontend/js/lumen/catalog.mjs';
import {normalizeMeta,buyCharacter,bankCoins} from '../webapp/frontend/js/lumen/economy.mjs';
test('eight heroes have distinct native weapons; all fourteen weapons have real stage stats',()=>{
  assert.equal(Object.keys(CHARACTERS).length,8);assert.equal(new Set(Object.values(CHARACTERS).map(c=>c.weapon)).size,8);
  assert.equal(WEAPON_IDS.length,14);
  for(const hero of Object.values(CHARACTERS))assert(WEAPONS[hero.weapon]&&hero.hp>0&&hero.speed>0);
  for(const id of WEAPON_IDS){assert(weaponStats(id,3).count>weaponStats(id,1).count);assert(weaponStats(id,5).damage>weaponStats(id,1).damage);}
  assert.equal(weaponStats('orbit',1).count,1);assert.equal(weaponStats('orbit',2).count,1);assert.equal(weaponStats('orbit',3).count,2);
});
test('purchases spend exactly once and reject unavailable or unknown transactions',()=>{
  const meta=normalizeMeta({coins:200,weaponBest:{ice:8}});assert(buyCharacter(meta,'ranger'));assert.equal(meta.coins,0);
  assert(!buyCharacter(meta,'ranger'));assert(!buyCharacter(meta,'alchemist'));assert(!buyCharacter(meta,'constructor'));
  assert(meta.unlocked.includes('scout')&&meta.unlocked.includes('keeper')&&meta.unlocked.includes('ranger'));
});
test('wallet credits chest totals once through repeated autosave and resume',()=>{
  let meta=normalizeMeta(null);const run={runId:'qa-run-1',coinsEarned:40};
  assert.equal(bankCoins(meta,run),40);assert.equal(bankCoins(meta,run),0);
  meta=normalizeMeta(JSON.parse(JSON.stringify(meta)));assert.equal(bankCoins(meta,run),0);
  run.coinsEarned=85;assert.equal(bankCoins(meta,run),45);assert.equal(meta.coins,85);
  run.coinsEarned=20;assert.equal(bankCoins(meta,run),0);assert.equal(meta.coins,85);
});
test('malformed meta never invents coins or paid characters',()=>{
  for(const coins of [-1,NaN,Infinity,'450',1.5])assert.equal(normalizeMeta({coins}).coins,0);
  assert.deepEqual(normalizeMeta({unlocked:['unknown','scout']}).unlocked,['scout','keeper']);
  assert.equal(bankCoins(normalizeMeta(null),{runId:'__proto__',coinsEarned:300}),0);
});
