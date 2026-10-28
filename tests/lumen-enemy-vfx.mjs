import test from 'node:test';
import assert from 'node:assert/strict';
import {EnemyVFX,enemyProjectileFamily} from '../webapp/frontend/js/lumen/enemy-vfx.mjs';

const shot=(id,x=0,extra={})=>({id,x,y:0,vx:145,vy:0,radius:6,damage:9,weapon:'hostile',hostile:true,life:3,...extra});
const state=(time,projectiles=[],extra={})=>({time,runId:'enemy-vfx',map:'castle',arena:null,enemies:[],player:{x:0,y:800,radius:13},projectiles,...extra});

test('enemy visual families use existing source and projectile facts without changing records',()=>{
  const frozen=Object.freeze(shot(1));
  assert.equal(enemyProjectileFamily(Object.freeze(state(0,[],{arena:{phase:'fighting'}})),frozen),0);
  assert.equal(enemyProjectileFamily(state(0,[],{enemies:[{x:0,y:0,bossType:'conductor'}]}),shot(2,0,{vx:150,damage:17})),0);
  assert.equal(enemyProjectileFamily(state(0,[],{enemies:[{x:0,y:0,bossType:'gatekeeper'}]}),shot(3,0,{vx:155,damage:19})),1);
  assert.equal(enemyProjectileFamily(state(0),shot(4,0,{radius:24,vx:0,vy:0})),2);
  assert.equal(enemyProjectileFamily(state(0),frozen),3);
  assert.equal(enemyProjectileFamily(state(0,[],{map:'quarry'}),shot(5,0,{weapon:'shard'})),1);
});

test('hostile histories, disappearance fades and rewind/resume stay bounded and presentation-only',()=>{
  const vfx=new EnemyVFX();
  for(let tick=0;tick<80;tick++){
    const shots=Object.freeze(Array.from({length:260},(_,id)=>Object.freeze(shot(id+tick*3,id*7+tick*4))));
    const frame=Object.freeze(state(tick/60,shots)),before=JSON.stringify(frame);
    vfx.observe(frame);assert.equal(JSON.stringify(frame),before);
    assert(vfx.shots.size<=160);assert(vfx.fades.length<=24);
    assert([...vfx.shots.values()].every(s=>s.points.length<=6));
  }
  const count=vfx.fades.length;vfx.observe(state(79/60,[]));assert.equal(vfx.fades.length,count,'paused redraw must not emit');
  vfx.observe(state(0,[shot(1)]));assert.equal(vfx.fades.length,0,'rewind must not replay impacts');
  vfx.observe(state(.02,[shot(2)],{runId:'another-run'}));assert.equal(vfx.fades.length,0,'new run must not replay impacts');
  vfx.reset();assert.equal(vfx.shots.size,0);assert.equal(vfx.fades.length,0);
});

test('victory cancellation clears hostile residue rather than replaying an impact field',()=>{
  const vfx=new EnemyVFX();vfx.observe(state(1,[shot(1)],{arena:{phase:'fighting'}}));
  vfx.observe(state(1.02,[],{arena:{phase:'reward'}}));
  assert.equal(vfx.fades.length,0);assert.equal(vfx.shots.size,0);
});

test('authored enemy sheets render finite directional frames; trail/spark budgets and reduced motion hold',()=>{
  const vfx=new EnemyVFX(),shots=Array.from({length:260},(_,id)=>shot(id,id*4));
  vfx.observe(state(0,shots));const next=shots.map(p=>({...p,x:p.x+8}));vfx.observe(state(.05,next));
  let draws=0,strokes=0,sparks=0;
  const c=Object.fromEntries(['save','restore','translate','rotate','beginPath','moveTo','lineTo','fill','ellipse'].map(k=>[k,()=>{}]));
  c.stroke=()=>strokes++;c.fillRect=()=>sparks++;
  c.drawImage=(...args)=>{assert(args.slice(1).every(Number.isFinite));assert(args[1]>=0&&args[1]<=160);assert(args[2]>=0&&args[2]<=96);draws++;};
  const r={ctx:c,zoom:.5,dpr:1,map:'castle',arena:null,media:{matches:false},art:{images:{'enemy-projectiles':{}},manifest:{enemyProjectiles:{anchor:[20,16]}}},at:(x,y)=>[x*.5,y*.5]};
  vfx.beginFrame();for(const p of next)assert(vfx.projectile(r,p,p,.05));vfx.aftermath(r,.05);
  assert(draws>=next.length&&draws<=next.length+16);assert(vfx.trails<=32);assert(vfx.sparks<=36);assert(vfx.halos<=16);assert(strokes>0);
  r.media.matches=true;vfx.beginFrame();const oldStrokes=strokes,oldSparks=sparks;
  for(const p of next)assert(vfx.projectile(r,p,p,.05));vfx.aftermath(r,.05);
  assert.equal(strokes,oldStrokes);assert.equal(sparks,oldSparks);assert.equal(vfx.trails,0);assert.equal(vfx.sparks,0);
});
