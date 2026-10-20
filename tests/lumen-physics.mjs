import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,serialize,restore} from '../webapp/frontend/js/lumen/engine.mjs';
import {PLAYER_BODY,bodyRadius,movePlayer,separateCrowd,touchingEnemies,contactDamage} from '../webapp/frontend/js/lumen/physics.mjs';

const enemy=(id,x,y,extra={})=>({id,kind:'mote',x,y,hp:100,maxHp:100,radius:10,speed:0,
  damage:7,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:3,elite:false,slowTime:0,actionTimer:0,...extra});
function quiet(enemies=[]){
  const run=createRun({seed:73});run.enemies=enemies;run.nextId=1000;run.spawnTimer=3;
  run.boltTimer=3;for(const key in run.weaponTimers)run.weaponTimers[key]=6;
  return run;
}
const advance=(run,seconds,input={})=>{for(let i=0;i<seconds*60;i++)step(run,input,1/60);};

test('swept bodies block direct movement even beyond one monster per frame',()=>{
  const p={x:0,y:0},e=enemy(1,100,0);
  movePlayer(p,[e],300,0);
  assert.equal(p.x,58);assert.equal(p.y,0);assert.equal(e.x,100);
  movePlayer(p,[e],30,0);assert.equal(p.x,58);
  movePlayer(p,[e],-40,0);assert.equal(p.x,18);
});
test('tangential sliding permits a detour, dead monsters stop blocking immediately',()=>{
  const p={x:58,y:0},e=enemy(1,100,0);
  movePlayer(p,[e],10,30);assert.equal(p.x,58);assert.equal(p.y,30);
  for(let i=0;i<40;i++)movePlayer(p,[e],3,1);
  assert(p.x>150);e.hp=0;p.x=0;p.y=0;movePlayer(p,[e],200,0);assert.equal(p.x,200);
});
test('a closed ring contains the player and a killed segment opens an escape',()=>{
  const ring=Array.from({length:8},(_,i)=>enemy(i+1,Math.cos(i*Math.PI/4)*60,Math.sin(i*Math.PI/4)*60));
  for(const angle of [0,.2,.6,1.2,2,3,4,5]){
    const p={x:0,y:0};for(let i=0;i<120;i++)movePlayer(p,ring,Math.cos(angle)*3,Math.sin(angle)*3);
    assert(Math.hypot(p.x,p.y)<60,'Escaped closed ring at '+angle);
  }
  const p={x:0,y:0};ring[0].hp=0;
  for(let i=0;i<90;i++)movePlayer(p,ring,3,0);
  assert(p.x>200);
});
test('crowd separation resolves coincident centers without moving the player or RNG',()=>{
  const p={x:0,y:0},crowd=Array.from({length:36},(_,i)=>enemy(i+1,10,0));
  for(let i=0;i<40;i++)separateCrowd(crowd,p);
  assert.deepEqual(p,{x:0,y:0});
  for(let i=0;i<crowd.length;i++){
    const a=crowd[i];assert(Number.isFinite(a.x)&&Number.isFinite(a.y));
    assert(Math.hypot(a.x,a.y)>=PLAYER_BODY+bodyRadius(a)-1e-6);
    for(let j=i+1;j<crowd.length;j++)assert(Math.hypot(a.x-crowd[j].x,a.y-crowd[j].y)>31.8);
  }
});
test('one bite has a cadence; several bodies increase damage without per-frame stacking',()=>{
  const run=quiet([enemy(1,36,0)]);step(run,{},1/60);
  assert.equal(run.player.hp,103);advance(run,.3);assert.equal(run.player.hp,103);
  advance(run,2/60);assert.equal(run.player.hp,96);
  const ring=quiet(Array.from({length:5},(_,i)=>enemy(i+1,Math.cos(i*Math.PI*2/5)*42,Math.sin(i*Math.PI*2/5)*42)));
  step(ring,{},1/60);assert(touchingEnemies(ring).length>=5);assert.equal(ring.player.hp,95);
  advance(ring,2.4);assert.equal(ring.status,'lost');assert.equal(ring.endReason,'health');
  assert.equal(contactDamage([enemy(1,0,0)]),7);assert.equal(contactDamage([]),0);
});
test('walking cannot bulldoze a stationary monster and knockback opens space',()=>{
  const run=quiet([enemy(1,90,0)]);advance(run,.6,{x:1,y:0});
  assert(Math.abs(run.player.x-48)<1e-6);assert.equal(run.enemies[0].x,90);
  run.enemies[0].x+=100;advance(run,.3,{x:1,y:0});assert(run.player.x>90);
});
test('projectile grace prevents simultaneous bite stacking; ward applies once to crowd damage',()=>{
  const r=quiet([enemy(1,36,0)]);r.player.invulnerable=.1;step(r,{},1/60);
  assert.equal(r.player.hp,110);assert.equal(r.contactTimer,0);
  advance(r,.1);assert.equal(r.player.hp,103);
  const ward=quiet([enemy(1,36,0)]);ward.upgrades.aegis=3;step(ward,{},1/60);assert.equal(ward.player.hp,109);
});
test('contact timer persists, v4 migrates, invalid timers are rejected and no aliases leak',()=>{
  const r=quiet([enemy(1,36,0)]);step(r,{},1/60);
  const saved=serialize(r),resumed=restore(saved);assert(resumed);assert.equal(resumed.contactTimer,.32);
  advance(r,.4,{x:0,y:1});advance(resumed,.4,{x:0,y:1});assert.deepEqual(serialize(r),serialize(resumed));
  const old=serialize(r);old.version=4;delete old.contactTimer;assert.equal(restore(old)?.contactTimer,0);
  assert.equal(old.version,4);for(const value of [-1,.33,NaN,Infinity,undefined])assert.equal(restore({...saved,contactTimer:value}),null);
});
test('30/60/120 Hz callers produce identical contact, crowd and movement state',()=>{
  const base=quiet(Array.from({length:16},(_,i)=>enemy(i+1,Math.cos(i)*100,Math.sin(i)*100,{speed:40})));
  const results=[30,60,120].map(hz=>{const r=restore(serialize(base));for(let i=0;i<hz*2;i++)step(r,{x:1,y:.2},1/hz);return serialize(r);});
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});
