/* Original Teramont simulation. No DOM, wall clock, network, or third-party code.
 * step() accepts seconds and advances at 60 Hz, with at most 0.25 seconds per call.
 * Survive 480 seconds AND dismantle the final guardian before the deadline to win.
 * Local results are entertainment data and never award campaign/server XP.
 */
import {waveAt,xpForLevel,crystalLoot,crystalTier,creatureStats} from './progression.mjs';

export const DURATION = 480;
export const LIMITS = Object.freeze({ enemies: 240, projectiles: 100, gems: 220, effects: 80 });
export const UPGRADES = Object.freeze([
  { id: 'spark', title: 'Световой разряд', description: 'Разряды сильнее; на 2-м и 4-м рангах появляется дополнительный луч.', max: 5, kind: 'weapon' },
  { id: 'orbit', title: 'Орбитальные огни', description: 'Вокруг разведчика движутся огни, повреждающие близких существ.', max: 4, kind: 'weapon' },
  { id: 'pulse', title: 'Кольцо рассвета', description: 'Периодическая волна света повреждает и отталкивает существ.', max: 4, kind: 'weapon' },
  { id: 'focus', title: 'Чистая линза', description: 'Урон всех световых устройств +20%.', max: 5, kind: 'power' },
  { id: 'haste', title: 'Быстрый конденсатор', description: 'Световые разряды и кольца срабатывают на 15% чаще.', max: 4, kind: 'power' },
  { id: 'stride', title: 'Лёгкий привод', description: 'Скорость движения +10%.', max: 3, kind: 'utility' },
  { id: 'magnet', title: 'Сборщик искр', description: 'Радиус притяжения опыта становится больше.', max: 3, kind: 'utility' },
  { id: 'vitality', title: 'Запас света', description: 'Максимум здоровья +20; восстановление 30 здоровья.', max: 3, kind: 'recovery' },
  { id: 'repair', title: 'Тёплый ремонт', description: 'Восстановление 45 здоровья.', max: 999, kind: 'recovery' },
].map(Object.freeze));

const H = 1 / 60;
const TAU = Math.PI * 2;
const GUARDIAN_TIMES = [120, 240, 420];
const TYPES = ['mote', 'beetle', 'wasp', 'guardian'];
const CATALOG = new Map(UPGRADES.map((upgrade) => [upgrade.id, upgrade]));
const CHARACTERS = Object.freeze({ scout: { hp: 110, speed: 160 }, keeper: { hp: 145, speed: 142 } });
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const rank = (state, id) => state.upgrades[id] || 0;
const damageScale = (state) => 1 + rank(state, 'focus') * 0.2;
const attackScale = (state) => 1 + rank(state, 'haste') * 0.15;

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
  state.player.maxHp = base.hp + rank(state, 'vitality') * 20;
  state.player.speed = base.speed * (1 + rank(state, 'stride') * 0.1);
  state.pickupRadius = 58 + rank(state, 'magnet') * 42;
}

