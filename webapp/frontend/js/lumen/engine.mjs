/* Original Teramont simulation. No DOM, wall clock, network, or third-party code.
 * step() accepts seconds and advances at 60 Hz, with at most 0.25 seconds per call.
 * Reach the selected map's target level to win. Time only paces encounters.
 * Local results are entertainment data and never award campaign/server XP.
 */
import {waveAt,xpForLevel,crystalLoot,crystalTier,creatureStats} from './progression.mjs';
import {CHARACTERS,WEAPONS,WEAPON_IDS,BASE_WEAPON_IDS,HYBRIDS,ARTIFACTS,MAX_WEAPONS,MAX_ARTIFACTS,MAX_WEAPON_STAGE,ENEMIES,MAPS,RARITIES} from './catalog.mjs';
import {updateWeapons,flameImpact} from './combat.mjs';
import {CONTACT_PERIOD,movePlayer,separateCrowd,touchingEnemies,contactDamage} from './physics.mjs';
import {normalizeTraining,validTraining} from './training.mjs';
import {startArena,updateArena,enforceArenaBoundary,bossDeath,markArenaChestOpened,validateArena} from './arena.mjs';
import {updateBossAttacks,validateBossFields} from './bosses.mjs';
import {createCastle,updateCastleGoal,castleColliders,constrainCastleEntity,validateCastle,castleCreatureStats,updateCastleEnemy} from './castle.mjs';

export const DURATION = 480; // Historical benchmark for older harnesses; no time limit.
export const LIMITS = Object.freeze({ enemies: 240, projectiles: 100, gems: 220, effects: 80, zones:24, chests:12 });
export const UPGRADES = Object.freeze([
  ...WEAPON_IDS.map(id=>({id,title:WEAPONS[id].title,description:WEAPONS[id].verb,max:WEAPONS[id].max,kind:'weapon'})),
  ...Object.entries(ARTIFACTS).map(([id,a])=>({id,title:a.title,description:a.description,max:a.max,kind:'artifact'})),
  { id: 'focus', title: 'Чистая линза', description: 'Урон всего оружия +20%.', max: 5, kind: 'power' },
  { id: 'haste', title: 'Быстрый конденсатор', description: 'Всё оружие срабатывает на 15% чаще.', max: 4, kind: 'power' },
  { id: 'stride', title: 'Лёгкий привод', description: 'Скорость движения +10%.', max: 3, kind: 'utility' },
  { id: 'magnet', title: 'Сборщик искр', description: 'Радиус притяжения опыта становится больше.', max: 3, kind: 'utility' },
  { id: 'vitality', title: 'Запас света', description: 'Максимум здоровья +20; восстановление 30 здоровья.', max: 3, kind: 'recovery' },
  { id: 'repair', title: 'Тёплый ремонт', description: 'Восстановление 45 здоровья.', max: 999, kind: 'recovery' },
].map(Object.freeze));

const H = 1 / 60;
const TAU = Math.PI * 2;
const GUARDIAN_TIMES = [120, 240, 420];
const TYPES = [...ENEMIES, 'guardian','arena-boss','arena-tick'];
const CATALOG = new Map(UPGRADES.map((upgrade) => [upgrade.id, upgrade]));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const rank = (state, id) => state.upgrades[id] || 0;

function random(state) {
  let value = state.rngState;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0;
  return state.rngState / 4294967296;
}

function derived(state) {
  const base = CHARACTERS[state.character];
  state.player.maxHp = base.hp + rank(state, 'vitality') * 20 + state.training.vigor*2;
  state.player.speed = base.speed * (1 + rank(state, 'stride') * 0.1)*(1+state.training.drive*.005);
  state.pickupRadius = 58 + rank(state, 'magnet') * 42 + rank(state,'collector')*90 + state.training.compass*2;
}

export const fusionReady=(state,id)=>Boolean(own(HYBRIDS,id)&&!rank(state,id)&&HYBRIDS[id].requires.every(part=>rank(state,part)===MAX_WEAPON_STAGE));
const consumed=(state,id)=>Object.entries(HYBRIDS).some(([hybrid,recipe])=>(rank(state,hybrid)||state.archivedWeapons?.[hybrid])&&recipe.requires.includes(id));
function rememberMastery(state){
  for(const id of state.foundWeapons)if(rank(state,id)===MAX_WEAPON_STAGE&&!state.masteredWeapons.includes(id))state.masteredWeapons.push(id);
}
function availableUpgrade(state,id){
  const u=CATALOG.get(id);if(!u||rank(state,id)>=u.max)return false;
  if(u.kind==='artifact')return rank(state,id)>0||Object.keys(ARTIFACTS).filter(a=>rank(state,a)>0).length<MAX_ARTIFACTS;
  if(u.kind!=='weapon')return true;
  if(state.archivedWeapons?.[id])return false;
  if(HYBRIDS[id])return rank(state,id)>0||fusionReady(state,id);
  return !consumed(state,id)&&(rank(state,id)>0||WEAPON_IDS.filter(w=>rank(state,w)>0).length<MAX_WEAPONS);
}

export function createRun({ seed = 0x1a71be, character = 'scout',runId,map='garden',training } = {}) {
  const normalizedSeed = Number.isInteger(seed) ? seed >>> 0 : 0x1a71be;
  const selected = own(CHARACTERS, character) ? character : 'scout';
  const state = {
    version: 9, castle:map==='castle'?createCastle():null,arena:null,relicState:{shield:0,recharge:0,surge:0},archivedWeapons:{}, training:normalizeTraining(training),map:own(MAPS,map)?map:'garden',foundWeapons:[],masteredWeapons:[], seed: normalizedSeed, rngState: normalizedSeed || 0x9e3779b9,
    runId:typeof runId==='string'&&/^[a-zA-Z0-9-]{1,90}$/.test(runId)?runId:`run-${normalizedSeed.toString(16)}-${selected}`,
    character: selected, time: 0, status: 'playing', endReason: '',
    player: { x: 0, y: 0, hp: CHARACTERS[selected].hp, maxHp: CHARACTERS[selected].hp,
      speed: CHARACTERS[selected].speed, radius: 13, invulnerable: 0, facingX: 0, facingY: -1 },
    enemies: [], projectiles: [], gems: [], effects: [],
    level: 1, xp: 0, xpNext: xpForLevel(1), kills: 0, choices: [], upgrades: {[CHARACTERS[selected].weapon]:1},
    zones:[],chests:[],coinsEarned:0,openedChests:0,lootLog:[],spawnedElites:0,attackSerial:0,
    weaponTimers:Object.fromEntries(WEAPON_IDS.map(id=>[id,0])),
    bossesDefeated: 0, spawnedGuardians: 0, finalGuardianDefeated: false,
    nextId: 1, remainder: 0, contactTimer:0, spawnTimer: 0.65, boltTimer: 0,
    pulseTimer: 0, orbitTimer: 0, orbitAngle: 0, pickupRadius: 58,
  };
  derived(state);state.player.hp=state.player.maxHp;
  return state;
}

