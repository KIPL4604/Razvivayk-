import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,chooseUpgrade,serialize,restore,upcomingUpgrade} from '../webapp/frontend/js/lumen/engine.mjs';
import {WEAPONS,MAPS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {WEAPON_ICONS} from '../webapp/frontend/js/lumen/weapon-icon-data.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const tick=1/60;
const promote=state=>{state.spawnTimer=3;state.xp=state.xpNext;step(state,{},tick);};
const weapons=ids=>ids.filter(id=>WEAPONS[id]);

test('the next level weapons are decided while playing and delivered unchanged',()=>{
 for(let seed=1;seed<=120;seed++){
  const run=createRun({seed}),before=serialize(run),plan=upcomingUpgrade(run);
  assert.equal(plan.level,2);assert(plan.choices.length>0);assert.deepEqual(serialize(run),before,'reading a forecast must not consume simulation RNG or mutate the run');
  run.time+=17;run.rngState=(run.rngState^0xaabbccdd)>>>0||1;
  assert.deepEqual(upcomingUpgrade(run),plan,'combat random draws and elapsed time must not reroll the next level');
  promote(run);assert.equal(run.status,'upgrade');assert.deepEqual(weapons(run.choices),weapons(plan.choices));
  assert(chooseUpgrade(run,run.choices[0]));assert.equal(upcomingUpgrade(run).level,3);
  const following=upcomingUpgrade(run);promote(run);assert.deepEqual(weapons(run.choices),weapons(following.choices));
 }
});

test('save reload preserves the planned offers; legacy v11 saves without plans still work',()=>{
 const run=createRun({seed:8271}),plan=upcomingUpgrade(run),snapshot=serialize(run),restored=restore(snapshot);
 assert(restored);assert.deepEqual(upcomingUpgrade(restored),plan);assert.deepEqual(serialize(restored),snapshot);
 promote(run);promote(restored);assert.deepEqual(restored.choices,run.choices);
 const old=serialize(createRun({seed:21}));delete old.nextUpgrade;
 const migrated=restore(old);assert(migrated);assert.equal(migrated.version,11);assert(upcomingUpgrade(migrated).choices.length);
 const pending=serialize(run);delete pending.nextUpgrade;const pendingRestore=restore(pending);
 assert(pendingRestore);assert.deepEqual(pendingRestore.choices,run.choices,'an already open old choice must remain unchanged');
 for(const value of [{level:2,loadout:'',choices:['missing']},{level:2,loadout:'',choices:['spark','spark']},{level:-1,loadout:'',choices:['spark']},[]]){
  const bad=serialize(createRun());bad.nextUpgrade=value;assert.equal(restore(bad),null);
 }
 const detached=restore(snapshot);snapshot.nextUpgrade.choices.length=0;assert(upcomingUpgrade(detached).choices.length,'restored plan must not alias the caller snapshot');
});

test('damage can reserve recovery without replacing a foretold weapon',()=>{
 const run=createRun({seed:5}),promised=weapons(upcomingUpgrade(run).choices);run.player.hp=10;
 promote(run);assert.deepEqual(weapons(run.choices),promised);assert(run.choices.some(id=>['repair','vitality'].includes(id)));
});

test('a chest that completes a weapon refreshes the forecast and never promises a ninth stage',()=>{
 const run=createRun({seed:19});run.upgrades.spark=7;run.nextUpgrade=upcomingUpgrade(run);
 const before=run.nextUpgrade;assert(before.choices.includes('spark'));
 run.chests=[{id:run.nextId++,x:0,y:0,coins:18,upgrade:true,boss:false}];run.spawnTimer=3;step(run,{},tick);
 assert.equal(run.upgrades.spark,8);assert(!upcomingUpgrade(run).choices.includes('spark'));assert.notDeepEqual(run.nextUpgrade,before);
 assert(restore(serialize(run)));
});

test('there is no speculative weapon download beyond the world final or after death',()=>{
 for(const map of Object.keys(MAPS)){
  const run=createRun({map});run.level=MAPS[map].goal-1;assert.equal(upcomingUpgrade(run),null);
  run.level=1;run.status='lost';assert.equal(upcomingUpgrade(run),null);
 }
});

test('every weapon has a tiny independent hashed resource rather than a whole icon atlas',async()=>{
 assert.deepEqual(Object.keys(WEAPON_ICONS).sort(),Object.keys(WEAPONS).sort());
 for(const [id,icon]of Object.entries(WEAPON_ICONS)){
  const bytes=await readFile(new URL('../webapp/frontend/assets/lumen/'+icon.file,import.meta.url));
  assert.equal(bytes.length,icon.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),icon.sha256);
  assert(icon.bytes<1500);assert(icon.file.includes(id+'-'+icon.sha256.slice(0,12)));
 }
});