export function createRun({ seed = 0x1a71be, character = 'scout' } = {}) {
  const normalizedSeed = Number.isInteger(seed) ? seed >>> 0 : 0x1a71be;
  const selected = own(CHARACTERS, character) ? character : 'scout';
  const state = {
    version: 1, seed: normalizedSeed, rngState: normalizedSeed || 0x9e3779b9,
    character: selected, time: 0, status: 'playing', endReason: '',
    player: { x: 0, y: 0, hp: CHARACTERS[selected].hp, maxHp: CHARACTERS[selected].hp,
      speed: CHARACTERS[selected].speed, radius: 13, invulnerable: 0, facingX: 0, facingY: -1 },
    enemies: [], projectiles: [], gems: [], effects: [],
    level: 1, xp: 0, xpNext: xpForLevel(1), kills: 0, choices: [], upgrades: {},
    bossesDefeated: 0, spawnedGuardians: 0, finalGuardianDefeated: false,
    nextId: 1, remainder: 0, spawnTimer: 0.65, boltTimer: 0,
    pulseTimer: 0, orbitTimer: 0, orbitAngle: 0, pickupRadius: 58,
  };
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

function hit(state, enemy, amount, push = 0) {
  if (enemy.hp <= 0) return;
  enemy.hp -= amount;
  enemy.hitFlash = 0.12;
  if (push) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.x += dx / distance * push;
    enemy.y += dy / distance * push;
  }
  if (enemy.hp <= 0) {
    state.kills += 1;
    if (enemy.kind === 'guardian') {
      state.bossesDefeated += 1;
      if (enemy.guardianStage === 3) state.finalGuardianDefeated = true;
      effect(state, 'guardian', enemy.x, enemy.y, 85, 0.8);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 18);
    } else effect(state, 'dissolve', enemy.x, enemy.y, enemy.radius + 8, 0.25);
    gem(state, enemy.x, enemy.y, enemy.value, crystalLoot(enemy.maxHp,enemy.guardianStage).tier);
  }
}

function hurt(state, damage) {
  if (state.player.invulnerable > 0 || state.status !== 'playing') return;
  state.player.hp = Math.max(0, state.player.hp - damage);
  state.player.invulnerable = 0.8;
  effect(state, 'hurt', state.player.x, state.player.y, 30, 0.3);
  if (!state.player.hp) { state.status = 'lost'; state.endReason = 'health'; }
}

