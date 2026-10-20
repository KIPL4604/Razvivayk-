import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,serialize} from '../webapp/frontend/js/lumen/engine.mjs';
import {cameraScale,sceneryOpacity,crystalTier,HealthFeedback} from '../webapp/frontend/js/lumen/presentation.mjs';

test('tick observer sees every fixed tick and does not change simulation results',()=>{
  const baseline=createRun({seed:91}),observed=createRun({seed:91});let ticks=0,previous=-1;
  for(const dt of [.008,.009,.033,.1,.016,.05]){
    step(baseline,{x:.7,y:.1},dt);
    step(observed,{x:.7,y:.1},dt,state=>{assert(state.time>previous);previous=state.time;ticks++;});
  }
  assert(ticks>6);assert.deepEqual(serialize(observed),serialize(baseline));
});
test('camera exposes 25 percent more world at all supported widths',()=>{
  for(const [w,h] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
    const old=Math.max(.72,Math.min(1.25,Math.min(w/650,h/650)));
    assert(Math.abs(old/cameraScale(w,h)-1.25)<1e-9);
  }
});
test('plants fade continuously as the player crosses the old popping boundary',()=>{
  const prop={index:3,x:0,y:80},values=[];
  for(let x=-150;x<=150;x++)values.push(sceneryOpacity(prop,{x,y:0}));
  for(let i=1;i<values.length;i++)assert(Math.abs(values[i]-values[i-1])<.02);
  assert(values.every(v=>v>=.45&&v<=1));
  assert.equal(sceneryOpacity({...prop,index:0},{x:0,y:0}),1);
});
test('experience tiers have independent identifiers and legacy value fallback',()=>{
  assert.equal(crystalTier({value:2}),1);assert.equal(crystalTier({value:12}),2);
  assert.equal(crystalTier({value:40}),3);assert.equal(crystalTier({value:200,tier:1}),1);
});

test('real contact produces one hit cue and a delayed health trail without simulation writes',()=>{
  const run=createRun({seed:31}),cue=new HealthFeedback();cue.update(run);
  run.enemies=[{id:50,x:0,y:0,kind:'mote',hp:100,maxHp:100,radius:10,
    speed:0,damage:17,value:2,phase:0,hitFlash:0,fireTimer:9}];run.nextId=51;
  step(run,{},1/60);const saved=serialize(run);cue.update(run);
  assert.equal(run.player.hp,93);assert(cue.sample(run.time).hurt);
  assert.equal(cue.sample(run.time).flash,1);
  assert.equal(cue.sample(run.time).trail,1);
  const first=cue.hitSince;
  for(let i=0;i<12;i++){step(run,{},1/60);cue.update(run);}
  assert.equal(cue.hitSince,first,'invulnerable contact must not restart feedback');
  const before=JSON.stringify(serialize(run));cue.sample(run.time);cue.update(run);
  assert.equal(JSON.stringify(serialize(run)),before);
  assert.equal(saved.player.hp,93);
  const settled=cue.sample(first+.7);
  assert.equal(settled.trail,93/110);assert.equal(settled.flash,0);assert(!settled.hurt);
  const shotRun=createRun({seed:34}),shotCue=new HealthFeedback();shotCue.update(shotRun);
  shotRun.projectiles=[{id:50,x:0,y:0,vx:0,vy:0,radius:4,damage:17,life:1,hostile:true}];
  shotRun.nextId=51;step(shotRun,{},1/60);shotCue.update(shotRun);
  assert.equal(shotRun.player.hp,93);assert(shotCue.sample(shotRun.time).hurt);
});

test('health feedback ignores healing and stale invulnerability after restore',()=>{
  const run=createRun({seed:32});run.time=10;run.player.hp=50;run.player.invulnerable=.7;
  const cue=new HealthFeedback();cue.update(run);
  assert.equal(cue.sample(run.time).flash,0);
  run.player.hp=95;run.player.maxHp=130;cue.update(run);
  assert.equal(cue.sample(run.time).flash,0);assert.equal(cue.sample(run.time).ratio,95/130);
  run.time+=.1;run.player.hp=80;cue.update(run);assert(cue.sample(run.time).hurt);
  const frozen=cue.sample(run.time);cue.update(run);assert.deepEqual(cue.sample(run.time),frozen);
  run.time=0;cue.update(run);assert.equal(cue.sample(0).flash,0);
  run.time=11;run.player.hp=70;cue.update(run);assert(cue.sample(11).hurt);
  run.runId='next-run';cue.update(run);assert.equal(cue.sample(11).flash,0);
});

test('lethal health and damage with simultaneous healing remain readable',()=>{
  const run=createRun({seed:33}),cue=new HealthFeedback();cue.update(run);
  run.time=1;run.player.invulnerable=.8;run.player.hp=110;cue.update(run);
  assert(cue.sample(1).hurt,'a real hit can be offset by a kill heal in the same tick');
  run.time=2;run.player.hp=0;cue.update(run);
  assert.equal(cue.sample(2).ratio,0);assert.equal(cue.sample(2).trail,1);
  assert.equal(cue.sample(2.6).trail,0);assert.equal(cue.sample(2.6).flash,0);
});
