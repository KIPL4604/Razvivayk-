import { DEFAULT_BUILD } from "./economy.mjs?v=2";
import { cannonProfile } from "./guns.mjs?v=1";

export const WIDTH = 256;
export const HEIGHT = 432;
export const HULL = DEFAULT_BUILD.hull;

export const SECTORS = [
  { name: "Пояс обломков", boss: "Страж пояса", hp: 300, waves: [
    [0.8, "scout", 5, 128, 38], [3.8, "scout", 4, 85, 30],
    [6.7, "wing", 3, 156, 60], [10, "scout", 5, 142, 34],
    [13.1, "wing", 4, 122, 51], [16.5, "lancer", 3, 128, 67],
  ] },
  { name: "Красная орбита", boss: "Коронный дредноут", hp: 365, waves: [
    [0.8, "wing", 4, 128, 55], [3.8, "lancer", 3, 100, 49],
    [6.7, "scout", 6, 128, 33], [9.3, "wing", 4, 135, 49],
    [12.2, "lancer", 4, 128, 54], [15.6, "wing", 5, 128, 43],
    [18.4, "lancer", 3, 136, 68],
  ] },
];

const ENEMIES = {
  scout: { hp: 3, radius: 8, speed: 64, sway: 19, rate: 2.2, score: 100 },
  wing: { hp: 8, radius: 12, speed: 48, sway: 24, rate: 1.9, score: 200 },
  lancer: { hp: 13, radius: 13, speed: 40, sway: 13, rate: 1.6, score: 300 },
};
const TAU = Math.PI * 2;
const PILOT_RADIUS = 3;
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export function newFlight(build = DEFAULT_BUILD) {
  return {
    build: { ...build, parts: { ...build.parts } },
    gun: cannonProfile(build.parts?.cannon).id, beam: null,
    phase: "waves", sector: 0, elapsed: 0, clock: 0, wave: 0, score: 0,
    kills: 0, weapon: 1, boss: null, enemies: [], bolts: [], threats: [], bursts: [],
    player: { x: WIDTH / 2, y: HEIGHT - 57, hull: build.hull, cooldown: 0, guard: 0, bank: 0 },
  };
}

function deploy(run, [, kind, count, center, spacing]) {
  for (let i = 0; i < count; i++) {
    const column = i - (count - 1) / 2;
    const x = center + column * spacing;
    run.enemies.push({
      ...ENEMIES[kind], kind, baseX: x, x, y: -16 - Math.abs(column) * 12,
      age: 0, delay: .65 + (i % 3) * .23, offset: i * .46, hit: 0,
    });
  }
}

function fire(run, x, y, angle, speed, kind) {
  run.threats.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, kind });
}

function fan(run, x, y, center, count, spread, speed, kind) {
  for (let i = 0; i < count; i++) {
    fire(run, x, y, center + (i - (count - 1) / 2) * spread, speed, kind);
  }
}

function bossAttack(run, boss) {
  const fierce = boss.hp <= boss.maxHp / 2;
  const aim = Math.atan2(run.player.y - boss.y, run.player.x - boss.x);
  if (run.sector === 0) {
    if (boss.volley % 2 === 0) {
      fan(run, boss.x, boss.y + 13, aim, fierce ? 9 : 7, .21, fierce ? 112 : 90, "rose");
    } else {
      for (const side of [-1, 1]) {
        fan(run, boss.x + side * 37, boss.y + 6, Math.PI / 2 + side * .24,
          fierce ? 6 : 4, .19, 93, "amber");
      }
    }
    return fierce ? .74 : 1.05;
  }

  if (boss.volley % 3 === 2) {
    for (const side of [-1, 1]) {
      fan(run, boss.x + side * 36, boss.y + 7, aim + side * .18, fierce ? 5 : 3, .14, 129, "amber");
    }
  } else {
    const count = fierce ? 24 : 18;
    const rotation = aim + boss.volley * .28;
    for (let i = 2; i < count - 1; i++) {
      fire(run, boss.x, boss.y + 7, rotation + i * TAU / count, fierce ? 105 : 87, "rose");
    }
  }
  return fierce ? .53 : .82;
}