function effect(state, kind, x, y, radius, life = 0.35) {
  if (state.effects.length >= LIMITS.effects) state.effects.shift();
  state.effects.push({ kind, x, y, radius, life, maxLife: life });
}

function gem(state, x, y, value, tier) {
  if (state.gems.length < LIMITS.gems) {
    state.gems.push({ x, y, value, tier });
  } else {
    // Merge overflow into an existing nearby crystal: no unbounded arrays or lost XP.
    let closest = state.gems[0];
    let nearest = Infinity;
    // Prefer the same tier, preserving a small crystal's identity even when its
    // value accumulates. If none exists, merge nearest and show the higher tier.
    const sameTier=state.gems.filter(c=>crystalTier(c)===tier);
    for (const candidate of sameTier.length?sameTier:state.gems) {
      const d = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
      if (d < nearest) { nearest = d; closest = candidate; }
    }
    closest.tier=Math.max(crystalTier(closest),tier);
    closest.value += value;
  }
}

function hit(state, enemy, amount, push = 0,weapon) {
  if (enemy.hp <= 0) return;
  if(enemy.kind==='arena-tick'||enemy.kind==='arena-boss'&&state.arena?.phase!=='fighting')return;
  enemy.hp -= amount;
  enemy.hitFlash = 0.12;
  if(weapon&&own(WEAPONS,weapon)&&state.effects.length<LIMITS.effects-8){effect(state,'impact',enemy.x,enemy.y,Math.min(48,enemy.radius+9),.22);state.effects.at(-1).weapon=weapon;}
  if (push&&enemy.kind!=='arena-boss') {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.x += dx / distance * push;
    enemy.y += dy / distance * push;
  }
  if (enemy.hp <= 0) {
    if(enemy.kind==='arena-boss'&&bossDeath(state,enemy,{effect}))return;
    state.kills += 1;
    if (enemy.kind === 'guardian') {
      state.bossesDefeated += 1;
      if (enemy.guardianStage === 3) state.finalGuardianDefeated = true;
      effect(state, 'guardian', enemy.x, enemy.y, 85, 0.8);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 18);
    } else effect(state, 'dissolve', enemy.x, enemy.y, enemy.radius + 8, 0.25);
    if(enemy.kind==='guardian'||enemy.elite){
      const chest={id:state.nextId++,x:enemy.x,y:enemy.y,coins:enemy.kind==='guardian'?40+enemy.guardianStage*20:18+waveAt(state.time).stage*6,
        upgrade:enemy.kind==='guardian'||random(state)<.65,boss:enemy.kind==='guardian'};
      if(state.chests.length<LIMITS.chests)state.chests.push(chest);
      else{state.chests[0].coins+=chest.coins;state.chests[0].upgrade ||= chest.upgrade;}
    }
    gem(state, enemy.x, enemy.y, enemy.value, crystalLoot(enemy.maxHp,enemy.guardianStage).tier);
  }
}

function hurt(state, damage, grace=.3) {
  if (state.player.invulnerable > 0 || state.status !== 'playing') return false;
  state.relicState.surge=rank(state,'hourglass')?2:0;
  if(state.relicState.shield>0){
    state.relicState.shield--;state.relicState.recharge ||= 22-rank(state,'laurel')*2;
    state.player.invulnerable=grace;effect(state,'shield',state.player.x,state.player.y,42,.35);return true;
  }
  const reduction=state.player.hp<state.player.maxHp*.35?1-rank(state,'carapace')*.15:1;
  state.player.hp = Math.max(0, state.player.hp - Math.max(1,(damage-rank(state,'aegis')*2)*reduction));
  state.player.invulnerable = grace;
  effect(state, 'hurt', state.player.x, state.player.y, 30, 0.3);
  const lethal=state.player.hp===0;
  if(rank(state,'ember')){
    effect(state,'pulse',state.player.x,state.player.y,125,.3);
    for(const enemy of state.enemies)if(distanceSquared(enemy,state.player)<(125+enemy.radius)**2)hit(state,enemy,rank(state,'ember')*20);
  }
  if (lethal) { state.player.hp=0;state.status = 'lost'; state.endReason = 'health'; }
  return true;
}