function spawn(state, guardianStage = 0, wave = waveAt(state.time)) {
  if (state.enemies.length >= LIMITS.enemies) {
    if (!guardianStage) return;
    let index = -1;
    let farthest = -1;
    for (let i = 0; i < state.enemies.length; i += 1) {
      const candidate = state.enemies[i];
      if (candidate.kind === 'guardian') continue;
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
  else if (wave.kind==='pressure' && roll < 0.35) kind = 'beetle';
  else if (wave.kind==='pressure' && roll > 0.69) kind = 'wasp';
  const base = kind === 'guardian'
    ? { hp: [0, 1800, 3600, 7800][guardianStage], radius: 31, speed: 38 + guardianStage * 3, damage: 22 }
    : creatureStats(kind,wave);
  const value=crystalLoot(base.hp,guardianStage).value;
  state.enemies.push({ id: state.nextId++, kind, x: state.player.x + Math.cos(angle) * range,
    y: state.player.y + Math.sin(angle) * range, ...base, value, maxHp: base.hp,
    phase: random(state) * TAU, hitFlash: 0, guardianStage, fireTimer: 2.8 });
  if (guardianStage) effect(state, 'warning', state.player.x, state.player.y, 160, 1.5);
}

function fireBolts(state) {
  let target = null;
  let nearest = 640 ** 2;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const d = distanceSquared(enemy, state.player);
    if (d < nearest) { target = enemy; nearest = d; }
  }
  if (!target) return;
  const upgrade = rank(state, 'spark');
  const count = 1 + (upgrade >= 2 ? 1 : 0) + (upgrade >= 4 ? 1 : 0);
  const aim = Math.atan2(target.y - state.player.y, target.x - state.player.x);
  for (let i = 0; i < count && state.projectiles.length < LIMITS.projectiles; i += 1) {
    const angle = aim + (i - (count - 1) / 2) * 0.13;
    state.projectiles.push({ id: state.nextId++, x: state.player.x, y: state.player.y,
      vx: Math.cos(angle) * 490, vy: Math.sin(angle) * 490, radius: 4,
      damage: (24 + upgrade * 7) * damageScale(state), life: 1.8, hostile: false });
  }
  state.boltTimer = 0.7 / attackScale(state);
}

function weapons(state, dt) {
  state.boltTimer = Math.max(0, state.boltTimer - dt);
  if (state.boltTimer <= 0) fireBolts(state);
  state.orbitAngle = (state.orbitAngle + dt * 1.9) % TAU;
  state.orbitTimer = Math.max(0, state.orbitTimer - dt);
  const orbit = rank(state, 'orbit');
  if (orbit && state.orbitTimer <= 0) {
    const count = 1 + orbit;
    const radius = 76 + orbit * 6;
    for (let i = 0; i < count; i += 1) {
      const angle = state.orbitAngle + i / count * TAU;
      const light = { x: state.player.x + Math.cos(angle) * radius, y: state.player.y + Math.sin(angle) * radius };
      for (const enemy of state.enemies) {
        if (distanceSquared(enemy, light) < (enemy.radius + 15) ** 2) hit(state, enemy, (17 + orbit * 5) * damageScale(state));
      }
    }
    state.orbitTimer = 0.23;
  }
  state.pulseTimer = Math.max(0, state.pulseTimer - dt);
  const pulse = rank(state, 'pulse');
  if (pulse && state.pulseTimer <= 0) {
    const radius = 110 + pulse * 25;
    effect(state, 'pulse', state.player.x, state.player.y, radius, 0.55);
    for (const enemy of state.enemies) {
      if (distanceSquared(enemy, state.player) < (radius + enemy.radius) ** 2) hit(state, enemy, (30 + pulse * 14) * damageScale(state), enemy.kind === 'guardian' ? 8 : 45);
    }
    state.pulseTimer = (5.5 - pulse * 0.3) / attackScale(state);
  }
}

function creatures(state, dt) {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const sway = enemy.kind === 'wasp' ? Math.sin(state.time * 3.4 + enemy.phase) * 0.65 : 0;
    const speed = enemy.speed * dt;
    enemy.x += (dx - dy * sway) / distance * speed;
    enemy.y += (dy + dx * sway) / distance * speed;
    if (distance < enemy.radius + state.player.radius) hurt(state, enemy.damage);
    if (enemy.kind === 'guardian') {
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        const count = 5 + enemy.guardianStage;
        for (let i = 0; i < count && state.projectiles.length < LIMITS.projectiles; i += 1) {
          const angle = i / count * TAU + enemy.phase;
          state.projectiles.push({ id: state.nextId++, x: enemy.x, y: enemy.y,
            vx: Math.cos(angle) * 102, vy: Math.sin(angle) * 102, radius: 6,
            damage: 10 + enemy.guardianStage * 2, life: 4, hostile: true });
        }
        enemy.fireTimer = 3.6;
        enemy.phase = (enemy.phase + 0.3) % TAU;
      }
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0 && (enemy.kind === 'guardian' || distanceSquared(enemy, state.player) < 1650 ** 2));
}

function projectiles(state, dt) {
  for (const projectile of state.projectiles) {
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
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && distanceSquared(projectile, enemy) < (projectile.radius + enemy.radius) ** 2) {
        hit(state, enemy, projectile.damage);
        projectile.life = 0;
        break;
      }
    }
  }
  state.projectiles = state.projectiles.filter((projectile) => projectile.life > 0);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function offerUpgrade(state) {
  if (state.status !== 'playing' || state.xp < state.xpNext) return;
  state.xp -= state.xpNext;
  state.level += 1;
  state.xpNext = xpForLevel(state.level);
  const candidates = UPGRADES.filter((upgrade) => rank(state, upgrade.id) < upgrade.max &&
    (upgrade.id !== 'repair' || state.player.hp < state.player.maxHp || state.level > 35)).map((upgrade) => upgrade.id);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const other = Math.floor(random(state) * (i + 1));
    [candidates[i], candidates[other]] = [candidates[other], candidates[i]];
  }
  state.choices = candidates.slice(0, 3);
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
    if (distance < state.player.radius + 8) { state.xp += crystal.value; continue; }
    if (distance < state.pickupRadius) {
      const movement = Math.min(distance, (230 + (state.pickupRadius - distance) * 3) * dt);
      crystal.x += dx / distance * movement;
      crystal.y += dy / distance * movement;
    }
    remaining.push(crystal);
  }
  state.gems = remaining;
  offerUpgrade(state);
}