function movePilot(run, input, dt) {
  const p = run.player;
  let dx = input.x || 0;
  let dy = input.y || 0;
  const distance = run.build.speed * dt;
  if (input.target) {
    dx = (input.target.x - p.x) / distance;
    dy = (input.target.y - p.y) / distance;
  }
  const scale = Math.max(1, Math.hypot(dx, dy));
  p.x = clamp(p.x + dx / scale * distance, 12, WIDTH - 12);
  p.y = clamp(p.y + dy / scale * distance, 30, HEIGHT - 16);
  p.bank += (clamp(dx / scale, -1, 1) - p.bank) * Math.min(1, dt * 12);
  p.guard = Math.max(0, p.guard - dt);
}

function firePilot(run, dt) {
  const p = run.player;
  if (run.gun === "beam") {
    const tempo = run.build.cadence / DEFAULT_BUILD.cadence;
    const period = .82 * tempo;
    p.cooldown -= dt;
    if (p.cooldown <= 0) p.cooldown += period;
    const age = (period - p.cooldown) / tempo;
    run.beam = age < .63 ? {
      x: p.x, y: p.y - 12, width: 3 + run.weapon + run.build.spread * 2,
      charge: Math.min(1, age / .34),
    } : null;
    return;
  }
  p.cooldown -= dt;
  if (p.cooldown > 0) return;
  if (run.gun === "plasma") {
    p.cooldown += run.build.cadence * 5;
    run.bolts.push({
      x: p.x, y: p.y - 13, vx: 0, vy: -166, kind: "plasma",
      radius: 20 + run.weapon * 5 + run.build.spread * 4,
      damage: run.build.damage * (15 + run.weapon * 3),
    });
    return;
  }
  p.cooldown += run.build.cadence;
  const spread = run.weapon + run.build.spread;
  for (let lane = -spread; lane <= spread; lane++) {
    run.bolts.push({
      x: p.x + lane * 5, y: p.y - 10 + Math.abs(lane) * 4,
      vx: lane * (12 + run.weapon * 2), vy: -285 + Math.abs(lane) * 11,
      core: lane === 0,
    });
  }
}

function updateWaves(run, dt) {
  const sector = SECTORS[run.sector];
  while (run.wave < sector.waves.length && run.clock >= sector.waves[run.wave][0]) {
    deploy(run, sector.waves[run.wave++]);
  }
  for (const e of run.enemies) {
    e.age += dt;
    e.y += e.speed * dt;
    e.x = clamp(e.baseX + Math.sin(e.age * 2.4 + e.offset) * e.sway, 14, WIDTH - 14);
    e.hit = Math.max(0, e.hit - dt);
    e.delay -= dt;
    if (e.delay > 0 || e.y < 14 || e.y > HEIGHT - 70) continue;
    const aim = Math.atan2(run.player.y - e.y, run.player.x - e.x);
    const count = e.kind === "lancer" ? 5 : e.kind === "wing" ? 3 : 1;
    fan(run, e.x, e.y + 5, aim, count, .22, e.kind === "lancer" ? 112 : 90,
      e.kind === "lancer" ? "amber" : "rose");
    e.delay = e.rate;
  }
  run.enemies = run.enemies.filter(e => e.y < HEIGHT + 16);
  const lastWave = sector.waves.at(-1)[0];
  if (run.clock < lastWave + 4 || (run.enemies.length && run.clock < lastWave + 7)) return;
  run.phase = "boss";
  run.enemies = [];
  run.threats = [];
  run.boss = { x: WIDTH / 2, y: -35, age: 0, delay: 1.9, volley: 0,
    hp: sector.hp, maxHp: sector.hp, radius: 45, hit: 0 };
}

function updateBoss(run, dt) {
  const boss = run.boss;
  boss.age += dt;
  boss.y = Math.min(77, boss.y + 89 * dt);
  boss.x = WIDTH / 2 + Math.sin(Math.max(0, boss.age - 1.3) * (run.sector ? 1.16 : .81)) *
    (run.sector ? 52 : 39);
  boss.hit = Math.max(0, boss.hit - dt);
  boss.delay -= dt;
  if (boss.delay > 0) return;
  boss.delay = bossAttack(run, boss);
  boss.volley++;
}

