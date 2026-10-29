import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,chooseUpgrade,serialize,restore} from '../webapp/frontend/js/lumen/engine.mjs';
import {CASTLE,CASTLE_DOOR_HP,castleLayout,castleProps,castleGuidance,castleColliders} from '../webapp/frontend/js/lumen/castle.mjs';
import {MAPS,MAX_WEAPONS,MAX_ARTIFACTS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {normalizeMeta,mapAvailable,recordProgress,bankCoins} from '../webapp/frontend/js/lumen/economy.mjs';
import {xpForLevel} from '../webapp/frontend/js/lumen/progression.mjs';
import {BOSS_VARIANTS,updateBossAttacks} from '../webapp/frontend/js/lumen/bosses.mjs';
const dt=1/60;
const advance=(s,seconds,input={})=>{for(let n=0;n<Math.round(seconds/dt)&&s.status==='playing';n++)step(s,input,dt);};
function goal(){const s=createRun({map:'castle',seed:430});s.spawnedGuardians=3;s.spawnedElites=4;s.spawnTimer=3;s.level=44;s.xpNext=xpForLevel(44);s.xp=s.xpNext;step(s,{},dt);return s;}
function roundTrip(s){const data=serialize(s),copy=restore(data);assert(copy,'castle restore rejected '+s.castle?.phase+'/'+s.arena?.phase);assert.deepEqual(serialize(copy),data);return copy;}
function breach(s){
  const door=s.enemies.find(e=>e.kind==='castle-door');assert(door);
  s.projectiles.push({id:s.nextId++,x:door.x,y:door.y,vx:0,vy:0,radius:4,damage:CASTLE_DOOR_HP,life:1,weapon:'spark',hostile:false,pierce:0,hits:[],returning:false});
  step(s,{},dt);assert.equal(s.castle.phase,'passage');assert(s.castle.doorBroken);return s;
}
function fight(){const s=breach(goal());s.player.y=s.castle.hallY+500;step(s,{},dt);assert.equal(s.arena.phase,'forming');advance(s,2.5);assert.equal(s.arena.phase,'fighting');return s;}

test('castle is the third expedition, requires quarry and preserves earlier map targets and loadout caps',()=>{
  assert.equal(MAPS.quarry.next,'castle');assert.equal(MAPS.garden.goal,30);assert.equal(MAPS.quarry.goal,35);
  assert.equal(MAPS.castle.goal,45);assert.equal(MAX_WEAPONS,4);assert.equal(MAX_ARTIFACTS,5);
  assert(!mapAvailable(normalizeMeta({clearedMaps:['garden']}),'castle'));
  assert(mapAvailable(normalizeMeta({clearedMaps:['garden','quarry']}),'castle'));
  assert(!normalizeMeta({clearedMaps:['garden','castle']}).clearedMaps.includes('castle'));
});

test('shared corridor geometry is22.5m wide,50m long, repeats fullsize props and has no guidance collider',()=>{
  assert.equal(CASTLE.halfWidth*2/32,22.5);assert.equal(CASTLE.segmentLength/32,50);
  assert.equal(CASTLE.carpetHalfWidth*2/32,7.5);assert.equal(CASTLE.hallHalfWidth*2/32,45);
  const props=castleProps(0,319).filter(p=>p.y>=0&&p.y<320);
  const repeated=castleProps(1600,1919).filter(p=>p.y>=1600&&p.y<1920).map(p=>({...p,y:p.y-1600}));
  assert.deepEqual(repeated,props);assert(props.some(p=>p.kind==='column'));
  const north=castleProps(-1600,-1281).filter(p=>p.y>=-1600&&p.y<-1280).map(p=>({...p,y:p.y+1600}));
  assert.deepEqual(north,props,'negative-world corridors must repeat too');
  assert.equal(props.find(p=>p.kind==='piano').radius,56);
  assert.equal(Math.abs(props.find(p=>p.kind==='piano').x),CASTLE.halfWidth-98);
  assert.equal(Math.abs(props.find(p=>p.kind==='column').x),CASTLE.halfWidth-46);
  const s=goal(),before=serialize(s),guidance=castleGuidance(s);
  assert.deepEqual(guidance,{x:0,y:s.castle.doorY});assert.deepEqual(serialize(s),before);
  assert(castleColliders(-100,100).every(p=>p.kind==='castle-prop'));
  assert(!s.enemies.some(e=>e.kind==='arrow'));roundTrip(s);
});

test('level45 creates an exit ahead, holds the level cap and requires breaking the door then entering the hall',()=>{
  let s=goal();assert.equal(s.level,45);assert.equal(s.status,'playing');assert.equal(s.arena,null);
  assert.equal(s.castle.phase,'guidance');s.xp=1e6;advance(s,1);
  assert.equal(s.level,45);assert.deepEqual(s.choices,[]);assert.equal(s.status,'playing');assert.equal(s.arena,null);
  s=roundTrip(s);const before=s.player.y;advance(s,.5,{y:-1});assert(s.player.y<before);
  const doorY=s.castle.doorY,hallY=s.castle.hallY;assert(doorY<=-640&&doorY>=-960);
  s.player.y=doorY-50;step(s,{},dt);assert.equal(s.arena,null);assert(s.player.y>=doorY+20);
  breach(s);roundTrip(s);s.player.y=hallY+CASTLE.triggerRadius+30;step(s,{},dt);assert.equal(s.arena,null);
  s.player.y=hallY+CASTLE.triggerRadius-5;step(s,{},dt);
  assert.equal(s.castle.phase,'arena');assert.equal(s.arena.kind,'castle');assert.equal(castleGuidance(s),null);
  assert.equal(s.enemies.length,1);assert.equal(s.enemies[0].bossType,'monarch');assert.equal(s.enemies[0].radius,100);
  assert.equal(s.enemies[0].hp,52000);assert(!s.enemies.some(e=>e.kind==='arena-tick'));roundTrip(s);
});

test('the cap creates the door ahead of the current position rather than at a fixed world origin',()=>{
  for(const y of [-12432,0,18294]){
    const s=createRun({map:'castle',seed:8});s.player.y=y;s.level=44;s.xpNext=xpForLevel(44);s.xp=s.xpNext;s.spawnTimer=3;
    step(s,{},dt);const layout=castleLayout(s);
    assert(y-layout.doorY>=640&&y-layout.doorY<960);assert.equal(layout.hallY,layout.doorY-650);
    assert.equal(layout.transition,0);assert.equal(s.enemies.find(e=>e.kind==='castle-door').hp,6000);
    roundTrip(s);
  }
});

test('a full-width door blocks walking, takes real weapon hits and grants no kill, XP or coins when destroyed',()=>{
  let s=goal();const door=s.enemies.find(e=>e.kind==='castle-door'),anchor={x:door.x,y:door.y};
  s.player.x=CASTLE.halfWidth-25;s.player.y=door.y+24;s.boltTimer=3;const hp=s.player.hp;
  advance(s,1,{y:-1});assert.equal(door.hp,6000);assert.equal(s.player.hp,hp);
  assert(s.player.y>=door.y+20);assert.equal(s.arena,null);roundTrip(s);
  s.player.x=0;s.player.y=door.y+145;s.boltTimer=0;s.upgrades={spark:8,pulse:1,gravity:1};s.foundWeapons=['pulse','gravity'];
  advance(s,.3);assert(door.hp<6000&&door.hp>0);assert.equal(door.x,anchor.x);assert.equal(door.y,anchor.y);
  s=roundTrip(s);const before={x:s.player.x,y:s.player.y},kills=s.kills,xp=s.xp,coins=s.coinsEarned;
  breach(s);assert.equal(s.player.x,before.x);assert.equal(s.player.y,before.y);assert.equal(s.arena,null);
  assert.equal(s.kills,kills);assert.equal(s.xp,xp);assert.equal(s.coinsEarned,coins);assert.equal(s.chests.length,0);
  assert.equal(s.enemies.filter(e=>e.kind==='castle-door').length,0);roundTrip(s);
  advance(s,.1,{y:-1});assert.equal(s.arena,null,'breaking the door must not teleport into the boss fight');
  for(let n=0;n<180&&!s.arena;n++)step(s,{y:-1},dt);
  assert.equal(s.arena?.kind,'castle');assert(s.player.y<s.castle.doorY);assert.equal(s.castle.phase,'arena');
  assert(s.castle.doorTime>0);roundTrip(s);
});

test('corridor walls and furniture block movement while the pre45 corridor is infinite in both directions',()=>{
  const s=createRun({map:'castle',seed:5});s.spawnTimer=3;s.player.x=CASTLE.halfWidth-25;
  for(let i=0;i<20;i++)step(s,{x:1},.25);
  assert(s.player.x<=CASTLE.halfWidth-20);
  s.enemies=[];s.player.x=0;s.player.y=-5000;advance(s,.5,{y:-1});
  assert(s.player.y<-5050);assert.equal(s.castle.doorY,null);assert.equal(s.castle.hallY,null);
  s.player.y=5000;s.enemies=[];advance(s,.5,{y:1});assert(s.player.y>5050);
  const p=castleProps(-100,300).find(p=>p.kind==='piano');
  assert(p);s.player.x=p.x-p.radius-24;s.player.y=p.y;s.enemies=[];s.spawnTimer=3;
  for(let i=0;i<5;i++)step(s,{x:1},.25);
  assert(Math.hypot(s.player.x-p.x,s.player.y-p.y)>=p.radius+20-1e-6);
  s.player.x=0;s.player.y=0;advance(s,.5,{x:1});assert(s.player.x>50);roundTrip(s);
});

test('castle spawns its own normal inhabitants and both mini-boss identities',()=>{
  const seen=new Set();
  for(let seed=1;seed<=18;seed++){
    const s=createRun({map:'castle',seed});s.spawnTimer=0;step(s,{},dt);
    for(const e of s.enemies){assert(['palace-guard','wax-servant','paper-moth'].includes(e.kind));seen.add(e.kind);}
    roundTrip(s);
  }
  assert.equal(seen.size,3);
  for(const [time,stage,type]of [[120,1,'gatekeeper'],[240,2,'conductor']]){
    const s=createRun({map:'castle',seed:stage});s.time=time-dt;s.spawnedGuardians=stage-1;s.spawnedElites=4;s.spawnTimer=3;
    step(s,{},dt);assert.equal(s.enemies.find(e=>e.kind==='guardian').bossType,type);roundTrip(s);
  }
});

test('wall projection never spawns an unavoidable contact hit beside either wall',()=>{
  for(const x of [-CASTLE.halfWidth+20,CASTLE.halfWidth-20])for(let seed=1;seed<=60;seed++){
    const s=createRun({map:'castle',seed});s.player.x=x;s.player.y=-5200;s.spawnTimer=0;
    const hp=s.player.hp;step(s,{},dt);assert.equal(s.player.hp,hp,'spawn contact at seed'+seed);
    assert(s.enemies.length>0);
    for(const e of s.enemies)assert(Math.hypot(e.x-s.player.x,e.y-s.player.y)>200,'projected spawn lacks arrival gap');
    roundTrip(s);
  }
});

test('saves from the former wider corridor project safely on first tick and keep the large boss hall',()=>{
  for(const x of [-680,680]){
    const s=createRun({map:'castle',seed:55});s.player.x=x;s.player.y=70;s.spawnTimer=3;
    s.enemies=[{id:s.nextId++,kind:'palace-guard',x:Math.sign(x)*500,y:70,hp:120,maxHp:120,radius:16,
      speed:40,damage:13,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:2,elite:false,slowTime:0,actionTimer:0}];
    const restored=roundTrip(s),hp=restored.player.hp;step(restored,{},dt);
    assert.equal(restored.player.hp,hp,'geometry projection must not cause an unavoidable hit');
    assert(Math.abs(restored.player.x)<=CASTLE.halfWidth-20);
    assert(restored.player.invulnerable>0);roundTrip(restored);
  }
  const arena=fight();arena.player.x=600;arena.player.y=arena.arena.y+300;const resumed=roundTrip(arena);
  step(resumed,{},dt);assert(resumed.player.x>500,'the final hall was narrowed with the corridor');
  roundTrip(resumed);
});

test('monarch telegraphs a real ring with a full-body safe wedge and retains attack state across reload',()=>{
  const s=fight(),e=s.enemies[0];s.projectiles=[];e.fireTimer=0;e.actionTimer=0;e.phase=0;e.attackStage=0;s.player.x=400;s.player.y=e.y;
  const hooks={limits:{projectiles:100,effects:80},effect:(s,kind,x,y,radius,life)=>s.effects.push({kind,x,y,radius,life,maxLife:life}),hurt:()=>{}};
  updateBossAttacks(s,e,dt,hooks);assert.equal(s.projectiles.length,0);assert(e.actionTimer>=1);
  const copy=roundTrip(s);
  for(let n=0;n<70;n++){updateBossAttacks(s,e,dt,hooks);updateBossAttacks(copy,copy.enemies[0],dt,hooks);}
  assert.deepEqual(serialize(s),serialize(copy));assert(s.projectiles.length>=20&&s.projectiles.length<32);
  for(const p of s.projectiles){const angle=Math.abs(Math.atan2(p.vy,p.vx));assert(angle>=.55);}
  assert.equal(BOSS_VARIANTS.monarch.attacks[1].kind,'spiral');
});

test('rectangular castle arena preserves all phases and awards the800coin chest exactly once',()=>{
  let s=fight();s=roundTrip(s);
  s.player.x=4000;s.player.y=s.arena.y-4000;step(s,{},.25);
  assert(s.player.x<CASTLE.hallHalfWidth);assert(s.player.y>s.arena.y-CASTLE.hallHalfHeight);
  s=roundTrip(s);const boss=s.enemies[0];boss.hp=1;boss.actionTimer=0;boss.fireTimer=4;
  s.projectiles.push({id:s.nextId++,x:boss.x,y:boss.y,vx:0,vy:0,radius:4,damage:1,life:1,weapon:'spark',hostile:false,pierce:0,hits:[],returning:false});
  step(s,{},dt);assert.equal(s.arena.phase,'reward');assert.equal(s.enemies.length,0);assert.equal(s.chests.length,1);
  s=roundTrip(s);const c=s.chests[0];s.player.x=c.x;s.player.y=c.y;step(s,{},dt);
  assert.equal(s.arena.phase,'celebrating');assert.equal(s.coinsEarned,800);assert.equal(s.openedChests,1);
  const meta=normalizeMeta({clearedMaps:['garden','quarry']});assert.equal(bankCoins(meta,s),800);
  s=roundTrip(s);assert.equal(bankCoins(meta,s),0);advance(s,3);assert.equal(s.status,'won');assert.equal(s.arena.phase,'complete');
  roundTrip(s);recordProgress(meta,s);assert(meta.clearedMaps.includes('castle'));assert.equal(bankCoins(meta,s),0);
});

test('version8 legacy garden/quarry/crater saves migrate without replacement of active crater battles',()=>{
  for(const map of ['garden','quarry','crater']){
    const s=createRun({map,seed:200});
    if(map==='crater'){s.level=40;step(s,{},dt);advance(s,2.5);s.enemies[0].hp-=123;}
    const old=serialize(s);old.version=8;delete old.castle;
    const r=restore(old);assert(r);assert.equal(r.version,11);assert.equal(r.map,map);assert.equal(r.castle,null);
    assert.deepEqual(r.arena,s.arena);assert.deepEqual(r.enemies,s.enemies);
  }
  const illegal=serialize(goal());illegal.castle.targetY=-100;assert.equal(restore(illegal),null);
  const mismatched=serialize(fight());mismatched.arena.kind=undefined;assert.equal(restore(mismatched),null);
});

test('version9 castle exploring, guidance and active boss saves migrate without resetting a battle',()=>{
  for(const phase of ['exploring','guidance']){
    const s=phase==='guidance'?goal():createRun({map:'castle',seed:25});
    const old=serialize(s);old.version=9;old.castle={phase,targetX:0,targetY:-2000};
    old.enemies=old.enemies.filter(e=>e.kind!=='castle-door');old.player.y=7500;
    const migrated=restore(old);assert(migrated);assert.equal(migrated.version,11);
    if(phase==='exploring'){assert.equal(migrated.castle.doorY,null);assert.equal(migrated.castle.hallY,null);}
    else{assert(migrated.castle.doorY<7500-639);assert.equal(migrated.enemies.find(e=>e.kind==='castle-door').hp,6000);}
    roundTrip(migrated);
  }
  const live=fight();live.enemies[0].hp-=1789;live.enemies[0].fireTimer=1.25;
  const old=serialize(live),shift=-2000-old.arena.y;old.version=9;old.castle={phase:'arena',targetX:0,targetY:-2000};
  old.arena.y=-2000;old.player.y+=shift;old.enemies[0].y=-2000;
  // Cosmetic effects are not part of the boss/saving-state claim.
  old.effects=[];old.projectiles=[];
  const migrated=restore(old);assert(migrated);assert.equal(migrated.castle.hallY,-2000);
  assert(migrated.castle.doorBroken);assert.equal(migrated.castle.doorId,0);assert.equal(migrated.castle.doorTime,1.2);
  assert.equal(migrated.enemies[0].hp,old.enemies[0].hp);assert.equal(migrated.enemies[0].fireTimer,1.25);
  assert.deepEqual(migrated.arena,old.arena);roundTrip(migrated);
});

test('castle inhabitants warn before a captured strike and guard aim can be dodged',()=>{
  for(const kind of ['palace-guard','wax-servant','paper-moth']){
    const s=createRun({map:'castle',seed:22});s.time=56;s.spawnTimer=3;s.player.x=100;
    s.enemies=[{id:s.nextId++,kind,x:0,y:0,hp:9000,maxHp:9000,radius:13,speed:0,damage:10,value:40,
      phase:0,hitFlash:0,guardianStage:0,fireTimer:0,elite:false,slowTime:0,actionTimer:0}];
    const hp=s.player.hp;step(s,{},dt);assert.equal(s.player.hp,hp);assert(s.enemies[0].actionTimer>.6);
    assert(s.effects.some(e=>['charge','warning'].includes(e.kind)));
    advance(s,.3);assert.equal(s.player.hp,hp);assert(!s.projectiles.some(p=>p.hostile));
    if(kind==='palace-guard'){s.player.y=100;advance(s,.4);assert.equal(s.player.hp,hp,'captured guard direction can be escaped');}
    else{advance(s,.55);assert(s.player.hp<hp||s.projectiles.some(p=>p.hostile),kind+' did not release');}
    roundTrip(s);
  }
});

test('harvest survivors do not all become casters at the pressure transition',()=>{
  const s=createRun({map:'castle',seed:9});s.time=55;s.spawnTimer=3;s.player.x=100;
  s.enemies=[{id:s.nextId++,kind:'wax-servant',x:0,y:0,hp:12,maxHp:12,radius:10,speed:0,damage:3,value:2,
    phase:0,hitFlash:0,guardianStage:0,fireTimer:0,elite:false,slowTime:0,actionTimer:0}];
  const hp=s.player.hp;advance(s,1);
  assert.equal(s.player.hp,hp);assert(!s.projectiles.some(p=>p.hostile));
  assert(!s.effects.some(e=>e.kind==='warning'));roundTrip(s);
});

test('a controlled legal43choice build defeats52000monarchHP with movement and banks one reward',()=>{
  let s=createRun({map:'castle',seed:492,character:'heliarch'}),choices=0;
  for(const [id,rank]of Object.entries({sunlance:8,spark:8,meteor:8,drone:6,focus:3,haste:3,vitality:2,laurel:3,heart:1,aegis:1,amplifier:1})){
    while((s.upgrades[id]||0)<rank){s.status='upgrade';s.choices=[id];assert(chooseUpgrade(s,id));choices++;}
  }
  assert.equal(choices,43);s.level=44;s.xpNext=xpForLevel(44);s.xp=s.xpNext;s.spawnedGuardians=3;s.spawnedElites=4;s.spawnTimer=3;
  step(s,{},dt);assert(castleGuidance(s));breach(s);s.player.y=s.castle.hallY+500;step(s,{},dt);
  assert.equal(s.enemies[0].hp,52000);let frames=0;
  while(s.status==='playing'&&s.arena.phase!=='reward'&&frames<120*60){
    const a=s.arena,p=s.player,dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy)||1,radial=(330-d)*.04;
    step(s,{x:-dy/d+dx/d*radial,y:dx/d+dy/d*radial},dt);
    if(++frames===300)s=roundTrip(s);
  }
  assert.equal(s.status,'playing');assert.equal(s.arena.phase,'reward');assert(s.player.hp>0);
  assert(frames>2.5*60&&frames<120*60);assert.equal(s.chests.length,1);assert.equal(s.enemies.length,0);
  for(let n=0;n<4*60&&s.arena.phase==='reward';n++){
    const c=s.chests[0],dx=c.x-s.player.x,dy=c.y-s.player.y,d=Math.hypot(dx,dy)||1;
    step(s,{x:dx/d,y:dy/d},dt);
  }
  assert.equal(s.arena.phase,'celebrating');s=roundTrip(s);advance(s,3);assert.equal(s.status,'won');
  const meta=normalizeMeta({clearedMaps:['garden','quarry']});
  assert.equal(bankCoins(meta,s),800);assert.equal(bankCoins(meta,roundTrip(s)),0);assert.equal(s.openedChests,1);
});
