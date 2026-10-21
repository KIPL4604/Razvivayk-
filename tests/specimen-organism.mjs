import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyWeave,vineGeometry,ORGANISM_LIMITS} from '../webapp/frontend/js/specimen/organism.mjs';
import {createRun,restore,serialize,step} from '../webapp/frontend/js/specimen/engine.mjs';
const fixture=mass=>restore({...serialize(createRun()),mass,x:400,y:270});

test('all forms use open coil textures with bounded undistorted patches',()=>{
  for(const mass of [32,54,100]){const s=fixture(mass),before=JSON.stringify(s),w=bodyWeave(s);assert.ok(w.patches.length+2<=ORGANISM_LIMITS.patches);assert.ok(w.patches.some(p=>p.slot===3));assert.ok(w.patches.some(p=>p.slot===2));for(const p of w.patches){assert.ok(p.w>20&&p.h>20);assert.ok(Math.max(p.w/p.h,p.h/p.w)<1.5);assert.ok(Number.isFinite(p.x+p.y+p.angle));}assert.equal(JSON.stringify(s),before);}
});
test('coils follow body movement and reduced motion stops decorative sway',()=>{
  const s=fixture(100),a=bodyWeave(s,true);s.time+=4;assert.deepEqual(bodyWeave(s,true),a);assert.notDeepEqual(bodyWeave(s,false),a);
  for(let i=0;i<60;i++)step(s,1/60,{x:1});assert.notEqual(bodyWeave(s).mouth.x,a.mouth.x);
});
test('vine core has exact endpoints, continuous taper and a bounded sample count',()=>{
  for(const end of [{x:270,y:50},{x:40,y:290},{x:95,y:95}]){const start={x:90,y:95},g=vineGeometry(start,end,{base:6,bend:15,normal:{x:0,y:1}});assert.equal(g.points[0].x,start.x);assert.equal(g.points[0].y,start.y);assert.deepEqual({x:g.points.at(-1).x,y:g.points.at(-1).y},end);assert.ok(g.points.length<=ORGANISM_LIMITS.vineSamples+1);for(let i=1;i<g.points.length;i++){assert.ok(g.points[i].radius<=g.points[i-1].radius);assert.ok(Number.isFinite(g.points[i].nx+g.points[i].ny));}}
});
test('three fine red windings cross behind and in front and meet the planted tip',()=>{
  const g=vineGeometry({x:30,y:90},{x:250,y:130},{base:6,bend:20});assert.equal(g.strands.length,3);
  for(const strand of g.strands){assert.ok(strand.some(p=>p.front)&&strand.some(p=>!p.front));assert.equal(strand.at(-1).x,250);assert.equal(strand.at(-1).y,130);}
});