function tick(state, input, dt) {
  state.time = Math.min(DURATION, state.time + dt);
  const player = state.player;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.x += input.x * player.speed * dt;
  player.y += input.y * player.speed * dt;
  if (Math.hypot(input.x, input.y) > 0.01) { player.facingX = input.x; player.facingY = input.y; }
  for (const event of state.effects) event.life -= dt;
  state.effects = state.effects.filter((event) => event.life > 0);
  while (state.spawnedGuardians < 3 && state.time + 1e-7 >= GUARDIAN_TIMES[state.spawnedGuardians]) {
    state.spawnedGuardians += 1;
    spawn(state, state.spawnedGuardians);
  }
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const wave=waveAt(state.time);
    for (let i = 0; i < wave.count; i += 1) spawn(state,0,wave);
    state.spawnTimer += wave.interval;
  }
  weapons(state, dt);
  creatures(state, dt);
  if (state.status === 'lost') return;
  projectiles(state, dt);
  if (state.status === 'lost') return;
  if (state.time + 1e-7 >= DURATION) {
    state.time = DURATION;
    state.status = state.finalGuardianDefeated ? 'won' : 'lost';
    state.endReason = state.finalGuardianDefeated ? 'dawn' : 'beacon';
    return;
  }
  collect(state, dt);
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
  if (!definition || rank(state, id) >= definition.max) return false;
  state.upgrades[id] = rank(state, id) + 1;
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

