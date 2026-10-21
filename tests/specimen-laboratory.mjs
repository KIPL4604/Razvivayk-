import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,restore,serialize,ROOMS,blocked,currentRoom,flameClear} from '../webapp/frontend/js/specimen/engine.mjs';
import {TILE,COLS,ROWS,HEIGHT} from '../webapp/frontend/js/specimen/world.mjs';
const H=1/60,ticks=(s,n,input={})=>{for(let i=0;i<n;i++)step(s,H,input);};
const fixture=(room,mass,x,y)=>restore({...serialize(createRun()),room,mass,x,y});
test('human doors have actual landings, rooms rise across three floors and vent is narrow',()=>{
  assert.ok(HEIGHT>=700);assert.equal(ROWS*COLS,ROOMS[0].cells.length);
  for(const r of ROOMS){for(const p of Object.values(r.portals).filter(Boolean)){
    for(let x=p.x;x<p.x+p.w;x+=TILE){assert.ok(r.cells[p.floor/TILE*COLS+x/TILE],'door opens over a pit');assert.ok(!r.cells[(p.floor/TILE-2)*COLS+x/TILE],'blocked doorway');}
  }assert.ok(r.ladders.length>=2);if(r.vent)assert.equal(r.vent.h,24);}
  assert.ok(ROOMS.some(r=>r.portals.entry&&r.portals.entry.floor!==r.portals.exit.floor));
});
test('new run starts beside the ground-floor containment cell and a living checkpoint',()=>{
  const s=createRun();assert.ok(s.y>500);assert.ok(currentRoom(s).objects.some(o=>o.kind==='nest'));
  const nest=currentRoom(s).objects.find(o=>o.kind==='nest'),before=s.checkpointEvent;
  const near=fixture(0,32,nest.x+40,nest.y);ticks(near,3);assert.ok(near.checkpointEvent>before,'proximity checkpoint missing');
  const event=near.checkpointEvent;ticks(near,90);assert.equal(near.checkpointEvent,event,'checkpoint retriggers continuously');
});
test('crate release gives a bounded throw, gravity, collision bounce and human knockdown',()=>{
  const s=fixture(2,54,400,620),r=currentRoom(s),crate=r.objects.find(o=>o.kind==='crate'),enemy=r.enemies[0];
  Object.assign(crate,{x:452,y:620});Object.assign(enemy,{x:540,y:620,hp:5});r.enemies.slice(1).forEach(e=>e.dead=e.eaten=true);
  ticks(s,8,{grabbing:true,aimX:1,aimY:0});assert.equal(s.grab?.id,crate.id,'box cannot be selected');
  step(s,H,{aimX:1,aimY:0});assert.ok(crate.vx>180&&crate.vx<=480,'missing throw impulse');
  ticks(s,25);assert.ok(enemy.hp<5&&enemy.knock>0,'box impact does not damage and knock down');
  assert.ok(!blocked(s,crate.x,crate.y));
});
test('flamethrower telegraphs, emits a bounded burst and walls stop fire',()=>{
  const s=fixture(2,100,500,420),r=currentRoom(s),e=r.enemies.find(e=>e.kind==='flamer');r.enemies.filter(v=>v!==e).forEach(v=>v.dead=v.eaten=true);
  e.cooldown=0;ticks(s,10);assert.ok(e.windup>0);assert.equal(s.mass,100,'fire has no warning');
  ticks(s,55);assert.ok(s.mass<100,'flame has no gameplay damage');assert.ok(e.fireTime>=0&&e.fireTime<=1);
  const other=fixture(3,100,480,420),f=currentRoom(other).enemies.find(e=>e.kind==='flamer');Object.assign(f,{x:600,y:420,cooldown:0});ticks(other,100);assert.equal(other.mass,100,'fire crossed a closed door');
});

test('cargo bounces off partitions without hitting people behind them and keeps momentum in saves',()=>{
  const s=fixture(0,54,500,620),r=currentRoom(s),o=r.objects.find(o=>o.kind==='crate'),e=r.enemies[0];
  Object.assign(o,{x:605,y:620,vx:400,vy:0,thrown:true});Object.assign(e,{x:700,y:646});
  ticks(s,8);assert.ok(o.vx<0,'no wall rebound');assert.ok(o.x<630);assert.equal(e.hp,3,'impact crossed partition');
  const copy=restore(serialize(s)),box=currentRoom(copy).objects.find(v=>v.id===o.id);assert.equal(box.vx,o.vx);assert.equal(box.vy,o.vy);
  const invalid=serialize(s);invalid.rooms[0].objects.find(v=>v.id===o.id).vx=Infinity;assert.equal(restore(invalid),null);
  const duplicate=serialize(s);duplicate.rooms[2].enemies[1].id=duplicate.rooms[2].enemies[0].id;assert.equal(restore(duplicate),null);
});

test('a held lever needs a real short pull; a nearby box intercepts flame rays',()=>{
  const s=fixture(0,32,520,430);step(s,H,{aimX:1,aimY:0,grabbing:true});assert.equal(currentRoom(s).gateOpen,false);
  ticks(s,14,{aimX:1,aimY:0,grabbing:true});assert.equal(currentRoom(s).gateOpen,true);
  const cover=fixture(2,100,500,420),crate=currentRoom(cover).objects.find(o=>o.kind==='crate');Object.assign(crate,{x:540,y:430});
  assert.equal(flameClear(cover,566,424,500,420),false);crate.x=400;assert.equal(flameClear(cover,566,424,500,420),true);
});

test('room transitions use their actual doorway elevation and preserve a safe return path',()=>{
  const wall=fixture(0,32,700,620);ticks(wall,150,{x:1});assert.equal(wall.room,0);
  const door=fixture(0,32,700,416);ticks(door,90,{x:1});assert.equal(door.room,1);assert.ok(door.y>360&&door.y<456);
  ticks(door,160,{x:-1});assert.equal(door.room,0);assert.ok(door.y>360&&door.y<456);
});

test('all human entrances and exits connect by floors and ladders with maintenance doors open',()=>{
  for(const r of ROOMS){
    const cell=(x,y)=>x<0||x>=COLS||y<0||y>=ROWS?1:r.cells[y*COLS+x];
    const clear=(x,y)=>y>=2&&y<ROWS&&!cell(x,y-1)&&!cell(x,y-2);
    const ladder=(x,y)=>r.ladders.some(([lx,top,bottom])=>Math.abs(x-Math.floor(lx/TILE))<=1&&y>=top/TILE&&y<=bottom/TILE);
    const start=r.portals.entry?[1,r.portals.entry.floor/TILE]:[Math.floor(r.spawn[0]/TILE),28],goal=[30,r.portals.exit.floor/TILE],seen=new Set(),queue=[start];
    while(queue.length){const [x,y]=queue.shift(),key=x+','+y;if(seen.has(key)||!clear(x,y))continue;seen.add(key);
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(clear(nx,ny)&&(dy?ladder(x,y)&&ladder(nx,ny):cell(nx,ny)||ladder(nx,ny)))queue.push([nx,ny]);}
    }
    assert.ok(seen.has(goal.join(',')),'human route missing in '+r.id);
  }
});

test('a grabbed human body cannot be pulled through the narrow creature ventilation',()=>{
  const s=fixture(4,32,520,396),e=currentRoom(s).enemies[0];Object.assign(e,{x:648,y:396,cooldown:5});
  ticks(s,80,{aimX:1,aimY:0,grabbing:true});assert.equal(e.eaten,false);assert.ok(e.x>=638,'human body crossed duct casing');
});
