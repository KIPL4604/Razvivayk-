import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createRun,step,serialize,restore,formFor,ROOMS,currentRoom,blocked,lineClear,interaction,LIMITS} from '../webapp/frontend/js/specimen/engine.mjs';

const ticks=(s,n,input={})=>{for(let i=0;i<n;i++)step(s,1/60,input);return s;};
const fixture=(room,mass,x,y)=>restore({...serialize(createRun()),room,mass,x,y});
function move(s,x,y,max=1200){const before=s.room;for(let i=0;i<max&&s.status==='playing';i++){const dx=x-s.x,dy=y-s.y,d=Math.hypot(dx,dy);if(d<5||s.room!==before)return;step(s,1/60,{x:dx/d,y:dy/d});}assert.ok(s.status==='won'||s.room!==before||Math.hypot(s.x-x,s.y-y)<8,`Move blocked: room ${s.room} (${s.x.toFixed(1)},${s.y.toFixed(1)}) → (${x},${y})`);}
function consume(s,max=3000){for(let i=0;i<max&&s.status==='playing';i++){const enemies=currentRoom(s).enemies.filter(e=>!e.eaten);if(!enemies.length)return;enemies.sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y));const e=enemies[0],dx=e.x-s.x,dy=e.y-s.y,d=Math.hypot(dx,dy)||1;step(s,1/60,{x:d>70?dx/d:0,y:d>70?dy/d:0,aimX:dx/d,aimY:dy/d,grabbing:s.grab?.type!=='object'});}assert.fail(`Could not consume room ${s.room}; mass ${s.mass}; status ${s.status}`);}

test('six original connected rooms and bounded three forms',()=>{assert.equal(ROOMS.length,6);assert.equal(formFor(32),0);assert.equal(formFor(54),1);assert.equal(formFor(100),2);for(const [mass,count]of [[32,6],[54,10],[100,16]])assert.equal(fixture(0,mass,184,236).nodes.length,count);});
test('fixed simulation, bounded catch-up and no invalid dt',()=>{const a=createRun(),b=createRun();ticks(a,120,{x:1});for(let i=0;i<60;i++)step(b,1/30,{x:1});assert.equal(a.x,b.x);const t=a.ticks;step(a,10);assert.ok(a.ticks-t<=10);step(a,NaN);assert.ok(Number.isFinite(a.time));});
test('body and head collide with the actual room grid',()=>{const s=createRun();ticks(s,500,{x:-1,y:-1});for(const n of s.nodes){assert.ok(!blocked(s,n.x,n.y));assert.ok(n.x>=n.r&&n.y>=n.r);}assert.ok(s.x>=48&&s.y>=48);});
test('grab and consume a technician, growing the physical body',()=>{const s=fixture(0,32,300,646);ticks(s,100,{aimX:1,aimY:0,grabbing:true});assert.equal(s.kills,1);assert.equal(s.mass,54);assert.equal(s.nodes.length,10);assert.ok(currentRoom(s).enemies[0].eaten);});
test('walls prevent a distant grab and ray interaction',()=>{const s=fixture(1,32,350,190);assert.equal(lineClear(s,350,190,450,190),false);ticks(s,80,{aimX:1,aimY:0,grabbing:true});assert.equal(s.grab,null);});
test('grabbed cargo follows the tentacle and drops after release',()=>{const s=fixture(0,32,390,608),crate=currentRoom(s).objects.find(o=>o.kind==='crate'),start=crate.x;ticks(s,25,{aimX:.88,aimY:.47,grabbing:true});assert.equal(s.grab?.type,'object');assert.ok(crate.x<start-10);step(s,1/60,{});assert.equal(s.grab,null);});
test('lever opens the actual collision gate',()=>{const s=fixture(0,32,520,430);assert.ok(blocked(s,660,400));step(s,1/60,{interact:true});assert.equal(currentRoom(s).gateOpen,true);assert.equal(blocked(s,660,400),false);});
test('reservoir stores and returns the exact mass',()=>{const s=fixture(1,100,250,430);assert.equal(interaction(s).label,'Оставить массу');step(s,1/60,{interact:true});assert.equal(s.mass,32);assert.equal(s.nodes.length,6);assert.equal(s.limbs.length,6);assert.ok(s.limbs.every(l=>s.nodes[l.root]));assert.equal(currentRoom(s).objects[0].bank,68);step(s,1/60,{interact:true});assert.equal(s.mass,100);assert.equal(s.limbs.length,10);assert.ok(s.limbs.every(l=>s.nodes[l.root]));assert.equal(currentRoom(s).objects[0].bank,0);});
test('small form passes the service channel, larger form is stopped',()=>{const small=fixture(1,32,320,396),large=fixture(1,100,320,396);ticks(small,110,{x:1});ticks(large,110,{x:1});assert.ok(small.x>470);assert.ok(large.x<336);});
test('heavy barrier needs a large-form burst and opens a route',()=>{const big=fixture(3,100,500,416),small=fixture(3,32,500,416);step(big,1/60,{x:1,burst:true});ticks(small,50,{x:1,burst:true});assert.equal(currentRoom(big).gateOpen,true);assert.equal(currentRoom(small).gateOpen,false);});
test('guards prepare shots, damage biomass and respect caps',()=>{const s=fixture(2,100,655,610);ticks(s,220);assert.ok(s.mass<100);assert.ok(s.bullets.length<=LIMITS.bullets);assert.ok(s.particles.length<=LIMITS.particles);});
test('save roundtrip whitelists state and rejects corrupted records',()=>{const s=fixture(3,100,220,300),raw=serialize(s);raw.untrusted='ignored';const copy=restore(raw);assert.equal(copy.room,3);assert.equal(copy.mass,100);assert.equal(copy.untrusted,undefined);assert.equal(restore({...raw,mass:NaN}),null);assert.equal(restore({...raw,room:44}),null);assert.equal(restore({...raw,status:'dead'}),null);assert.equal(restore({...raw,rooms:[]}),null);});