function spawn(state, guardianStage = 0, wave = waveAt(state.time),elite=false) {
  if (state.enemies.length >= LIMITS.enemies) {
    if (!guardianStage&&!elite) return;
    let index = -1;
    let farthest = -1;
    for (let i = 0; i < state.enemies.length; i += 1) {
      const candidate = state.enemies[i];
      if (candidate.kind === 'guardian'||candidate.elite) continue;
      const d = distanceSquared(candidate, state.player);
      if (d > farthest) { farthest = d; index = i; }
    }
    if (index < 0) return;
    state.enemies.splice(index, 1);
  }
  const roll = random(state);
  const angle = random(state) * TAU;
  const range = guardianStage ? 470 : wave.kind==='harvest'?380+random(state)*100:500+random(state)*160;
  let kind = 'mote';
  if (guardianStage) kind = 'guardian';
  else if(elite)kind='beetle';
  else if(wave.kind==='pressure'){
    kind=state.map==='quarry'
      ? roll<.12?'quartzling':roll<.20&&wave.stage>=2?'shardback':roll<.32?'moonmoth':roll<.5?'beetle':roll<.65?'wasp':roll<.8?'crawler':roll<.9?'spitter':'mote'
      : roll<.2?'beetle':roll<.35?'wasp':roll<.5?'crawler':roll<.64&&wave.stage>=2?'spitter':roll<.76&&wave.stage>=3?'wisp':'mote';
  }
  if(state.map==='castle'&&!guardianStage)kind=elite?'palace-guard':roll<.46?'palace-guard':roll<.76?'wax-servant':'paper-moth';
  const base = kind === 'guardian'
    ? { hp: [0, 1800, 3600, 7800][guardianStage], radius: 31, speed: 38 + guardianStage * 3, damage: 22 }
    : state.map==='castle'?castleCreatureStats(kind,wave):creatureStats(kind,wave);
  if(elite){base.hp=700+wave.stage*150;base.radius=22;base.speed=48;base.damage=16;}
  if(wave.kind!=='harvest'||guardianStage||elite)base.hp=Math.round(base.hp*MAPS[state.map].hp);
  const value=crystalLoot(base.hp,guardianStage).value;
  state.enemies.push({ id: state.nextId++, kind, x: state.player.x + Math.cos(angle) * range,
    y: state.player.y + Math.sin(angle) * range, ...base, value, maxHp: base.hp,
    phase: random(state) * TAU, hitFlash: 0, guardianStage, fireTimer: 2.8,elite,slowTime:0,actionTimer:0 });
  if(guardianStage&&state.map==='crater')Object.assign(state.enemies.at(-1),{bossType:guardianStage===2?'tempest':'carapace',attackStage:0});
  if(guardianStage&&state.map==='castle')Object.assign(state.enemies.at(-1),{bossType:guardianStage===2?'conductor':'gatekeeper',attackStage:0});
  if(state.map==='castle'){
    const enemy=state.enemies.at(-1),minimum=guardianStage?330:250;
    constrainCastleEntity(enemy,state,30);
    // A ring spawn can project onto the player at a wall/gate corner.
    // Search a bounded set at the same distance, preserving an actual safe
    // arrival gap AFTER walls and furniture have projected the candidate.
    for(let attempt=1;distanceSquared(enemy,state.player)<minimum**2&&attempt<=16;attempt++){
      const candidateAngle=angle+attempt/16*TAU;
      enemy.x=state.player.x+Math.cos(candidateAngle)*range;
      enemy.y=state.player.y+Math.sin(candidateAngle)*range;
      constrainCastleEntity(enemy,state,30);
    }
    if(distanceSquared(enemy,state.player)<minimum**2){state.enemies.pop();return;}
  }
  if (guardianStage) effect(state, 'warning', state.player.x, state.player.y, 160, 1.5);
}

function creatures(state, dt) {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if(['arena-boss','arena-tick'].includes(enemy.kind))continue;
    if(enemy.bossType){updateBossAttacks(state,enemy,dt,{hurt,effect,limits:LIMITS});continue;}
    if(updateCastleEnemy(state,enemy,dt,{hurt,effect,limits:LIMITS}))continue;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.slowTime=Math.max(0,(enemy.slowTime||0)-dt);enemy.actionTimer=Math.max(0,(enemy.actionTimer||0)-dt);
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const sway = enemy.kind==='moonmoth'?1.05:['wasp','wisp'].includes(enemy.kind) ? Math.sin(state.time * 3.4 + enemy.phase) * 0.65 : 0;
    const charging=enemy.kind==='crawler'&&distance<240&&Math.sin(state.time*2+enemy.phase)>.87;
    const raging=enemy.kind==='guardian'&&enemy.guardianStage===3&&enemy.hp<enemy.maxHp*.5;
    if(charging)enemy.actionTimer=.2;
    const spacing=['spitter','moonmoth'].includes(enemy.kind)?(distance<140?-.6:distance<260?.18:1):1;
    const windup=enemy.kind==='quartzling'&&enemy.actionTimer>.35;
    const dash=enemy.kind==='quartzling'&&enemy.actionTimer>0&&!windup;
    const speed = enemy.speed * dt*(enemy.slowTime>0?.58:1)*(windup?0:dash?4.5:charging?2.2:raging?1.5:1)*spacing;
    enemy.x += dash?Math.cos(enemy.phase)*speed:(dx - dy * sway) / distance * speed;
    enemy.y += dash?Math.sin(enemy.phase)*speed:(dy + dx * sway) / distance * speed;
    if(['quartzling','shardback'].includes(enemy.kind)){
      enemy.fireTimer=Math.max(0,enemy.fireTimer-dt);
      if(enemy.fireTimer<=0&&distance<330){
        if(enemy.kind==='quartzling'){
          enemy.phase=(Math.atan2(dy,dx)+TAU)%TAU;enemy.actionTimer=1;enemy.fireTimer=3.6;
          effect(state,'charge',enemy.x,enemy.y,26,.65);
          Object.assign(state.effects.at(-1),{toX:enemy.x+Math.cos(enemy.phase)*190,toY:enemy.y+Math.sin(enemy.phase)*190});
        }else{
          enemy.actionTimer=.85;enemy.fireTimer=4;
          effect(state,'shards',enemy.x,enemy.y,90,.8);
        }
      }
      if(enemy.kind==='shardback'&&enemy.actionTimer>0&&enemy.actionTimer<=dt){
        for(let i=0;i<8&&state.projectiles.length<LIMITS.projectiles;i++){
          const a=i/8*TAU+enemy.phase;
          state.projectiles.push({id:state.nextId++,x:enemy.x,y:enemy.y,vx:Math.cos(a)*125,vy:Math.sin(a)*125,radius:6,damage:9,life:3,hostile:true,weapon:'shard',pierce:0,hits:[],returning:false});
        }
      }
    }
    if (enemy.kind === 'guardian'||enemy.kind==='spitter'||enemy.kind==='moonmoth') {
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        const stage=enemy.guardianStage,count=enemy.kind==='spitter'?1:enemy.kind==='moonmoth'?3:stage===1?6:stage===2?8:10;
        const aim=Math.atan2(dy,dx);enemy.actionTimer=.4;
        for (let i = 0; i < count && state.projectiles.length < LIMITS.projectiles; i += 1) {
          const angle=stage===2?i/count*TAU+enemy.phase:aim+(i-(count-1)/2)*(stage===3?.21:.17);
          state.projectiles.push({ id: state.nextId++, x: enemy.x, y: enemy.y,
            vx: Math.cos(angle) * (raging?135:102), vy: Math.sin(angle) * (raging?135:102), radius: 6,
            damage: stage?10+stage*2:7, life: 4, hostile: true,weapon:enemy.kind==='moonmoth'?'moon_shard':'hostile',pierce:0,hits:[],returning:false });
        }
        enemy.fireTimer = raging?2.7:3.6;
        enemy.phase = (enemy.phase + 0.3) % TAU;
      }
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0 && (enemy.kind === 'guardian' || distanceSquared(enemy, state.player) < 1650 ** 2));
}

