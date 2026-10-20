import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,chooseUpgrade,serialize,restore,LIMITS} from '../webapp/frontend/js/lumen/engine.mjs';
import {waveAt,xpForLevel,crystalLoot} from '../webapp/frontend/js/lumen/progression.mjs';

const tick=1/60;
function spawnAt(time){
  const run=createRun({seed:44});run.time=time;run.spawnTimer=0;run.spawnedGuardians=3;
  step(run,{},tick);return run;
}
test('seven dense harvests precede stronger groups and finish before guardians',()=>{
  let previousHp=0;
  for(let stage=1;stage<=7;stage++){
    const start=35+(stage-1)*60;
    const harvest=spawnAt(start),pressure=spawnAt(start+20);
    assert.equal(waveAt(start).kind,'harvest');assert.equal(waveAt(start+20).kind,'pressure');
    assert(harvest.enemies.length>=pressure.enemies.length*2);
    assert(harvest.enemies.every(e=>e.kind==='mote'&&e.hp<=24&&e.damage<=3));
    const run=spawnAt(start+20);run.boltTimer=3;
    // Several real spawn batches: test encounter output, not just catalog constants.
    for(let i=0;i<180;i++)step(run,{},tick);
    const beetles=run.enemies.filter(e=>e.kind==='beetle');
    assert(beetles.length>0&&run.enemies.some(e=>e.kind==='wasp'));
    assert(beetles[0].maxHp>previousHp);previousHp=beetles[0].maxHp;
  }
  for(const time of [120,240,420])assert.equal(waveAt(time).kind,'pressure');
});
test('a weak harvest creature actually dies to one unupgraded automatic bolt',()=>{
  const run=spawnAt(35);run.enemies=run.enemies.slice(0,1);
  run.enemies[0].x=120;run.enemies[0].y=0;run.spawnTimer=3;run.boltTimer=0;run.projectiles=[];
  for(let i=0;i<20;i++)step(run,{},tick);
  assert.equal(run.kills,1);assert.equal(run.enemies.length,0);
  assert.equal(run.gems[0].value,2);assert.equal(run.gems[0].tier,1);
});
test('level price grows and higher-tier drops offset the late basic-crystal burden',()=>{
  for(let level=2;level<=150;level++)assert(xpForLevel(level)>xpForLevel(level-1));
  assert(xpForLevel(20)>=200);assert.equal(xpForLevel(1),10);
  for(const [hp,tier,value] of [[18,1,2],[149,1,2],[150,2,12],[299,2,12],[300,3,40]]){
    assert.deepEqual(crystalLoot(hp),{tier,value});
    const run=createRun({seed:5});run.spawnTimer=3;
    run.enemies=[{id:1,x:120,y:0,kind:'beetle',hp:1,maxHp:hp,radius:10,speed:0,damage:3,value,phase:0,hitFlash:0,guardianStage:0,fireTimer:2}];run.nextId=2;
    for(let i=0;i<15;i++)step(run,{},tick);
    assert.equal(run.gems[0].tier,tier);assert.equal(run.gems[0].value,value);
  }
  const run=createRun({seed:1});run.xp=run.xpNext;step(run,{},tick);
  assert.equal(run.xpNext,xpForLevel(2));chooseUpgrade(run,run.choices[0]);
  run.xp=run.xpNext;step(run,{},tick);assert.equal(run.xpNext,xpForLevel(3));
});
test('crystal overflow conserves XP, favors matching tiers and preserves merged identity',()=>{
  for(const incomingTier of [1,2,3]){
    const run=createRun({seed:12});run.spawnTimer=3;
    run.gems=Array.from({length:LIMITS.gems},(_,i)=>({x:1000+i,y:1000,value:i===1?12:2,tier:i===1?2:1}));
    const before=run.gems.reduce((sum,g)=>sum+g.value,0);
    const hp=[18,150,300][incomingTier-1],value=crystalLoot(hp).value;
    run.enemies=[{id:1,x:55,y:0,kind:'mote',hp:1,maxHp:hp,radius:10,speed:0,damage:0,value,phase:0,hitFlash:0,guardianStage:0,fireTimer:2}];run.nextId=2;
    for(let i=0;i<15;i++)step(run,{},tick);
    assert.equal(run.gems.length,LIMITS.gems);
    assert.equal(run.gems.reduce((sum,g)=>sum+g.value,0),before+value);
    if(incomingTier===2)assert.equal(run.gems[1].value,24,'nearest same-tier crystal preferred');
    if(incomingTier===1)assert.equal(run.gems[0].tier,1);
    if(incomingTier===3)assert(run.gems.some(g=>g.tier===3));
    assert(restore(serialize(run)));
  }
});
test('version1 saves without tiers round-trip exactly, invalid tiers are rejected',()=>{
  const old=serialize(createRun({seed:77}));old.level=22;old.xpNext=156;
  old.gems=[{x:100,y:0,value:4},{x:110,y:0,value:25}];
  assert.deepEqual(serialize(restore(old)),old);
  for(const tier of [0,4,-1,1.5,'2',null]){
    const invalid=structuredClone(old);invalid.gems[0].tier=tier;assert.equal(restore(invalid),null);
  }
  const current=structuredClone(old);current.gems[0].tier=2;
  assert.deepEqual(serialize(restore(current)),current);
});