test('limbs plant on real surfaces, retain contacts and replant during travel',()=>{
  const s=createRun();ticks(s,45);assert.equal(s.limbs.length,6);const planted=s.limbs.filter(l=>l.planted);assert.ok(planted.length>=3);
  for(const l of planted){assert.ok(blocked(s,l.anchor.x,l.anchor.y));assert.ok(Math.hypot(l.anchor.x-s.nodes[l.root].x,l.anchor.y-s.nodes[l.root].y)<=l.reach*1.03);}
  const first=planted.map(l=>({...l.anchor}));ticks(s,5);assert.ok(s.limbs.some(l=>l.anchor&&first.some(a=>a.x===l.anchor.x&&a.y===l.anchor.y)));
  ticks(s,110,{x:1});assert.ok(s.x>280);assert.ok(s.limbs.some(l=>l.anchor&&!first.some(a=>a.x===l.anchor.x&&a.y===l.anchor.y)));
  assert.ok(s.limbs.length<=LIMITS.limbs);
});
test('a lamp can be grabbed, extinguished, dropped and restored broken',()=>{
  const s=fixture(0,32,130,564),lamp=currentRoom(s).objects.find(o=>o.id==='0:lamp3');assert.equal(lamp.broken,false);
  ticks(s,20,{aimX:0,aimY:-1,grabbing:true});assert.equal(lamp.broken,true);assert.equal(s.grab,null);const y=lamp.y;ticks(s,60);assert.ok(lamp.y>y+40);assert.ok(lamp.y<672);
  const saved=restore(serialize(s));assert.equal(currentRoom(saved).objects.find(o=>o.id===lamp.id).broken,true);
});
test('bullets and a burst can break lamps',()=>{
  const bullet=fixture(0,32,200,300),a=currentRoom(bullet).objects.find(o=>o.id==='0:lamp3');bullet.bullets.push({x:a.x-15,y:a.y,vx:310,vy:0,life:1});ticks(bullet,4);assert.equal(a.broken,true);
  const burst=fixture(0,32,130,529),b=currentRoom(burst).objects.find(o=>o.id==='0:lamp3');step(burst,1/60,{y:-1,burst:true});assert.equal(b.broken,true);
});
test('v1 and v2 saves migrate their progress to the rebuilt human laboratory',()=>{
  const raw=JSON.parse(readFileSync(new URL('./fixtures/specimen-v2.json',import.meta.url)));
  for(const version of [1,2]){const saved=structuredClone(raw);saved.version=version;if(version===1)saved.rooms.forEach(r=>r.objects=r.objects.filter(o=>!o.id.includes(':lamp')));
    const copy=restore(saved);assert.ok(copy);assert.equal(copy.version,3);assert.equal(copy.room,1);assert.equal(copy.mass,80);assert.equal(currentRoom(copy).objects[0].bank,32);assert.equal(copy.rooms[0].enemies[0].eaten,true);assert.deepEqual([copy.x,copy.y],ROOMS[1].spawn);
  }
  const invalid=serialize(createRun());delete invalid.rooms[0].objects.at(-1).broken;assert.equal(restore(invalid),null);
});

test('complete playable vertical route: hunt, climb, shrink, duct, burst and airlock',()=>{
  const s=createRun(),route=JSON.parse(readFileSync(new URL('./fixtures/specimen-laboratory-route.json',import.meta.url)));
  for(const [action,x,y]of route){
    if(action==='move')move(s,x,y,2400);
    else if(action==='hunt'){
      for(let i=0;i<1800;i++){const e=currentRoom(s).enemies.find(e=>e.id===x);if(e.eaten)break;const dx=e.x-s.x,dy=e.y-s.y,d=Math.hypot(dx,dy)||1;
        step(s,1/60,{x:d>70?dx/d:0,y:d>70?dy/d:0,aimX:dx/d,aimY:dy/d,grabbing:s.grab?.type!=='object'});assert.equal(s.status,'playing','died hunting '+x);
      }assert.ok(currentRoom(s).enemies.find(e=>e.id===x).eaten,'cannot hunt '+x);
    }else if(action==='use')step(s,1/60,{interact:true});
    else if(action==='burst'){step(s,1/60,{x,y,burst:true});ticks(s,12,{x,y});}
    else if(action==='room')assert.equal(s.room,x);
    else if(action==='mass')assert.equal(s.mass,x);
    else if(action==='won')assert.equal(s.status,'won');
  }
  assert.equal(s.visited.length,6);assert.ok(s.time<600);assert.ok(s.nodes.length<=16);
});
