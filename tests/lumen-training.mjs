import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAINING,normalizeTraining,trainingPrice,buyTraining} from '../webapp/frontend/js/lumen/training.mjs';
import {normalizeMeta,bankCoins,buyCharacter} from '../webapp/frontend/js/lumen/economy.mjs';
import {createRun,step,chooseUpgrade,serialize,restore} from '../webapp/frontend/js/lumen/engine.mjs';
const zero=()=>({vigor:0,lens:0,drive:0,compass:0});
const all=n=>Object.fromEntries(Object.keys(TRAINING).map(id=>[id,n]));

test('old meta keeps money, unlocks, mastery and credited totals with zero training',()=>{
  const old={version:2,coins:600,unlocked:['scout','keeper','duelist'],weaponBest:{ice:8},clearedMaps:['garden'],credited:{old:80}};
  const m=normalizeMeta(old);assert.equal(m.version,3);assert.equal(m.coins,600);assert(m.unlocked.includes('duelist'));
  assert.deepEqual(m.training,zero());assert.deepEqual(m.weaponBest,{ice:8});assert.deepEqual(m.credited,{old:80});
});
test('malformed ranks normalize to zero and do not create unbounded bonuses',()=>{
  for(const value of [null,[],{},all(-1),all(6),all(1.5),all(Infinity)])assert.deepEqual(normalizeTraining(value),zero());
  assert.deepEqual(normalizeTraining({...all(2),unknown:999}),all(2));
});
test('every training rank spends the exact increasing cost and stops at five',()=>{
  for(const id of Object.keys(TRAINING)){
    const m=normalizeMeta({coins:1000});let spent=0;
    for(const [rank,price]of [50,90,140,200,280].entries()){
      assert.equal(trainingPrice(id,rank),price);assert(buyTraining(m,id));spent+=price;
      assert.equal(m.coins,1000-spent);assert.equal(m.training[id],rank+1);
    }
    const before=JSON.stringify(m);assert.equal(trainingPrice(id,5),null);assert(!buyTraining(m,id));assert.equal(JSON.stringify(m),before);
  }
});
test('insufficient money, unknown ids and corrupt training cannot spend or grant ranks',()=>{
  for(const m of [normalizeMeta({coins:49}),{coins:999,training:all(9)},{coins:NaN,training:zero()}]){
    const before=JSON.stringify(m);assert(!buyTraining(m,'vigor'));assert.equal(JSON.stringify(m),before);
  }
  const m=normalizeMeta({coins:999});assert(!buyTraining(m,'__proto__'));assert(!buyTraining(m,'missing'));assert.equal(m.coins,999);
});
test('new runs gain only the documented small HP, speed and pickup bonuses',()=>{
  const base=createRun(),one=createRun({training:all(1)}),max=createRun({training:all(5)});
  assert.equal(one.player.maxHp,base.player.maxHp+2);assert.equal(max.player.maxHp,base.player.maxHp+10);assert.equal(max.player.hp,max.player.maxHp);
  assert.equal(one.player.speed,base.player.speed*1.005);assert.equal(max.player.speed,base.player.speed*1.025);
  assert.equal(one.pickupRadius,base.pickupRadius+2);assert.equal(max.pickupRadius,base.pickupRadius+10);
  step(base,{x:1},.25);step(one,{x:1},.25);assert(Math.abs(one.player.x/base.player.x-1.005)<1e-12);
});
test('optics increases actual projectile damage by one percent per rank',()=>{
  const shot=n=>{const r=createRun({training:{lens:n}});r.enemies=[{id:1,kind:'mote',x:400,y:0,hp:100,maxHp:100,radius:10,speed:0,damage:7,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:3}];r.nextId=2;step(r,{},1/60);return r.projectiles[0].damage;};
  assert.equal(shot(1),shot(0)*1.01);assert.equal(shot(5),shot(0)*1.05);
});
test('training composes with legal run upgrades without granting weapon stages',()=>{
  const r=createRun({training:all(5)});assert.deepEqual(r.upgrades,{spark:1});
  r.status='upgrade';r.choices=['vitality'];assert(chooseUpgrade(r,'vitality'));assert.equal(r.player.maxHp,140);
  r.status='upgrade';r.choices=['stride'];assert(chooseUpgrade(r,'stride'));assert.equal(r.player.speed,160*1.1*1.025);
  assert(restore(serialize(r)));
});
test('purchase affects the next run and never changes the saved active snapshot',()=>{
  const m=normalizeMeta({coins:600}),active=createRun({training:m.training}),before=serialize(active);
  for(const id of Object.keys(TRAINING))assert(buyTraining(m,id));
  assert.deepEqual(serialize(active),before);assert.deepEqual(restore(before).training,zero());
  const next=createRun({training:m.training});assert.deepEqual(next.training,all(1));m.training.vigor=5;assert.equal(next.training.vigor,1);
});
test('v5 run migrates unchanged; v6 ranks round-trip and malformed snapshots are rejected',()=>{
  const old=serialize(createRun());old.version=5;delete old.training;
  const migrated=restore(old);assert(migrated);assert.equal(migrated.version,8);assert.deepEqual(migrated.training,zero());
  const current=serialize(createRun({training:all(3)}));assert.deepEqual(serialize(restore(current)),current);
  for(const training of [null,[],all(6),{vigor:2}, {...all(1),extra:1}])assert.equal(restore({...current,training}),null);
});
test('coins cannot be credited again after spending, reload, or buying training',()=>{
  const m=normalizeMeta();bankCoins(m,{runId:'earned',coinsEarned:150});assert(buyTraining(m,'vigor'));assert.equal(m.coins,100);
  const resumed=normalizeMeta(JSON.parse(JSON.stringify(m)));assert.equal(bankCoins(resumed,{runId:'earned',coinsEarned:150}),0);
  assert.equal(resumed.coins,100);assert.equal(resumed.training.vigor,1);assert(!buyCharacter(resumed,'duelist'));
});