export function restore(snapshot) {
  try {
    if (!object(snapshot) || snapshot.version !== 1 || !own(CHARACTERS, snapshot.character) ||
      !integer(snapshot.seed, 0, 0xffffffff) || !integer(snapshot.rngState, 1, 0xffffffff) ||
      !number(snapshot.time, 0, DURATION) || !['playing', 'upgrade', 'won', 'lost'].includes(snapshot.status) ||
      !['', 'health', 'beacon', 'dawn'].includes(snapshot.endReason) ||
      !integer(snapshot.level, 1, 1000) || !number(snapshot.xp, 0, 1e7) || !integer(snapshot.xpNext, 1, 1e6) ||
      !integer(snapshot.kills, 0, 1e7) || !integer(snapshot.bossesDefeated, 0, 3) ||
      !integer(snapshot.spawnedGuardians, 0, 3) || typeof snapshot.finalGuardianDefeated !== 'boolean' ||
      !integer(snapshot.nextId, 1, 0x7fffffff) || !number(snapshot.remainder, 0, H + 1e-7) ||
      !number(snapshot.spawnTimer, -H, 3) || !number(snapshot.boltTimer, 0, 3) ||
      !number(snapshot.pulseTimer, 0, 6) || !number(snapshot.orbitTimer, 0, 1) ||
      !number(snapshot.orbitAngle, 0, TAU) || !object(snapshot.upgrades)) return null;
    for (const [collection, limit] of Object.entries(LIMITS)) {
      if (!Array.isArray(snapshot[collection]) || snapshot[collection].length > limit) return null;
    }
    const state = createRun({ seed: snapshot.seed, character: snapshot.character });
    for (const [id, value] of Object.entries(snapshot.upgrades)) {
      if (!CATALOG.has(id) || !integer(value, 1, CATALOG.get(id).max)) return null;
      state.upgrades[id] = value;
    }
    derived(state);
    const player = snapshot.player;
    if (!position(player) || !number(player.hp, 0, state.player.maxHp) || player.maxHp !== state.player.maxHp ||
      player.speed !== state.player.speed || player.radius !== 13 ||
      !number(player.invulnerable, 0, 0.8) || !number(player.facingX, -1, 1) || !number(player.facingY, -1, 1)) return null;
    state.player = { x: player.x, y: player.y, hp: player.hp, maxHp: player.maxHp, speed: player.speed,
      radius: 13, invulnerable: player.invulnerable, facingX: player.facingX, facingY: player.facingY };
    if (!Array.isArray(snapshot.choices) || snapshot.choices.length > 3 || new Set(snapshot.choices).size !== snapshot.choices.length ||
      snapshot.choices.some((id) => !CATALOG.has(id) || rank(state, id) >= CATALOG.get(id).max)) return null;
    if ((snapshot.status === 'upgrade') !== (snapshot.choices.length > 0) ||
      (snapshot.status !== 'lost' && player.hp <= 0) ||
      (snapshot.status === 'won' && (snapshot.time !== DURATION || !snapshot.finalGuardianDefeated)) ||
      (snapshot.time >= DURATION && !['won', 'lost'].includes(snapshot.status))) return null;
    const ids = new Set();
    for (const enemy of snapshot.enemies) {
      if (!position(enemy) || !integer(enemy.id, 1, 0x7fffffff) || ids.has(enemy.id) || !TYPES.includes(enemy.kind) ||
        !number(enemy.maxHp, 1, 1e5) || !number(enemy.hp, 0, enemy.maxHp) || enemy.hp <= 0 ||
        !number(enemy.radius, 1, 100) || !number(enemy.speed, 0, 1000) || !number(enemy.damage, 0, 1000) ||
        !integer(enemy.value, 1, 1e5) || !number(enemy.phase, 0, TAU) || !number(enemy.hitFlash, 0, 1) ||
        !integer(enemy.guardianStage, 0, 3) || (enemy.kind === 'guardian') !== (enemy.guardianStage > 0) ||
        !number(enemy.fireTimer, -H, 4)) return null;
      ids.add(enemy.id);
      state.enemies.push({ id: enemy.id, kind: enemy.kind, x: enemy.x, y: enemy.y, hp: enemy.hp, maxHp: enemy.maxHp,
        radius: enemy.radius, speed: enemy.speed, damage: enemy.damage, value: enemy.value,
        phase: enemy.phase, hitFlash: enemy.hitFlash, guardianStage: enemy.guardianStage, fireTimer: enemy.fireTimer });
    }
    for (const projectile of snapshot.projectiles) {
      if (!position(projectile) || !integer(projectile.id, 1, 0x7fffffff) || ids.has(projectile.id) ||
        !number(projectile.vx, -2000, 2000) || !number(projectile.vy, -2000, 2000) ||
        !number(projectile.radius, 1, 30) || !number(projectile.damage, 0, 1e5) ||
        !number(projectile.life, 0, 5) || projectile.life <= 0 || typeof projectile.hostile !== 'boolean') return null;
      ids.add(projectile.id);
      state.projectiles.push({ id: projectile.id, x: projectile.x, y: projectile.y, vx: projectile.vx, vy: projectile.vy,
        radius: projectile.radius, damage: projectile.damage, life: projectile.life, hostile: projectile.hostile });
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
      if (!position(event) || !['pulse', 'hurt', 'dissolve', 'guardian', 'warning'].includes(event.kind) ||
        !number(event.radius, 1, 1000) || !number(event.maxLife, 0.001, 3) || !number(event.life, 0, event.maxLife) || event.life <= 0) return null;
      state.effects.push({ x: event.x, y: event.y, kind: event.kind, radius: event.radius, life: event.life, maxLife: event.maxLife });
    }
    for (const key of ['rngState', 'time', 'status', 'endReason', 'level', 'xp', 'xpNext', 'kills', 'bossesDefeated',
      'spawnedGuardians', 'finalGuardianDefeated', 'nextId', 'remainder', 'spawnTimer', 'boltTimer', 'pulseTimer', 'orbitTimer', 'orbitAngle']) state[key] = snapshot[key];
    state.choices = snapshot.choices.slice();
    return state;
  } catch { return null; }
}
