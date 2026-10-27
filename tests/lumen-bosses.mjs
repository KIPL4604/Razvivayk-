import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSS_VARIANTS,updateBossAttacks,validateBossFields} from '../webapp/frontend/js/lumen/bosses.mjs';
import {createRun,step,serialize,restore} from '../webapp/frontend/js/lumen/engine.mjs';

const dt=1/60;
const enemy=(bossType,kind='guardian')=>({id:1,kind,bossType,attackStage:0,x:0,y:0,hp:5000,maxHp:5000,radius:31,speed:45,damage:22,value:0,phase:0,hitFlash:0,guardianStage:kind==='guardian'?1:0,fireTimer:0,slowTime:0,actionTimer:0,elite:false});
const state=()=>({player:{x:180,y:0,hp:150,maxHp:150,radius:13,invulnerable:0},enemies:[],projectiles:[],effects:[],nextId:2});
const hooks={limits:{projectiles:100,effects:80},effect:(s,kind,x,y,radius,life)=>s.effects.push({kind,x,y,radius,life,maxLife:life}),hurt:(s,damage)=>{s.player.hp-=damage;return true;}};
const advance=(s,e,seconds)=>{for(let i=0;i<Math.round(seconds/dt);i++)updateBossAttacks(s,e,dt,hooks);};

test('original and castle boss variants have immutable distinct attack sequences',()=>{
  assert.deepEqual(Object.keys(BOSS_VARIANTS),['carapace','tempest','matriarch','conductor','gatekeeper','monarch']);
  for(const [id,v]of Object.entries(BOSS_VARIANTS)){
    assert(v.name&&v.sprite===`boss-${id}`);assert(Object.isFrozen(v)&&Object.isFrozen(v.attacks));
    assert(v.attacks.length>=3);for(const a of v.attacks)assert(Object.isFrozen(a)&&a.windup>=.6&&a.cooldown<=4);
  }
  assert.notDeepEqual(BOSS_VARIANTS.carapace.attacks,BOSS_VARIANTS.tempest.attacks);
});

test('every boss telegraphs before attacking and respects projectile and timer bounds',()=>{
  for(const id of Object.keys(BOSS_VARIANTS)){
    const s=state(),e=enemy(id);s.enemies=[e];updateBossAttacks(s,e,dt,hooks);
    assert(e.actionTimer>=.6);assert(s.effects.length>0);assert.equal(s.projectiles.length,0);assert.equal(s.player.hp,150);
    advance(s,e,.3);assert.equal(s.projectiles.length,0);assert.equal(s.player.hp,150);
    advance(s,e,1);assert(s.projectiles.length>0||s.player.hp<150,id);
    assert(e.fireTimer>=0&&e.fireTimer<=4&&e.actionTimer<=1.2);assert(validateBossFields(e));
    for(let i=0;i<500;i++){updateBossAttacks(s,e,dt,hooks);assert(s.projectiles.length<=100);assert(s.effects.length<=80);}
  }
});

test('captured line aim can be dodged and the anchored final boss never pursues',()=>{
  const s=state(),e=enemy('tempest');s.enemies=[e];
  updateBossAttacks(s,e,dt,hooks);assert(s.effects.some(f=>f.kind==='charge'&&f.toX>0&&f.toY===0));
  s.player.y=100;advance(s,e,1);assert.equal(s.player.hp,150);
  const still=state(),target=enemy('tempest');still.enemies=[target];
  updateBossAttacks(still,target,dt,hooks);advance(still,target,1);assert(still.player.hp<150);
  const final=enemy('matriarch','arena-boss');final.fireTimer=3;const before={x:final.x,y:final.y};
  advance(s,final,2);assert.equal(final.x,before.x);assert.equal(final.y,before.y);
});

test('ordinary guardians remain on their original engine path and malformed variant fields are rejected',()=>{
  const s=state(),old=enemy(undefined);delete old.bossType;delete old.attackStage;
  const snapshot=JSON.stringify(old);assert.equal(updateBossAttacks(s,old,dt,hooks),false);assert.equal(JSON.stringify(old),snapshot);
  assert(validateBossFields(old));assert(!validateBossFields({...enemy('tempest'),attackStage:99}));
  assert(!validateBossFields({...enemy('unknown')}));assert(!validateBossFields({...enemy('toString')}));assert(!validateBossFields({...enemy('tempest'),kind:'mote'}));
});

test('every configured attack releases after its warning and slams can be escaped during the windup',()=>{
  for(const [id,variant]of Object.entries(BOSS_VARIANTS))for(let attackStage=0;attackStage<variant.attacks.length;attackStage++){
    const s=state(),e=enemy(id);e.attackStage=attackStage;s.player.x=100;s.enemies=[e];
    updateBossAttacks(s,e,dt,hooks);assert.equal(s.player.hp,150);assert.equal(s.projectiles.length,0);
    advance(s,e,variant.attacks[attackStage].windup+.05);
    assert(s.player.hp<150||s.projectiles.length>0,`${id} attack ${attackStage} did not release`);
    assert.equal(e.attackStage,(attackStage+1)%variant.attacks.length);
  }
  const s=state(),e=enemy('carapace');e.attackStage=1;s.player.x=100;s.enemies=[e];
  updateBossAttacks(s,e,dt,hooks);s.player.x=260;advance(s,e,1.2);assert.equal(s.player.hp,150);
});

test('engine spawns distinct third-map guardians while both earlier maps keep their original boss path',()=>{
  for(const map of ['garden','quarry','crater'])for(const [time,stage,type]of [[120,1,'carapace'],[240,2,'tempest'],[420,3,'carapace']]){
    const s=createRun({map,seed:stage});s.time=time-dt;s.spawnedGuardians=stage-1;s.spawnedElites=4;s.spawnTimer=3;
    step(s,{},dt);const boss=s.enemies.find(e=>e.kind==='guardian');assert(boss);
    assert.equal(boss.guardianStage,stage);assert.equal(boss.bossType,map==='crater'?type:undefined);
    const saved=restore(serialize(s));assert(saved,`${map} stage ${stage} cannot restore`);assert.deepEqual(serialize(saved),serialize(s));
    if(map==='crater'){
      boss.fireTimer=0;step(s,{},dt);assert(boss.actionTimer>.6);assert(s.effects.some(e=>['charge','shards','warning'].includes(e.kind)));
      const mid=restore(serialize(s));assert(mid);const snapshot=serialize(mid);assert.deepEqual(snapshot,serialize(s));
      for(let n=0;n<75;n++){step(s,{x:0,y:1},dt);step(mid,{x:0,y:1},dt);}assert.deepEqual(serialize(mid),serialize(s));
      const illegal=serialize(s);illegal.map='garden';assert.equal(restore(illegal),null);
    }
  }
});
