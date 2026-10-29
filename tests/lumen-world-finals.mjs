import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,chooseUpgrade,serialize,restore} from '../webapp/frontend/js/lumen/engine.mjs';
import {BOSS_VARIANTS} from '../webapp/frontend/js/lumen/bosses.mjs';
import {MAPS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {normalizeMeta,recordProgress,bankCoins} from '../webapp/frontend/js/lumen/economy.mjs';
import {steer} from './helpers/lumen-pilot.mjs';

const dt=1/60;
const worlds=[['garden','rootwarden',300],['quarry','overseer',500]];
const advance=(s,seconds)=>{for(let n=0;n<Math.round(seconds/dt);n++)step(s,{},dt);};
function atFinal(map){
  const s=createRun({map,seed:81});s.level=MAPS[map].goal-1;s.xp=s.xpNext;
  step(s,{},dt);return s;
}
function roundTrip(s){const snapshot=serialize(s),copy=restore(snapshot);assert(copy,s.arena?.phase);assert.deepEqual(serialize(copy),snapshot);return copy;}
function killFinal(s){
  const boss=s.enemies.find(e=>e.kind==='arena-boss');boss.hp=1;boss.fireTimer=4;boss.actionTimer=0;
  s.projectiles.push({id:s.nextId++,x:boss.x,y:boss.y,vx:0,vy:0,radius:4,damage:1,life:1,
    weapon:'spark',hostile:false,pierce:0,hits:[],returning:false});
  step(s,{},dt);assert.equal(s.arena.phase,'reward');
}

test('garden and quarry finals have independent identities, large bodies and mandatory victory gates',()=>{
  for(const [map,type]of worlds){
    const s=atFinal(map),boss=s.enemies.find(e=>e.kind==='arena-boss');
    assert.equal(s.status,'playing');assert.equal(s.level,MAPS[map].goal);assert.equal(s.endReason,'');
    assert.equal(boss.bossType,type);assert.equal(boss.maxHp,map==='garden'?16000:24000);
    assert(boss.radius>=70);assert.equal(s.arena.phase,'forming');assert.equal(s.chests.length,0);
    const meta=normalizeMeta({clearedMaps:map==='quarry'?['garden']:[]});recordProgress(meta,s);
    assert(!meta.clearedMaps.includes(map),'arriving at the level cap must not unlock the next world');
    const count=s.spawnedGuardians;s.xp=100000;advance(s,.5);assert.equal(s.level,MAPS[map].goal);
    assert.equal(s.spawnedGuardians,count);assert.deepEqual(s.choices,[]);roundTrip(s);
  }
  assert.notDeepEqual(BOSS_VARIANTS.rootwarden.attacks,BOSS_VARIANTS.overseer.attacks);
});

test('both new finales preserve every phase across reload and bank their unique rewards exactly once',()=>{
  for(const [map,,reward]of worlds){
    let s=roundTrip(atFinal(map));advance(s,1.1);s=roundTrip(s);advance(s,1.5);
    assert.equal(s.arena.phase,'fighting');s=roundTrip(s);killFinal(s);s=roundTrip(s);
    assert.equal(s.status,'playing');assert.equal(s.chests.length,1);assert.equal(s.chests[0].coins,reward);
    const chest=s.chests[0];s.player.x=chest.x;s.player.y=chest.y;step(s,{},dt);
    assert.equal(s.arena.phase,'celebrating');assert.equal(s.coinsEarned,reward);s=roundTrip(s);
    const meta=normalizeMeta({clearedMaps:map==='quarry'?['garden']:[]});
    assert.equal(bankCoins(meta,s),reward);assert.equal(bankCoins(meta,s),0);
    advance(s,1.5);s=roundTrip(s);advance(s,1.5);assert.equal(s.status,'won');assert.equal(s.endReason,'boss');
    assert.equal(s.arena.phase,'complete');s=roundTrip(s);recordProgress(meta,s);assert(meta.clearedMaps.includes(map));
    assert.equal(bankCoins(meta,s),0);const finished=serialize(s);step(s,{x:1},10);assert.deepEqual(serialize(s),finished);
  }
});

test('v10 completed level victories remain completed and eligible while active cap runs enter their final',()=>{
  for(const [map,type]of worlds){
    const old=serialize(createRun({map}));old.version=10;delete old.legacyLevelWin;
    old.level=MAPS[map].goal;old.status='won';old.endReason='level';old.coinsEarned=97;
    let s=restore(old);assert(s);assert.equal(s.version,11);assert(s.legacyLevelWin);
    assert.equal(s.status,'won');assert.equal(s.arena,null);assert.equal(s.coinsEarned,97);s=roundTrip(s);
    const meta=normalizeMeta({clearedMaps:map==='quarry'?['garden']:[]});recordProgress(meta,s);assert(meta.clearedMaps.includes(map));
    old.status='playing';old.endReason='';s=restore(old);assert(s);assert.equal(s.legacyLevelWin,false);
    step(s,{},dt);assert.equal(s.status,'playing');assert.equal(s.enemies.find(e=>e.kind==='arena-boss').bossType,type);roundTrip(s);
  }
});

test('legacy untyped quarry guardians retain their attacks and identity after migration',()=>{
  const s=createRun({map:'quarry'});s.time=120-dt;s.spawnTimer=3;step(s,{},dt);
  const old=serialize(s);old.version=10;delete old.legacyLevelWin;
  const boss=old.enemies.find(e=>e.kind==='guardian');delete boss.bossType;delete boss.attackStage;
  const restored=restore(old);assert(restored);assert.equal(restored.enemies.find(e=>e.kind==='guardian').bossType,undefined);
  roundTrip(restored);
});

test('new final saves reject cross-world identities, detached bosses, altered rewards and false legacy exemptions',()=>{
  for(const [map,type]of worlds){
    const s=atFinal(map);
    for(const change of [v=>{v.enemies.find(e=>e.kind==='arena-boss').bossType=type==='rootwarden'?'overseer':'rootwarden';},
      v=>{v.arena=null;},v=>{v.enemies.find(e=>e.kind==='arena-boss').radius=31;},
      v=>{v.legacyLevelWin=true;},v=>{v.arena.kind='castle';},v=>{v.status='won';v.endReason='boss';}]){
      const value=serialize(s);change(value);assert.equal(restore(value),null);
    }
    advance(s,2.5);killFinal(s);const value=serialize(s);value.chests[0].coins=800;assert.equal(restore(value),null);
    const falseWin=serialize(createRun({map}));falseWin.level=MAPS[map].goal;falseWin.status='won';falseWin.endReason='boss';
    assert.equal(restore(falseWin),null,'a new run cannot skip its final by forging a result without an arena');
  }
});

test('legal level-budget builds defeat both new finals using ordinary directional movement',()=>{
  for(const [map,,reward]of worlds){
    let s=createRun({map,seed:82,character:'heliarch'}),choices=0;
    const build=map==='garden'?{sunlance:8,spark:6,drone:4,focus:2,haste:2,vitality:2,laurel:3,heart:1,aegis:1}
      :{sunlance:8,spark:8,drone:5,focus:3,haste:3,vitality:2,laurel:3,heart:1,aegis:1};
    for(const [id,rank]of Object.entries(build))while((s.upgrades[id]||0)<rank){s.status='upgrade';s.choices=[id];assert(chooseUpgrade(s,id));choices++;}
    assert.equal(choices,MAPS[map].goal-2);s.level=MAPS[map].goal-1;s.xp=s.xpNext;step(s,{},dt);
    const memory={};let frames=0;
    while(s.status==='playing'&&s.arena.phase!=='reward'&&frames<120*60){
      step(s,steer(s,frames,memory),dt);if(++frames===300)s=roundTrip(s);
    }
    assert.equal(s.status,'playing',map);assert.equal(s.arena.phase,'reward',map);assert(s.player.hp>0,map);
    assert.equal(s.chests[0].coins,reward);assert(frames>2.5*60&&frames<120*60,map);roundTrip(s);
  }
});