function strike(run, e, damage = run.build.damage) {
  e.hp = Math.max(0, e.hp - damage);
  e.hit = .08;
  if (e.hp === 0) {
    run.bursts.push({ x: e.x, y: e.y, age: 0, size: e.radius, kind: "enemy" });
    run.score += e.score || (run.sector === 0 ? 2200 : 3800);
    if (e.kind) {
      run.kills++;
      run.weapon = run.kills >= 15 ? 3 : run.kills >= 6 ? 2 : 1;
    }
  }
}

function inside(target, x, y, padding = 0) {
  const rx = target.radius + padding;
  const ry = (target.kind ? target.radius : 16) + padding;
  return ((x - target.x) / rx) ** 2 + ((y - target.y) / ry) ** 2 < 1;
}

function moveShots(run, dt) {
  const targets = run.boss ? [run.boss] : run.enemies;
  const beam = run.beam;
  if (beam?.charge === 1) {
    const damage = run.build.damage * (50 + run.weapon * 8) * dt;
    for (const e of targets) {
      const x = clamp(e.x, beam.x - beam.width / 2, beam.x + beam.width / 2);
      if (e.hp > 0 && inside(e, x, clamp(e.y, 0, beam.y))) strike(run, e, damage);
    }
  }
  run.bolts = run.bolts.filter(bolt => {
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    if (bolt.y < -14 || bolt.x < -8 || bolt.x > WIDTH + 8) return false;
    const plasma = bolt.kind === "plasma";
    const target = targets.find(e => e.hp > 0 &&
      (plasma ? inside(e, bolt.x, bolt.y, 4) : inside(e, bolt.x, bolt.y - 3, 1)));
    if (!target) return true;
    if (plasma) {
      run.bursts.push({ x: bolt.x, y: bolt.y, age: 0, size: bolt.radius, kind: "plasma" });
      strike(run, target, bolt.damage);
      for (const e of targets) {
        if (e !== target && e.hp > 0 && inside(e, bolt.x, bolt.y, bolt.radius)) strike(run, e, bolt.damage * .48);
      }
    } else strike(run, target);
    return false;
  });
  const p = run.player;
  run.threats = run.threats.filter(shot => {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.x < -8 || shot.x > WIDTH + 8 || shot.y < -8 || shot.y > HEIGHT + 8) return false;
    const radius = PILOT_RADIUS + (shot.kind === "rose" ? 3 : 2);
    if (p.guard > 0 || (p.x - shot.x) ** 2 + (p.y - shot.y) ** 2 >= radius ** 2) return true;
    damagePilot(run);
    return false;
  });
  if (p.guard === 0 && targets.some(e => e.hp > 0 && inside(e, p.x, p.y, PILOT_RADIUS))) {
    damagePilot(run);
  }
  run.enemies = run.enemies.filter(e => e.hp > 0);
}

function damagePilot(run) {
  const p = run.player;
  p.hull--;
  p.guard = run.build.guard;
  run.bursts.push({ x: p.x, y: p.y, age: 0, size: 15, kind: "pilot" });
  if (p.hull === 0) run.phase = "lost";
}

export function stepFlight(run, input, dt) {
  if (run.phase === "lost" || run.phase === "won") return;
  run.elapsed += dt;
  run.clock += dt;
  for (const burst of run.bursts) burst.age += dt;
  run.bursts = run.bursts.filter(burst => burst.age < .55);
  movePilot(run, input, dt);
  if (run.phase !== "transit" || run.gun === "impulse") firePilot(run, dt);
  if (run.phase === "transit") {
    if (run.clock >= 2.6) {
      run.sector++;
      run.clock = 0;
      run.wave = 0;
      run.phase = "waves";
      run.player.hull = run.build.hull;
    }
    moveShots(run, dt);
    return;
  }
  if (run.phase === "waves") updateWaves(run, dt);
  else updateBoss(run, dt);
  moveShots(run, dt);
  if (run.phase === "lost" || run.boss?.hp !== 0) return;
  run.threats = [];
  run.beam = null;
  if (run.gun === "plasma") run.bolts = [];
  run.player.cooldown = 0;
  run.boss = null;
  run.clock = 0;
  run.phase = run.sector === SECTORS.length - 1 ? "won" : "transit";
}
