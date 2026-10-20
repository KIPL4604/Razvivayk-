import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,serialize} from '../webapp/frontend/js/lumen/engine.mjs';
import {cameraScale,sceneryOpacity,crystalTier} from '../webapp/frontend/js/lumen/presentation.mjs';

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
