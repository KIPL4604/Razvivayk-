import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,chooseUpgrade,serialize,restore,fusionReady,LIMITS} from '../webapp/frontend/js/lumen/engine.mjs';
import {HYBRIDS,WEAPONS,ARTIFACTS} from '../webapp/frontend/js/lumen/catalog.mjs';
import {normalizeMeta,recordProgress,buyCharacter} from '../webapp/frontend/js/lumen/economy.mjs';
const tick=1/60;
const advance=(r,t)=>{for(let i=0;i<t*60;i++)step(r,{},tick);};
const mob=(kind='mote',x=65,y=0)=>({id:1,kind,x,y,hp:10000,maxHp:10000,radius:12,speed:0,damage:10,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:2.8,slowTime:0,actionTimer:0,elite:false});
const grant=(r,id)=>{r.status='upgrade';r.choices=[id];return chooseUpgrade(r,id);};

test('each fusion requires both VIII, replaces the pair with I, upgrades to IV and resumes exactly',()=>{
  for(const [id,{requires}]of Object.entries(HYBRIDS)){
    const r=createRun();r.upgrades=Object.fromEntries(requires.map(w=>[w,8]));r.foundWeapons=requires.filter(w=>w!=='spark');
    r.upgrades[requires[0]]=7;assert(!fusionReady(r,id));assert(!grant(r,id));r.upgrades[requires[0]]=8;
    assert(fusionReady(r,id));assert(grant(r,id));assert.equal(r.upgrades[id],1);assert(requires.every(w=>!r.upgrades[w]));
    assert.equal(Object.keys(r.upgrades).length,1);assert(!chooseUpgrade(r,id));
    assert.deepEqual(serialize(restore(serialize(r))),serialize(r));
    for(let n=2;n<=4;n++){assert(grant(r,id));assert.equal(r.upgrades[id],n);}
    assert(!grant(r,id));assert.equal(r.upgrades[id],4);
  }
});

test('a ready fusion is always offered with four weapons, and consumed ingredients stay out of offers',()=>{
  for(let seed=1;seed<=100;seed++){
    const r=createRun({seed});r.upgrades={spark:8,ice:8,orbit:1,pulse:1};r.xp=r.xpNext;step(r,{},tick);
    assert(r.choices.includes('prism'));assert.equal(new Set(r.choices).size,r.choices.length);assert(chooseUpgrade(r,'prism'));
    for(let n=0;n<8;n++){
      r.xp=r.xpNext;step(r,{},tick);assert(!r.choices.includes('spark')&&!r.choices.includes('ice'));
      assert(chooseUpgrade(r,r.choices[0]));
    }
  }
});

test('early level choices preserve an owned upgrade and a weapon discovery without duplicates',()=>{
  for(let seed=1;seed<=150;seed++){
    const r=createRun({seed});r.xp=r.xpNext;step(r,{},tick);
    assert(r.choices.includes('spark'));assert(r.choices.some(id=>WEAPONS[id]&&!r.upgrades[id]));assert.equal(new Set(r.choices).size,r.choices.length);
  }
});

test('mastery survives consuming ingredients and can still unlock a hero after reload',()=>{
  const r=createRun();r.upgrades={spark:8,ice:8};r.foundWeapons=['ice'];assert(grant(r,'prism'));
  const resumed=restore(serialize(r));assert(resumed);const meta=normalizeMeta({coins:200});recordProgress(meta,resumed);
  assert.equal(meta.weaponBest.ice,8);assert(!meta.weaponBest.spark);assert(buyCharacter(meta,'ranger'));
  assert.equal(meta.coins,0);
});

test('new heroes require their found weapon VIII and spend their exact local price',()=>{
  for(const [hero,weapon,price]of [['artificer','chakram',540],['sentinel','spear',620]]){
    const meta=normalizeMeta({coins:price});assert(!buyCharacter(meta,hero));
    const r=createRun();for(let n=0;n<8;n++)assert(grant(r,weapon));recordProgress(meta,r);
    assert(buyCharacter(meta,hero));assert.equal(meta.coins,0);assert.deepEqual(createRun({character:hero}).upgrades,{[weapon]:1});
  }
});

