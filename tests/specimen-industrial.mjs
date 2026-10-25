import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,restore,serialize,step,blocked,currentRoom,damageObject,hitEnemy,LIMITS,ROOMS} from '../webapp/frontend/js/specimen/engine.mjs';
import {emit,fragments,impact} from '../webapp/frontend/js/specimen/effects.mjs';
const H=1/60,ticks=(s,n,input={})=>{for(let i=0;i<n;i++)step(s,H,input);};
const fixture=(room,mass,x,y)=>{const s=restore({...serialize(createRun()),room,mass,x,y});currentRoom(s).enemies.forEach(e=>e.dead=e.eaten=true);return s;};

test('glass and panels change actual collision, checkpoint and saved state on impact',()=>{
 const s=fixture(0,32,400,200),o=currentRoom(s).objects.find(o=>o.kind==='glass');
 assert.ok(blocked(s,o.x,o.y));assert.equal(damageObject(s,o,1,240,0),true);assert.equal(blocked(s,o.x,o.y),false);
 assert.ok(s.checkpointEvent>0&&s.fragments.some(f=>f.material==='glass'));
 const copy=restore(serialize(s));assert.ok(copy);assert.equal(copy.rooms[0].objects.find(v=>v.id===o.id).broken,true);
 assert.ok(!blocked(copy,o.x,o.y));
});
test('a real thrown crate shatters glazing and breaks the final relay without body substitution',()=>{
 for(const [room,id,x,y]of [[0,'0:observation-glass',300,170],[5,'5:escape-relay',492,200]]){
  const s=fixture(room,32,x,y),r=currentRoom(s),box=r.objects.find(o=>o.kind==='crate'),o=r.objects.find(o=>o.id===id);
  Object.assign(box,{x:x+35,y,vx:360,vy:-30,thrown:true,hitIds:[]});ticks(s,28);
  assert.ok(o.broken,id+' resisted crate');assert.ok(s.fragments.length<=LIMITS.fragments);
 }
});
test('the terminal requires the relay, but mass and cargo can always be recovered',()=>{
 const s=fixture(5,32,606,212),r=currentRoom(s);step(s,H,{interact:true});assert.equal(r.gateOpen,false);
 const panel=r.objects.find(o=>o.relay);damageObject(s,panel,3,300,0);step(s,H,{interact:true});assert.ok(r.gateOpen);
 const raw=serialize(s);raw.x=404;raw.y=430;raw.mass=1;const recovery=restore(raw);step(recovery,H,{interact:true});assert.equal(recovery.mass,100);
 const next=serialize(recovery);next.x=454;next.y=210;const supply=restore(next),box=currentRoom(supply).objects.find(o=>o.kind==='crate');
 Object.assign(box,{x:720,y:650});step(supply,H,{interact:true});ticks(supply,120);assert.ok(Math.hypot(box.x-420,box.y-224)<2,'lost cargo cannot be recalled onto a stable landing');
});
test('small-form bursts cannot replace the heavy-form or crate rule at the final relay',()=>{
 const s=fixture(5,32,520,204),panel=currentRoom(s).objects.find(o=>o.relay);ticks(s,20,{x:1,burst:true});assert.equal(panel.broken,false);
 const big=fixture(5,100,520,204);ticks(big,20,{x:1,burst:true});assert.ok(currentRoom(big).objects.find(o=>o.relay).broken);
});
test('drops leave marks only after a surface collision and all effects have strict bounds',()=>{
 const s=fixture(0,32,400,620);impact(s,400,640,100,170,3);assert.equal(s.decals.length,0);ticks(s,100);
 assert.ok(s.decals.length>0);for(const d of s.decals){assert.ok(d.y>665||Math.abs(d.nx)===1,'blood mark floats in air');}
 for(let i=0;i<30;i++){emit(s,'blood',410,640,1,0,40);fragments(s,'metal',410,640,1,0,20);}
 assert.ok(s.particles.length<=LIMITS.particles&&s.fragments.length<=LIMITS.fragments&&s.decals.length<=LIMITS.decals);
 ticks(s,500);assert.equal(s.fragments.length,0);assert.equal(s.particles.length,0);
});
test('material fragments bounce, stay finite and settle or expire',()=>{
 const s=fixture(0,32,400,620);for(const material of ['glass','metal','tissue'])fragments(s,material,390,660,0,1,1);
 const [glass,metal,tissue]=s.fragments;assert.ok(glass.bounce>metal.bounce&&metal.bounce>tissue.bounce);
 ticks(s,30);for(const f of s.fragments){assert.ok(Number.isFinite(f.x+f.y+f.vx+f.vy));assert.ok(!blocked(s,f.x,f.y));assert.ok(Math.hypot(f.vx,f.vy)<420);}
 ticks(s,330);assert.equal(s.fragments.length,0);
});
test('a falling, struck and thrown human has bounded joints and collides at walls',()=>{
 const s=fixture(0,54,520,620),e=currentRoom(s).enemies[0];Object.assign(e,{eaten:false,dead:false,x:580,y:580,hp:3});
 hitEnemy(s,e,1,380,-80);assert.ok(e.pose?.length===4);ticks(s,120);
 for(const n of e.pose||[]){assert.ok(!blocked(s,n.x,n.y));assert.ok(Number.isFinite(n.x+n.y+n.px+n.py));}
 const copy=restore(serialize(s));assert.ok(copy);assert.equal(copy.rooms[0].enemies[0].hp,e.hp);
 const malformed=serialize(s);malformed.rooms[0].enemies[0].pose=[{x:Infinity}];assert.equal(restore(malformed),null);
});
test('v3 migrates by stable IDs preserving gates, victims, bank and lamp damage',()=>{
 const raw=JSON.parse(readFileSync(new URL('./fixtures/specimen-v3.json',import.meta.url)));
 const s=restore(raw);assert.ok(s);assert.equal(s.version,4);assert.equal(s.room,1);assert.equal(s.mass,54);
 assert.equal(s.rooms[0].gateOpen,true);assert.equal(s.rooms[0].enemies[0].eaten,true);assert.equal(s.rooms[1].objects[0].bank,22);
 assert.ok(s.rooms[0].objects.find(o=>o.id==='0:lamp3').broken);
 assert.equal(s.rooms[5].objects.find(o=>o.relay).broken,false);
 assert.ok(restore(serialize(s)));
});
test('a corpse settles on the floor and reload retains its bounded resting pose',()=>{
 const s=fixture(0,54,500,620),e=currentRoom(s).enemies[0];Object.assign(e,{eaten:false,dead:false});hitEnemy(s,e,6,260,-40);ticks(s,600);
 const before=e.pose.map(n=>({x:n.x,y:n.y}));ticks(s,120);
 e.pose.forEach((n,i)=>assert.ok(Math.hypot(n.x-before[i].x,n.y-before[i].y)<.05,'resting body still jitters'));
 const copy=restore(serialize(s));assert.ok(copy);assert.deepEqual(copy.rooms[0].enemies[0].pose,e.pose);
});
test('reload projects the entire head out of a newly introduced wall or panel',()=>{
 for(const [room,x,y]of [[0,360,176],[5,552,204],[0,300,456]]){
  const s=fixture(room,100,x,y),head=s.nodes[0];
  for(let j=0;j<64;j++)assert.ok(!blocked(s,head.x+Math.cos(j*Math.PI/32)*(head.r-.1),head.y+Math.sin(j*Math.PI/32)*(head.r-.1)));
  assert.ok(restore(serialize(s)));
 }
});
test('six compositions differ while their stable room names and portal elevations survive',()=>{
 assert.equal(new Set(ROOMS.map(r=>JSON.stringify(r.walls))).size,6);
 assert.deepEqual(ROOMS.map(r=>r.id),[0,1,2,3,4,5]);assert.equal(ROOMS[0].portals.exit.floor,456);assert.equal(ROOMS[5].portals.exit.floor,240);
});