function projectiles(state, dt) {
  if(state.arena&&state.arena.phase!=='fighting'){state.projectiles=[];state.zones=[];return;}
  for (const projectile of state.projectiles) {
    if(['cleaver','sunrise'].includes(projectile.weapon)&&projectile.life<=.8){
      if(!projectile.returning){projectile.returning=true;projectile.hits=[];}
      const dx=state.player.x-projectile.x,dy=state.player.y-projectile.y,d=Math.hypot(dx,dy)||1;
      projectile.vx=dx/d*330;projectile.vy=dy/d*330;
    }
    projectile.life -= dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (projectile.hostile) {
      if (distanceSquared(projectile, state.player) < (projectile.radius + state.player.radius) ** 2) {
        hurt(state, projectile.damage);
        projectile.life = 0;
      }
      continue;
    }
    if(projectile.weapon==='flame'&&projectile.life<=0){flameImpact(state,projectile,LIMITS);continue;}
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && enemy.kind!=='arena-tick'&&!projectile.hits.includes(enemy.id)&&distanceSquared(projectile, enemy) < (projectile.radius + enemy.radius) ** 2) {
        hit(state, enemy, projectile.damage,0,projectile.weapon);
        // bossDeath replaces the live collections. The old iterator must not
        // process a hostile shot or create a lingering weapon zone afterward.
        if(state.arena?.phase==='reward'){state.projectiles=[];state.zones=[];return;}
        projectile.hits.push(enemy.id);
        if(['ice','prism'].includes(projectile.weapon))enemy.slowTime=projectile.weapon==='prism'?2:1.4;
        if(projectile.weapon==='flame')flameImpact(state,projectile,LIMITS);
        if(!['cleaver','sunrise'].includes(projectile.weapon)&&(projectile.pierce--<=0))projectile.life=0;
        if(projectile.weapon==='chakram'&&projectile.life>0){
          const next=state.enemies.filter(e=>e.hp>0&&e.kind!=='arena-tick'&&!projectile.hits.includes(e.id)&&distanceSquared(e,projectile)<300**2)
            .sort((a,b)=>distanceSquared(a,projectile)-distanceSquared(b,projectile))[0];
          if(next){const a=Math.atan2(next.y-projectile.y,next.x-projectile.x);projectile.vx=Math.cos(a)*380;projectile.vy=Math.sin(a)*380;}
        }
        projectile.pierce=Math.max(0,projectile.pierce);
        if(projectile.hits.length>=16)projectile.life=0;
        break;
      }
    }
  }
  state.projectiles = state.projectiles.filter((projectile) => projectile.life > 0);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function offerUpgrade(state) {
  if (state.status !== 'playing' || state.arena || state.map==='castle'&&state.level>=45 || state.xp < state.xpNext) return;
  state.xp -= state.xpNext;
  state.level += 1;
  state.xpNext = xpForLevel(state.level);
  if(state.level>=MAPS[state.map].goal){
    state.choices=[];state.remainder=0;
    if(state.map==='castle')state.xp=0;
    if(MAPS[state.map].bossGoal){updateCastleGoal(state);startArena(state,{effect});}else{state.status='won';state.endReason='level';}
    return;
  }
  const candidates = UPGRADES.filter(u=>availableUpgrade(state,u.id)&&(u.id!=='repair'||state.player.hp<state.player.maxHp||state.level>35)).map(u=>u.id);
  const pick=items=>items.length?items[Math.floor(random(state)*items.length)]:null;
  const existing=pick(candidates.filter(id=>WEAPONS[id]&&rank(state,id)));
  const fresh=candidates.filter(id=>BASE_WEAPON_IDS.includes(id)&&!rank(state,id));
  // Roll rarity only for discoveries. Owning a legendary must not make its
  // subsequent stages rare too. Each category keeps its weight as it grows.
  function discover(){
    const categories=Object.keys(RARITIES).filter(r=>fresh.some(id=>WEAPONS[id].rarity===r));
    let roll=random(state)*categories.reduce((sum,r)=>sum+RARITIES[r].weight,0);
    for(const category of categories){roll-=RARITIES[category].weight;if(roll<0)return pick(fresh.filter(id=>WEAPONS[id].rarity===category));}
    return null;
  }
  const discovery=discover();
  const recovery=state.player.hp<state.player.maxHp*.35?pick(candidates.filter(id=>['repair','vitality'].includes(id))):null;
  const fusion=pick(candidates.filter(id=>fusionReady(state,id)));
  const remainder=candidates.filter(id=>!fresh.includes(id));
  for(let i=remainder.length-1;i>0;i--){const j=Math.floor(random(state)*(i+1));[remainder[i],remainder[j]]=[remainder[j],remainder[i]];}
  // Reserve distinct choices by priority; inserting into numbered slots could
  // overwrite another promised category when it happened to be there already.
  state.choices=[...new Set([fusion,recovery,existing,discovery,...remainder].filter(Boolean))].slice(0,3);
  if (!state.choices.length && rank(state, 'repair') < CATALOG.get('repair').max) state.choices = ['repair'];
  if (!state.choices.length) return;
  state.status = 'upgrade';
  state.remainder = 0;
}

function collect(state, dt) {
  const remaining = [];
  for (const crystal of state.gems) {
    const dx = state.player.x - crystal.x;
    const dy = state.player.y - crystal.y;
    const distance = Math.hypot(dx, dy);
    if (distance < state.player.radius + 8) { if(state.map!=='castle'||state.level<45)state.xp += crystal.value; continue; }
    if (distance < state.pickupRadius) {
      const movement = Math.min(distance, (230 + (state.pickupRadius - distance) * 3) * dt);
      crystal.x += dx / distance * movement;
      crystal.y += dy / distance * movement;
    }
    remaining.push(crystal);
  }
  state.gems = remaining;
  state.chests=state.chests.filter(chest=>{
    if(distanceSquared(chest,state.player)>(state.player.radius+24)**2)return true;
    const candidates=WEAPON_IDS.filter(id=>rank(state,id)>0&&rank(state,id)<WEAPONS[id].max);
    const weapon=chest.upgrade&&candidates.length?candidates[Math.floor(random(state)*candidates.length)]:'';
    if(weapon)state.upgrades[weapon]++;
    rememberMastery(state);
    const coins=chest.coins+(!chest.mega&&chest.upgrade&&!candidates.length?25:0);
    state.coinsEarned+=coins;state.openedChests++;
    if(chest.mega)markArenaChestOpened(state,chest);
    state.lootLog.push({id:chest.id,coins,weapon,stage:weapon?state.upgrades[weapon]:0,time:state.time});state.lootLog=state.lootLog.slice(-4);
    effect(state,'chest',chest.x,chest.y,chest.mega?100:40,.6);if(chest.mega)state.effects.at(-1).mega=true;return false;
  });
  offerUpgrade(state);
}