test('collector pulls distant XP; chronogear increases real shots; resonator enlarges real zones; aegis reduces damage',()=>{
  const r=createRun();r.gems=[{x:125,y:0,value:2,tier:1}];step(r,{},tick);assert.equal(r.gems[0].x,125);
  assert(grant(r,'collector'));step(r,{},tick);assert(r.gems[0].x<125);assert.equal(r.pickupRadius,148);
  const counts=[];for(const rank of [0,3]){const s=createRun();s.spawnTimer=3;s.upgrades={spark:1,...(rank?{chronogear:rank}:{})};s.enemies=[mob('mote',500)];s.nextId=2;advance(s,2.2);counts.push(s.attackSerial);assert(restore(serialize(s)));}
  assert(counts[1]>counts[0]);
  const sizes=[];for(const rank of [0,3]){const s=createRun();s.upgrades={thorn:1,...(rank?{amplifier:rank}:{})};step(s,{},tick);sizes.push(s.zones[0].radius);}
  assert(sizes[1]>sizes[0]*1.35);
  for(const [rank,loss]of [[0,10],[3,4]]){const s=createRun();s.upgrades=rank?{aegis:rank}:{};s.enemies=[mob('mote',0)];s.nextId=2;step(s,{},tick);assert.equal(s.player.maxHp-s.player.hp,loss);}
  for(const id of Object.keys(ARTIFACTS)){const s=createRun();for(let n=0;n<3;n++)assert(grant(s,id));assert(!grant(s,id));s.status='playing';s.choices=[];assert(restore(serialize(s)));}
});

test('quarry pressure contains all three new species, while garden keeps its own roster',()=>{
  for(const map of ['garden','quarry']){
    const r=createRun({seed:9,map});r.time=350;r.spawnedGuardians=3;r.spawnedElites=4;r.upgrades={};const seen=new Set();
    for(let n=0;n<1500;n++){r.player.hp=r.player.maxHp;step(r,{x:1},tick);r.enemies.forEach(e=>seen.add(e.kind));}
    for(const kind of ['quartzling','shardback','moonmoth'])assert.equal(seen.has(kind),map==='quarry',map+' '+kind);
    assert(restore(serialize(r)));
  }
});

test('new enemies telegraph a directed dash, release eight shards, and shoot a lunar fan',()=>{
  const q=createRun({map:'quarry'});q.upgrades={};q.enemies=[{...mob('quartzling',170),speed:60,fireTimer:0}];q.nextId=2;
  step(q,{},tick);assert(q.effects.some(e=>e.kind==='charge'));assert(q.enemies[0].actionTimer>.8);const x=q.enemies[0].x;
  advance(q,.5);assert.equal(q.enemies[0].x,x);advance(q,.3);assert(q.enemies[0].x<x-20);assert(restore(serialize(q)));
  const s=createRun();s.upgrades={};s.enemies=[{...mob('shardback',200),fireTimer:0}];s.nextId=2;
  step(s,{},tick);assert(s.effects.some(e=>e.kind==='shards'));advance(s,.9);assert.equal(s.projectiles.filter(p=>p.weapon==='shard').length,8);assert(restore(serialize(s)));
  const m=createRun();m.upgrades={};m.enemies=[{...mob('moonmoth',200),fireTimer:0}];m.nextId=2;step(m,{},tick);
  assert.equal(m.projectiles.filter(p=>p.weapon==='moon_shard').length,3);assert(restore(serialize(m)));
});

test('new weapons bounce and pierce; hybrids slow, chain, burn and return without exceeding entity limits',()=>{
  for(const id of ['chakram','spear','prism','cyclone','briar','sunrise']){
    const r=createRun();r.upgrades={[id]:WEAPONS[id].max};r.enemies=[mob('mote',80),{...mob('mote',150),id:2},{...mob('mote',200,35),id:3}];r.nextId=4;r.spawnTimer=3;
    advance(r,.6);assert(r.enemies.some(e=>e.hp<10000),id+' no real hit');
    if(id==='prism')assert(r.enemies.some(e=>e.slowTime>0));
    if(id==='cyclone')assert(r.attackSerial>0&&r.enemies.filter(e=>e.hp<10000).length>1);
    if(id==='briar')assert(r.zones.some(z=>z.kind==='briar')&&r.enemies.some(e=>e.slowTime>0));
    if(id==='chakram')assert(r.projectiles.some(p=>p.hits.length>=2));
    if(id==='sunrise'){advance(r,.4);assert(r.projectiles.some(p=>p.returning));}
    for(const [field,max]of Object.entries(LIMITS))assert(r[field].length<=max);
    assert(restore(serialize(r)),id+' could not resume');
  }
});

test('v3 saves migrate without losing position, XP, kit or pending level choice; corrupt fusions are rejected',()=>{
  const v3=serialize(createRun());v3.version=3;delete v3.masteredWeapons;v3.player.x=98;v3.upgrades.ice=8;v3.foundWeapons=['ice'];v3.xp=3;v3.status='upgrade';v3.choices=['magnet'];
  const r=restore(v3);assert(r);assert.equal(r.version,7);assert.equal(r.player.x,98);assert.equal(r.xp,3);assert.deepEqual(r.masteredWeapons,['ice']);assert(chooseUpgrade(r,'magnet'));
  for(const changed of [{upgrades:{prism:5}},{upgrades:{prism:1,ice:8}},{masteredWeapons:['ice']},{status:'upgrade',choices:['prism']}])assert.equal(restore({...serialize(createRun()),...changed}),null);
});
