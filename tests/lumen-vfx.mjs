import test from 'node:test';
import assert from 'node:assert/strict';
import {WeaponVFX,arenaCamera} from '../webapp/frontend/js/lumen/weapon-vfx.mjs';
import {createRun,step,serialize} from '../webapp/frontend/js/lumen/engine.mjs';

const shot=(id,x=0)=>({id,x,y:0,vx:500,vy:10,weapon:'flame',hostile:false});
const snapshot=(time,shots=[],runId='vfx-test')=>({time,projectiles:shots,runId});

test('VFX observes real fixed ticks without changing the simulation or its RNG',()=>{
  const a=createRun({seed:320}),b=createRun({seed:320}),vfx=new WeaponVFX();
  for(let i=0;i<180;i++){
    step(a,{x:.5,y:.2},1/60);
    step(b,{x:.5,y:.2},1/60,state=>vfx.observe(state));
  }
  assert.deepEqual(serialize(a),serialize(b));
});

test('new shots flash once; paused frames, resume and a new run do not replay stale muzzles',()=>{
  const vfx=new WeaponVFX();vfx.observe(snapshot(10,[shot(1)]));assert.equal(vfx.bursts.length,0);
  vfx.observe(snapshot(10.02,[shot(1,10),shot(2)]));assert.equal(vfx.bursts.length,1);
  vfx.observe(snapshot(10.02,[shot(1,10),shot(2)]));assert.equal(vfx.bursts.length,1);
  vfx.observe(snapshot(10.2,[]));assert.equal(vfx.bursts.length,0);assert.equal(vfx.shots.size,0);
  vfx.observe(snapshot(5,[shot(3)]));assert.equal(vfx.bursts.length,0);
  vfx.observe(snapshot(5.1,[shot(4)],'next-run'));assert.equal(vfx.bursts.length,0);
});

test('frozen simulation records are untouched and local histories stay bounded in dense combat',()=>{
  const vfx=new WeaponVFX();
  for(let i=0;i<100;i++){
    const shots=Object.freeze(Array.from({length:300},(_,id)=>Object.freeze(shot(id+i*4,id+i*5))));
    const state=Object.freeze(snapshot(i/60,shots));vfx.observe(state);
    assert(vfx.shots.size<=160);assert(vfx.bursts.length<=28);
    assert([...vfx.shots.values()].every(e=>e.points.length<=7));
  }
  vfx.reset();assert.equal(vfx.shots.size,0);assert.equal(vfx.bursts.length,0);
});

test('arena camera exposes the complete lethal border at mobile, tablet and desktop sizes',()=>{
  const arena={x:150,y:-50,radius:330},player={x:25,y:20};
  for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
    const view=arenaCamera(width,height,1,player,arena);
    assert.equal(view.x,arena.x);assert.equal(view.y,arena.y);
    assert(arena.radius*2*view.scale+60<width);
    assert(arena.radius*2*view.scale<height-200);
    assert(view.scale<=1);
  }
  assert.deepEqual(arenaCamera(375,812,.576,player,null),{x:25,y:20,scale:.576});
});

test('dense projectile fields render at most 24 trails per presentation frame',()=>{
  const vfx=new WeaponVFX(),shots=Array.from({length:160},(_,id)=>({...shot(id),weapon:'needle'}));
  vfx.observe(snapshot(0,shots));
  const next=shots.map(e=>({...e,x:e.x+10}));vfx.observe(snapshot(.02,next));
  let strokes=0;
  const ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++;}};
  const r={ctx,zoom:.5,dpr:1,media:{matches:false},at:(x,y)=>[x,y]};
  vfx.beginFrame();for(const s of next)vfx.trail(r,s,s,.02);
  assert.equal(strokes,24);
  vfx.beginFrame();vfx.trail(r,next[0],next[0],.02);assert.equal(strokes,25);
  r.media.matches=true;vfx.beginFrame();vfx.trail(r,next[0],next[0],.02);assert.equal(strokes,25);
});

test('weapon effects stay finite, light budget is bounded and reduced motion removes emission',()=>{
  let gradients=0,draws=0;
  const methods=['save','restore','translate','rotate','fillRect','beginPath','moveTo','lineTo','stroke','fill','closePath','setLineDash','ellipse'];
  const ctx=Object.fromEntries(methods.map(id=>[id,()=>{}]));
  ctx.drawImage=(...args)=>{assert(args.slice(1).every(Number.isFinite));draws++;};
  ctx.createRadialGradient=(...args)=>{assert(args.every(Number.isFinite));gradients++;return {addColorStop(){}};};
  const r={ctx,zoom:.5,dpr:1,media:{matches:false},art:{images:{'arena-fx':{}}},at:(x,y)=>{assert(Number.isFinite(x)&&Number.isFinite(y));return[x*.5,y*.5];},blit(){}};
  const vfx=new WeaponVFX();vfx.beginFrame();
  for(let i=0;i<100;i++)vfx.glow(r,0,0,32,'#fff',.2);
  assert.equal(gradients,12);r.media.matches=true;vfx.beginFrame();vfx.glow(r,0,0,32,'#fff',.2);assert.equal(gradients,12);
  for(const reduced of [false,true]){
    r.media.matches=reduced;
    for(const weapon of ['flame','ice','prism','meteor','mine','gravity','eclipse','frostnova','storm','sunlance','bell']){
      for(const kind of ['impact','pulse','fusion','arc'])assert(vfx.effect(r,{kind,weapon,x:0,y:0,toX:140,toY:30,radius:80,life:.2,maxLife:.5}));
    }
    for(const kind of ['flame','briar','meteor','gravity'])assert(vfx.zone(r,{kind,id:1,x:0,y:0,radius:70,life:.2,maxLife:.65},.45));
  }
  assert(draws>50);assert(!vfx.effect(r,{kind:'warning',life:1,maxLife:1}),'danger telegraphs retain their own renderer');
});