function tick(state, input, dt) {
  updateCastleGoal(state);
  if(state.level>=MAPS[state.map].goal&&!MAPS[state.map].bossGoal){state.status='won';state.endReason='level';state.choices=[];return;}
  if(state.level>=MAPS[state.map].goal&&MAPS[state.map].bossGoal&&!state.arena)startArena(state,{effect});
  state.time += dt;
  const player = state.player;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  state.relicState.surge=Math.max(0,state.relicState.surge-dt);
  if(rank(state,'laurel')&&state.relicState.shield<rank(state,'laurel')){
    state.relicState.recharge=Math.max(0,state.relicState.recharge-dt);
    if(!state.relicState.recharge){state.relicState.shield++;state.relicState.recharge=state.relicState.shield<rank(state,'laurel')?22-rank(state,'laurel')*2:0;}
  }
  if(rank(state,'heart'))player.hp=Math.min(player.maxHp,player.hp+rank(state,'heart')*.4*dt);
  state.contactTimer = Math.max(0,state.contactTimer-dt);
  for (const event of state.effects) event.life -= dt;
  state.effects = state.effects.filter((event) => event.life > 0);
  if(state.arena){updateArena(state,dt,{hit,hurt,effect,limits:LIMITS});if(state.status!=='playing')return;enforceArenaBoundary(state,{hurt,effect});if(state.status!=='playing')return;}
  const wind=player.hp>=player.maxHp?1+rank(state,'compass')*.05:1;
  const bodies=state.map==='castle'?[...state.enemies,...castleColliders(player.y-180,player.y+180)]:state.enemies;
  movePlayer(player,bodies,input.x*player.speed*dt*wind,input.y*player.speed*dt*wind);
  if(state.map==='castle'){
    constrainCastleEntity(player,state);
    if(state.level>=45&&!state.arena)startArena(state,{effect});
  }
  if(state.arena){enforceArenaBoundary(state,{hurt,effect});if(state.status!=='playing')return;}
  if (Math.hypot(input.x, input.y) > 0.01) { player.facingX = input.x; player.facingY = input.y; }
  if(!state.arena){
  while (state.spawnedGuardians < 3 && state.time + 1e-7 >= GUARDIAN_TIMES[state.spawnedGuardians]) {
    state.spawnedGuardians += 1;
    spawn(state, state.spawnedGuardians);
  }
  const eliteTimes=[90,180,300,360];
  while(state.spawnedElites<eliteTimes.length&&state.time+1e-7>=eliteTimes[state.spawnedElites]){
    state.spawnedElites++;spawn(state,0,waveAt(state.time),true);
  }
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const wave=waveAt(state.time);
    for (let i = 0; i < wave.count; i += 1) spawn(state,0,wave);
    state.spawnTimer += wave.interval;
  }
  }
  if(!state.arena||state.arena.phase==='fighting')updateWeapons(state, dt, {hit,effect,limits:LIMITS});
  creatures(state, dt);
  separateCrowd(state.enemies,player);
  if(state.map==='castle'){
    constrainCastleEntity(player,state);
    for(const e of state.enemies)if(e.kind!=='arena-boss')constrainCastleEntity(e,state,Math.min(45,e.radius+12));
  }
  const contacts=state.arena?.phase==='forming'?[]:touchingEnemies(state);
  if(state.contactTimer<=0&&contacts.length&&hurt(state,contactDamage(contacts),.2)){
    state.contactTimer=CONTACT_PERIOD;
  }
  if (state.status === 'lost') return;
  projectiles(state, dt);
  if (state.status === 'lost') return;
  if(!state.arena||state.arena.phase==='reward')collect(state, dt);
}

export function step(state, input = {}, dt = 0, beforeTick) {
  if (!state || state.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return state;
  let x = Number.isFinite(input?.x) ? clamp(input.x, -1, 1) : 0;
  let y = Number.isFinite(input?.y) ? clamp(input.y, -1, 1) : 0;
  const strength = Math.hypot(x, y);
  if (strength > 1) { x /= strength; y /= strength; }
  state.remainder += Math.min(dt, 0.25);
  while (state.remainder + 1e-10 >= H && state.status === 'playing') {
    state.remainder = Math.max(0, state.remainder - H);
    // Optional read-only presentation observer, before EACH fixed simulation tick.
    // This lets 90/120Hz displays interpolate; gameplay still advances at 60Hz.
    if (typeof beforeTick === 'function') beforeTick(state);
    tick(state, { x, y }, H);
  }
  if (state.status !== 'playing') state.remainder = 0;
  return state;
}

export function chooseUpgrade(state, id) {
  if (!state || state.status !== 'upgrade' || !state.choices.includes(id)) return false;
  const definition = CATALOG.get(id);
  if (!definition || !availableUpgrade(state,id)) return false;
  if(HYBRIDS[id]&&!rank(state,id)){
    rememberMastery(state);
    for(const part of HYBRIDS[id].requires){delete state.upgrades[part];state.weaponTimers[part]=0;}
    state.projectiles=state.projectiles.filter(p=>!HYBRIDS[id].requires.includes(p.weapon));
    effect(state,'fusion',state.player.x,state.player.y,140,.8);
  }else if(definition.kind==='weapon'&&!rank(state,id)&&id!==CHARACTERS[state.character].weapon&&!state.foundWeapons.includes(id))state.foundWeapons.push(id);
  state.upgrades[id] = rank(state, id) + 1;
  if(id==='laurel'){state.relicState.shield++;state.relicState.recharge=Math.min(state.relicState.recharge,22-rank(state,'laurel')*2);}
  rememberMastery(state);
  derived(state);
  if (id === 'vitality') state.player.hp = Math.min(state.player.maxHp, state.player.hp + 30);
  if (id === 'repair') state.player.hp = Math.min(state.player.maxHp, state.player.hp + 45);
  if (id === 'pulse') state.pulseTimer = 0;
  state.choices = [];
  state.status = 'playing';
  state.remainder = 0;
  offerUpgrade(state);
  return true;
}

// JSON round-trip intentionally removes aliases: the caller cannot mutate a running
// game through a save object. restore() whitelists all fields before using them.
export function serialize(state) { return JSON.parse(JSON.stringify(state)); }

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
const position = (value) => object(value) && number(value.x, -1e7, 1e7) && number(value.y, -1e7, 1e7);

function migrateLegacy(snapshot){
  const old=serialize(snapshot);old.version=2;
  old.runId=`legacy-${old.seed}-${old.character}`;old.coinsEarned=0;old.openedChests=0;
  old.chests=[];old.zones=[];old.lootLog=[];old.attackSerial=0;
  old.spawnedElites=[90,180,300,360].filter(t=>t<=old.time).length;
  old.weaponTimers=Object.fromEntries(WEAPON_IDS.map(id=>[id,0]));
  if(!object(old.upgrades))return old;
  old.upgrades.spark=Math.min(5,(old.upgrades.spark||0)+1);
  for(const id of ['orbit','pulse'])if(old.upgrades[id])old.upgrades[id]=Math.min(5,old.upgrades[id]+1);
  if(Array.isArray(old.choices)){
    old.choices=old.choices.filter(id=>CATALOG.has(id)&&(old.upgrades[id]||0)<CATALOG.get(id).max);
    if(old.status==='upgrade'&&!old.choices.length)old.choices=['repair'];
  }
  return old;
}
function migrateCampaign(snapshot){
  const old=serialize(snapshot);old.version=3;old.map='garden';
  old.foundWeapons=WEAPON_IDS.filter(id=>old.upgrades?.[id]>0&&id!==CHARACTERS[old.character]?.weapon);
  if(old.status==='won'&&old.level>=MAPS.garden.goal)old.endReason='level';
  // A pending old level choice remains selectable. The next simulation tick
  // settles a run already above the newly introduced target.
  return old;
}

function migrateArsenal(snapshot){
  const old=serialize(snapshot);old.version=4;
  old.masteredWeapons=(old.foundWeapons||[]).filter(id=>old.upgrades?.[id]===MAX_WEAPON_STAGE);
  return old;
}

function migrateLoadout(snapshot){
  const old=serialize(snapshot);old.version=7;old.relicState={shield:0,recharge:0,surge:0};old.archivedWeapons={};
  if(!object(old.upgrades))return old;
  const weapons=WEAPON_IDS.filter(id=>old.upgrades[id]);
  const native=CHARACTERS[old.character]?.weapon;
  weapons.sort((a,b)=>(b===native)-(a===native)||old.upgrades[b]-old.upgrades[a]||WEAPON_IDS.indexOf(a)-WEAPON_IDS.indexOf(b));
  for(const id of weapons.slice(MAX_WEAPONS)){old.archivedWeapons[id]=old.upgrades[id];delete old.upgrades[id];}
  const removed=Object.keys(old.archivedWeapons);
  old.projectiles=old.projectiles?.filter(p=>!removed.includes(p.weapon));
  old.zones=old.zones?.filter(z=>!removed.includes(z.kind));
  if(Array.isArray(old.choices))old.choices=old.choices.filter(id=>!removed.includes(id)&&(!WEAPONS[id]||old.upgrades[id]||weapons.length<MAX_WEAPONS||HYBRIDS[id]?.requires.every(part=>old.upgrades[part]===MAX_WEAPON_STAGE)));
  if(old.status==='upgrade'&&!old.choices?.length)old.choices=['repair'];
  return old;
}

export function restore(snapshot) {
  try {
    if(object(snapshot)&&snapshot.version===1)snapshot=migrateLegacy(snapshot);
    if(object(snapshot)&&snapshot.version===2)snapshot=migrateCampaign(snapshot);
    if(object(snapshot)&&snapshot.version===3)snapshot=migrateArsenal(snapshot);
    if(object(snapshot)&&snapshot.version===4)snapshot={...snapshot,version:5,contactTimer:0};
    if(object(snapshot)&&snapshot.version===5)snapshot={...snapshot,version:6,training:normalizeTraining()};
    if(object(snapshot)&&snapshot.version===6)snapshot=migrateLoadout(snapshot);
    if(object(snapshot)&&snapshot.version===7)snapshot={...snapshot,version:8,arena:null};
    if(object(snapshot)&&snapshot.version===8)snapshot={...snapshot,version:9,castle:snapshot.map==='castle'?{...createCastle(),phase:snapshot.arena?'arena':snapshot.level>=45?'guidance':'exploring'}:null};
    if (!object(snapshot) || snapshot.version !== 9 || !own(snapshot,'castle')||!own(snapshot,'arena')||!validTraining(snapshot.training)||!own(MAPS,snapshot.map)||!own(CHARACTERS, snapshot.character) ||
      !integer(snapshot.seed, 0, 0xffffffff) || !integer(snapshot.rngState, 1, 0xffffffff) ||
      !number(snapshot.time, 0, 1e7) || !['playing', 'upgrade', 'won', 'lost'].includes(snapshot.status) ||
      !['', 'health', 'beacon', 'dawn','level','boss'].includes(snapshot.endReason) ||
      !integer(snapshot.level, 1, 1000) || !number(snapshot.xp, 0, 1e7) || !integer(snapshot.xpNext, 1, 1e6) ||
      !integer(snapshot.kills, 0, 1e7) || !integer(snapshot.bossesDefeated, 0, 3) ||
      !integer(snapshot.spawnedGuardians, 0, 3) || typeof snapshot.finalGuardianDefeated !== 'boolean' ||
      !integer(snapshot.nextId, 1, 0x7fffffff) || !number(snapshot.remainder, 0, H + 1e-7) ||
      !number(snapshot.contactTimer,0,CONTACT_PERIOD) || !number(snapshot.spawnTimer, -H, 3) || !number(snapshot.boltTimer, 0, 3) ||
      !number(snapshot.pulseTimer, 0, 6) || !number(snapshot.orbitTimer, 0, 1) ||
      !number(snapshot.orbitAngle, 0, TAU) || !object(snapshot.upgrades) ||
      typeof snapshot.runId!=='string'||!/^[a-zA-Z0-9-]{1,90}$/.test(snapshot.runId)||
      !integer(snapshot.coinsEarned,0,1e6)||!integer(snapshot.openedChests,0,1000)||
      !integer(snapshot.spawnedElites,0,4)||!integer(snapshot.attackSerial,0,1e7)||!object(snapshot.weaponTimers)) return null;
    for (const [collection, limit] of Object.entries(LIMITS)) {
      if (!Array.isArray(snapshot[collection]) || snapshot[collection].length > limit) return null;
    }
    const state = createRun({ seed: snapshot.seed, character: snapshot.character,runId:snapshot.runId,map:snapshot.map,training:snapshot.training });state.upgrades={};
    for (const [id, value] of Object.entries(snapshot.upgrades)) {
      if (!CATALOG.has(id) || !integer(value, 1, CATALOG.get(id).max)) return null;
      state.upgrades[id] = value;
    }
    if(WEAPON_IDS.filter(id=>rank(state,id)>0).length>MAX_WEAPONS)return null;
    if(Object.keys(ARTIFACTS).filter(id=>rank(state,id)>0).length>MAX_ARTIFACTS)return null;
    if(!object(snapshot.archivedWeapons)||Object.keys(snapshot.archivedWeapons).length>2)return null;
    for(const [id,value]of Object.entries(snapshot.archivedWeapons)){
      if(!WEAPON_IDS.includes(id)||!integer(value,1,WEAPONS[id].max)||rank(state,id))return null;
      state.archivedWeapons[id]=value;
    }
    const relic=snapshot.relicState;
    if(!object(relic)||!integer(relic.shield,0,rank(state,'laurel'))||!number(relic.recharge,0,20)||!number(relic.surge,0,2)||(!rank(state,'laurel')&&relic.recharge)||(!rank(state,'hourglass')&&relic.surge))return null;
    state.relicState={shield:relic.shield,recharge:relic.recharge,surge:relic.surge};
    if(!Array.isArray(snapshot.masteredWeapons)||snapshot.masteredWeapons.length>BASE_WEAPON_IDS.length||new Set(snapshot.masteredWeapons).size!==snapshot.masteredWeapons.length||snapshot.masteredWeapons.some(id=>!BASE_WEAPON_IDS.includes(id)||!snapshot.foundWeapons?.includes(id)))return null;
    state.masteredWeapons=snapshot.masteredWeapons.slice();
    if(!Array.isArray(snapshot.foundWeapons)||snapshot.foundWeapons.length>BASE_WEAPON_IDS.length||new Set(snapshot.foundWeapons).size!==snapshot.foundWeapons.length||snapshot.foundWeapons.some(id=>!BASE_WEAPON_IDS.includes(id)||(!rank(state,id)&&!consumed(state,id)&&!state.archivedWeapons[id])||id===CHARACTERS[state.character].weapon))return null;
    if(Object.entries(HYBRIDS).some(([id,r])=>rank(state,id)&&r.requires.some(part=>rank(state,part))))return null;
    state.foundWeapons=snapshot.foundWeapons.slice();
    for(const [id,value] of Object.entries(snapshot.weaponTimers))if(!own(WEAPONS,id)||!number(value,0,6))return null;
    state.weaponTimers={...state.weaponTimers,...snapshot.weaponTimers};
    derived(state);
    const player = snapshot.player;
    if (!position(player) || !number(player.hp, 0, state.player.maxHp) || player.maxHp !== state.player.maxHp ||
      player.speed !== state.player.speed || player.radius !== 13 ||
      !number(player.invulnerable, 0, 0.8) || !number(player.facingX, -1, 1) || !number(player.facingY, -1, 1)) return null;
    state.player = { x: player.x, y: player.y, hp: player.hp, maxHp: player.maxHp, speed: player.speed,
      radius: 13, invulnerable: player.invulnerable, facingX: player.facingX, facingY: player.facingY };
    if (!Array.isArray(snapshot.choices) || snapshot.choices.length > 3 || new Set(snapshot.choices).size !== snapshot.choices.length ||
      snapshot.choices.some((id) => !CATALOG.has(id)||rank(state,id)>=CATALOG.get(id).max||(id!=='repair'&&!availableUpgrade(state,id)))) return null;
    if ((snapshot.status === 'upgrade') !== (snapshot.choices.length > 0) ||
      (snapshot.status !== 'lost' && player.hp <= 0) ||
      (snapshot.status === 'won' && (snapshot.level<MAPS[state.map].goal||snapshot.endReason!==(MAPS[state.map].bossGoal?'boss':'level')))) return null;
    const ids = new Set();
    for (const enemy of snapshot.enemies) {
      if (!position(enemy) || !integer(enemy.id, 1, 0x7fffffff) || ids.has(enemy.id) || !TYPES.includes(enemy.kind) ||
        !number(enemy.maxHp, 1, 1e5) || !number(enemy.hp, 0, enemy.maxHp) || enemy.hp <= 0 ||
        !number(enemy.radius, 1, 100) || !number(enemy.speed, 0, 1000) || !number(enemy.damage, 0, 1000) ||
        !integer(enemy.value, ['arena-boss','arena-tick'].includes(enemy.kind)?0:1, 1e5) || !number(enemy.phase, 0, TAU) || !number(enemy.hitFlash, 0, 1) ||
        !integer(enemy.guardianStage, 0, 3) || (enemy.kind === 'guardian') !== (enemy.guardianStage > 0) ||
        !number(enemy.fireTimer, -H, 4) ||(own(enemy,'elite')&&typeof enemy.elite!=='boolean')||
        !number(enemy.slowTime??0,0,2)||!number(enemy.actionTimer??0,0,2)||!validateBossFields(enemy)||own(enemy,'bossType')&&!['crater','castle'].includes(state.map)||
        own(enemy,'bossType')&&(state.map==='castle'?!['conductor','gatekeeper','monarch'].includes(enemy.bossType):!['carapace','tempest','matriarch'].includes(enemy.bossType))||
        ['palace-guard','wax-servant','paper-moth'].includes(enemy.kind)&&state.map!=='castle') return null;
      ids.add(enemy.id);
      state.enemies.push({ id: enemy.id, kind: enemy.kind, x: enemy.x, y: enemy.y, hp: enemy.hp, maxHp: enemy.maxHp,
        radius: enemy.radius, speed: enemy.speed, damage: enemy.damage, value: enemy.value,
        phase: enemy.phase, hitFlash: enemy.hitFlash, guardianStage: enemy.guardianStage, fireTimer: enemy.fireTimer,
        elite:enemy.elite===true,slowTime:enemy.slowTime||0,actionTimer:enemy.actionTimer||0 });
      if(own(enemy,'bossType'))Object.assign(state.enemies.at(-1),{bossType:enemy.bossType,attackStage:enemy.attackStage});
    }
    for (const projectile of snapshot.projectiles) {
      if (!position(projectile) || !integer(projectile.id, 1, 0x7fffffff) || ids.has(projectile.id) ||
        !number(projectile.vx, -2000, 2000) || !number(projectile.vy, -2000, 2000) ||
        !number(projectile.radius, 1, 30) || !number(projectile.damage, 0, 1e5) ||
        !number(projectile.life, 0, 5) || projectile.life <= 0 || typeof projectile.hostile !== 'boolean' ||
        (own(projectile,'weapon')&&!own(WEAPONS,projectile.weapon)&&!['hostile','shard','moon_shard'].includes(projectile.weapon))||
        !integer(projectile.pierce??0,0,10)||(own(projectile,'returning')&&typeof projectile.returning!=='boolean')) return null;
      const hits=projectile.hits||[];
      if(!Array.isArray(hits)||hits.length>16||hits.some(id=>!integer(id,1,0x7fffffff))||new Set(hits).size!==hits.length)return null;
      ids.add(projectile.id);
      state.projectiles.push({ id: projectile.id, x: projectile.x, y: projectile.y, vx: projectile.vx, vy: projectile.vy,
        radius: projectile.radius, damage: projectile.damage, life: projectile.life, hostile: projectile.hostile,
        weapon:projectile.weapon||(projectile.hostile?'hostile':'spark'),pierce:projectile.pierce||0,hits:hits.slice(),returning:projectile.returning===true });
    }
    if (ids.size && Math.max(...ids) >= snapshot.nextId) return null;
    for (const crystal of snapshot.gems) {
      if (!position(crystal) || !integer(crystal.value, 1, 1e7) ||
        (own(crystal,'tier') && !integer(crystal.tier,1,3))) return null;
      // Version1 snapshots without tiers retain their exact record/value.
      state.gems.push({ x: crystal.x, y: crystal.y, value: crystal.value,
        ...(own(crystal,'tier')?{tier:crystal.tier}:{}) });
    }
    for (const event of snapshot.effects) {
      if (!position(event) || !['pulse', 'hurt', 'dissolve', 'guardian', 'warning','arc','chest','charge','shards','fusion','shield','impact'].includes(event.kind) ||
        !number(event.radius, 1, 1000) || !number(event.maxLife, 0.001, 3) || !number(event.life, 0, event.maxLife) || event.life <= 0) return null;
      state.effects.push({ x: event.x, y: event.y, kind: event.kind, radius: event.radius, life: event.life, maxLife: event.maxLife });
      if(own(event,'weapon')){if(!own(WEAPONS,event.weapon))return null;state.effects.at(-1).weapon=event.weapon;}
      if(own(event,'mega')){if(typeof event.mega!=='boolean'||event.kind!=='chest')return null;state.effects.at(-1).mega=event.mega;}
      if(['arc','charge'].includes(event.kind)){
        if(!number(event.toX,-1e7,1e7)||!number(event.toY,-1e7,1e7))return null;
        Object.assign(state.effects.at(-1),{toX:event.toX,toY:event.toY});
      }
    }
    for(const zone of snapshot.zones){
      if(!position(zone)||!integer(zone.id,1,0x7fffffff)||ids.has(zone.id)||!['flame','thorn','briar','mine','meteor','gravity'].includes(zone.kind)||
        !number(zone.radius,1,1000)||!number(zone.damage,0,1e5)||!number(zone.maxLife,.01,5)||!number(zone.life,.001,zone.maxLife)||!number(zone.tick,-H,.6))return null;
      ids.add(zone.id);state.zones.push({id:zone.id,kind:zone.kind,x:zone.x,y:zone.y,radius:zone.radius,damage:zone.damage,life:zone.life,maxLife:zone.maxLife,tick:zone.tick});
    }
    for(const chest of snapshot.chests){
      if(!position(chest)||!integer(chest.id,1,0x7fffffff)||ids.has(chest.id)||!integer(chest.coins,1,1e6)||typeof chest.upgrade!=='boolean'||typeof chest.boss!=='boolean'||own(chest,'mega')&&typeof chest.mega!=='boolean')return null;
      ids.add(chest.id);state.chests.push({id:chest.id,x:chest.x,y:chest.y,coins:chest.coins,upgrade:chest.upgrade,boss:chest.boss});
      if(own(chest,'mega'))state.chests.at(-1).mega=chest.mega;
    }
    if(ids.size&&Math.max(...ids)>=snapshot.nextId)return null;
    if(!Array.isArray(snapshot.lootLog)||snapshot.lootLog.length>4)return null;
    for(const item of snapshot.lootLog){
      if(!object(item)||!integer(item.id,1,0x7fffffff)||!integer(item.coins,0,1e6)||
        (item.weapon!==''&&!own(WEAPONS,item.weapon))||!integer(item.stage,0,MAX_WEAPON_STAGE)||!number(item.time,0,1e7))return null;
      state.lootLog.push({id:item.id,coins:item.coins,weapon:item.weapon,stage:item.stage,time:item.time});
    }
    for (const key of ['rngState', 'time', 'status', 'endReason', 'level', 'xp', 'xpNext', 'kills', 'bossesDefeated',
      'spawnedGuardians', 'finalGuardianDefeated', 'nextId', 'remainder', 'contactTimer', 'spawnTimer', 'boltTimer', 'pulseTimer', 'orbitTimer', 'orbitAngle',
      'coinsEarned','openedChests','spawnedElites','attackSerial']) state[key] = snapshot[key];
    state.choices = snapshot.choices.slice();
    if(!validateArena(snapshot.arena,state))return null;
    state.arena=snapshot.arena===null?null:{...snapshot.arena};
    if(!validateCastle(snapshot.castle,state))return null;
    state.castle=snapshot.castle===null?null:{...snapshot.castle};
    return state;
  } catch { return null; }
}
