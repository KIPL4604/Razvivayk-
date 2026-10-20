import assert from 'node:assert/strict';
import test from 'node:test';
import { DURATION, LIMITS, UPGRADES, createRun, step, chooseUpgrade, serialize, restore } from '../webapp/frontend/js/lumen/engine.mjs';

const advance = (run, seconds, direction = { x: 0, y: 0 }) => {
  for (let tick = 0; tick < Math.round(seconds * 60); tick += 1) step(run, direction, 1 / 60);
};
const enemy = (overrides = {}) => ({
  id: 500, x: 60, y: 0, hp: 100, maxHp: 100, radius: 10, kind: 'mote',
  speed: 40, damage: 9, value: 2, phase: 0, hitFlash: 0,
  guardianStage: 0, fireTimer: 2, ...overrides,
});

test('movement normalizes diagonals and preserves analog strength', () => {
  const straight = createRun({ seed: 17 });
  const diagonal = createRun({ seed: 17 });
  const analog = createRun({ seed: 17 });
  advance(straight, 0.5, { x: 1, y: 0 });
  advance(diagonal, 0.5, { x: 1, y: 1 });
  advance(analog, 0.5, { x: 0.5, y: 0 });
  assert.ok(Math.abs(Math.hypot(diagonal.player.x, diagonal.player.y) - straight.player.x) < 0.001);
  assert.ok(Math.abs(analog.player.x - straight.player.x / 2) < 0.001);
  assert.ok(Math.abs(straight.player.x - straight.player.speed * 0.5) < 0.001);
});

test('enemies pursue; contact damage has an invulnerability window', () => {
  const run = createRun({ seed: 22 });
  run.boltTimer = 2;
  run.enemies = [enemy()];
  advance(run, 0.25);
  assert.ok(run.enemies[0].x < 60);
  run.enemies[0].x = 0;
  const before = run.player.hp;
  step(run, {}, 1 / 60);
  assert.equal(run.player.hp, before - 9);
  advance(run, 0.3);
  assert.equal(run.player.hp, before - 9);
  assert.ok(run.player.invulnerable > 0);
  advance(run, 0.7);
  assert.ok(run.player.hp < before - 9);
});

test('automatic bolts kill, gems award local XP, choices pause the simulation', () => {
  const run = createRun({ seed: 3 });
  run.enemies = [enemy({ x: 55, hp: 1, maxHp: 1 })];
  advance(run, 0.3);
  assert.equal(run.kills, 1);
  assert.ok(run.gems.length > 0 || run.xp > 0);
  run.gems.push({ x: run.player.x, y: run.player.y, value: run.xpNext + 2 });
  step(run, {}, 1 / 60);
  assert.equal(run.status, 'upgrade');
  assert.equal(run.level, 2);
  const snapshot = serialize(run);
  step(run, { x: 1, y: 1 }, 0.25);
  assert.deepEqual(serialize(run), snapshot);
  assert.equal(chooseUpgrade(run, 'not-an-upgrade'), false);
  assert.equal(new Set(run.choices).size, run.choices.length);
  for (const id of run.choices) {
    const definition = UPGRADES.find((upgrade) => upgrade.id === id);
    assert.ok(definition);
    assert.ok((run.upgrades[id] || 0) < definition.max);
  }
  const chosen = run.choices[0];
  assert.equal(chooseUpgrade(run, chosen), true);
  assert.equal(run.upgrades[chosen], 1);
  assert.equal(run.status, 'playing');
  assert.equal(chooseUpgrade(run, chosen), false);
  assert.equal(restore(snapshot)?.status, 'upgrade');
});

test('orbit and pulse devices hit enemies after being selected', () => {
  for (const device of ['orbit', 'pulse']) {
    const run = createRun({ seed: 8 });
    run.status = 'upgrade';
    run.choices = [device];
    assert.equal(chooseUpgrade(run, device), true);
    run.boltTimer = 2;
    const radius = device === 'orbit' ? 82 : 70;
    run.enemies = [enemy({ x: radius, y: 0, hp: 1, maxHp: 1, speed: 0 })];
    advance(run, 1);
    assert.equal(run.kills, 1, `${device} must deliver actual damage`);
  }
});

test('guardians spawn at the three milestones, including with a crowded arena', () => {
  for (const [time, stage] of [[120, 1], [240, 2], [420, 3]]) {
    const run = createRun({ seed: stage });
    run.time = time - 1 / 60;
    run.spawnedGuardians = stage - 1;
    run.enemies = Array.from({ length: LIMITS.enemies }, (_, index) => enemy({ id: index + 1, x: 500 + index, speed: 0 }));
    run.nextId = LIMITS.enemies + 1;
    step(run, {}, 1 / 60);
    assert.ok(run.enemies.some((creature) => creature.kind === 'guardian' && creature.guardianStage === stage));
    assert.ok(run.enemies.length <= LIMITS.enemies);
  }
});

test('final guardian death is required for the 480-second victory', () => {
  assert.equal(DURATION, 480);
  const won = createRun({ seed: 1 });
  won.time = DURATION - 1 / 60;
  won.spawnedGuardians = 3;
  won.finalGuardianDefeated = true;
  won.bossesDefeated = 3;
  step(won, {}, 1 / 60);
  assert.equal(won.status, 'won');
  assert.equal(won.time, DURATION);
  const timeout = createRun({ seed: 1 });
  timeout.time = DURATION - 1 / 60;
  timeout.spawnedGuardians = 3;
  step(timeout, {}, 1 / 60);
  assert.equal(timeout.status, 'lost');
  assert.equal(timeout.endReason, 'beacon');
  const dead = createRun({ seed: 2 });
  dead.player.hp = 1;
  dead.boltTimer = 2;
  dead.enemies = [enemy({ x: 0 })];
  step(dead, {}, 1 / 60);
  assert.equal(dead.status, 'lost');
  assert.equal(dead.player.hp, 0);
  const finalKill = createRun({ seed: 20 });
  finalKill.enemies = [enemy({ kind: 'guardian', guardianStage: 3, x: 60, hp: 1, maxHp: 1, value: 25 })];
  advance(finalKill, 0.3);
  assert.equal(finalKill.finalGuardianDefeated, true);
  assert.equal(finalKill.bossesDefeated, 1);
});

test('snapshot restoration preserves seeded random state and every combat timer', () => {
  const run = createRun({ seed: 0x600d });
  advance(run, 7.2, { x: 0.7, y: -0.3 });
  const snapshot = serialize(run);
  const copy = restore(JSON.parse(JSON.stringify(snapshot)));
  assert.ok(copy);
  assert.deepEqual(serialize(copy), snapshot);
  for (let frame = 0; frame < 700; frame += 1) {
    const input = { x: Math.sin(frame / 70), y: Math.cos(frame / 90) };
    step(run, input, 1 / 60);
    step(copy, input, 1 / 60);
    if (run.status === 'upgrade') {
      assert.equal(chooseUpgrade(run, run.choices[0]), true);
      assert.equal(chooseUpgrade(copy, copy.choices[0]), true);
    }
  }
  assert.deepEqual(serialize(run), serialize(copy));
  snapshot.player.x = 999;
  assert.notEqual(run.player.x, 999, 'snapshot must not retain mutable aliases');
});

test('corrupt, oversized, and non-finite saves are rejected without throwing', () => {
  const valid = serialize(createRun({ seed: 0 }));
  for (const malformed of [null, [], '', {}, { ...valid, version: 99 }, { ...valid, time: Infinity },
    { ...valid, rngState: -2 }, { ...valid, choices: ['unknown'] },
    { ...valid, enemies: Array(LIMITS.enemies + 1).fill(enemy()) },
    { ...valid, player: { ...valid.player, x: NaN } },
    { ...valid, upgrades: { unknown: 100 } },
    { ...valid, projectiles: [{ x: 0, y: 0, vx: 1e20 }] },
    { ...valid, status: 'won', time: 0 },
  ]) assert.equal(restore(malformed), null);
  assert.ok(restore(valid));
});

test('long seeded runs respect entity caps and remain finite', () => {
  for (const seed of [1, 4, 91]) {
    const run = createRun({ seed });
    for (let frame = 0; frame < DURATION * 60 && run.status !== 'won' && run.status !== 'lost'; frame += 1) {
      // God mode is confined to this stress fixture; all production combat still runs.
      run.player.hp = run.player.maxHp;
      step(run, { x: Math.cos(frame / 130), y: Math.sin(frame / 130) }, 1 / 60);
      while (run.status === 'upgrade') chooseUpgrade(run, run.choices[0]);
      for (const collection of ['enemies', 'projectiles', 'gems', 'effects']) assert.ok(run[collection].length <= LIMITS[collection]);
      assert.ok(Number.isFinite(run.player.x) && Number.isFinite(run.player.hp));
    }
    assert.ok(run.time >= DURATION - 1 / 60);
    assert.ok(restore(serialize(run)), 'a real long-run snapshot must remain valid');
  }
});

test('large frame gaps are capped and invalid inputs do not poison simulation', () => {
  const run = createRun({ seed: 9 });
  step(run, { x: Infinity, y: NaN }, 1000);
  assert.ok(run.time <= 0.25 + 1e-9);
  assert.equal(run.player.x, 0);
  assert.equal(run.player.y, 0);
  const snapshot = serialize(run);
  for (const dt of [-1, NaN, Infinity, undefined]) step(run, {}, dt);
  assert.deepEqual(serialize(run), snapshot);
});

test('a terminal state during a large frame gap remains restorable', () => {
  const run = createRun({ seed: 12 });
  run.player.hp = 1;
  run.boltTimer = 2;
  run.enemies = [enemy({ id: 1, x: 0 })];
  run.nextId = 2;
  step(run, {}, 0.25);
  assert.equal(run.status, 'lost');
  assert.ok(restore(serialize(run)));
});

test('exhausted upgrade ranks never produce an impossible choice', () => {
  const run = createRun({ seed: 30 });
  run.upgrades = Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, upgrade.max]));
  run.player.maxHp += 60;
  run.player.hp = run.player.maxHp;
  run.xp = run.xpNext;
  step(run, {}, 1 / 60);
  for (const id of run.choices) assert.ok(run.upgrades[id] < UPGRADES.find((upgrade) => upgrade.id === id).max);
  assert.equal(run.status, 'playing');
});

for(const character of ['scout','keeper','alchemist','ranger','duelist','stormcaller'])test(`a complete normal ${character} run wins through movement, pickups, and legal upgrades`, () => {
  const run = createRun({ seed: 1,character });
  const preference = ['orbit', 'pulse', 'spark', 'focus', 'haste', 'storm','ice','flame','cleaver','thorn','magnet', 'vitality', 'stride', 'repair'];
  for (let frame = 0; frame < DURATION * 60 && !['lost', 'won'].includes(run.status); frame += 1) {
    const player = run.player;
    let target = null;
    for (const crystal of [...run.chests,...run.gems]) {
      if (!target || Math.hypot(crystal.x - player.x, crystal.y - player.y) < Math.hypot(target.x - player.x, target.y - player.y)) target = crystal;
    }
    const distance = target ? Math.hypot(target.x - player.x, target.y - player.y) || 1 : 1;
    let x = target ? (target.x - player.x) / distance : Math.cos(frame / 260) * 0.4;
    let y = target ? (target.y - player.y) / distance : Math.sin(frame / 260) * 0.4;
    for (const creature of run.enemies) {
      const dx = player.x - creature.x;
      const dy = player.y - creature.y;
      const near = Math.hypot(dx, dy) || 1;
      if (near < 85) { const force = (85 - near) / 45; x += dx / near * force; y += dy / near * force; }
    }
    for (const shot of run.projectiles.filter(s=>s.hostile)) {
      const dx=player.x-shot.x,dy=player.y-shot.y,near=Math.hypot(dx,dy)||1;
      if(near<65){x+=dx/near*(65-near)/30;y+=dy/near*(65-near)/30;}
    }
    step(run, { x, y }, 1 / 60);
    while (run.status === 'upgrade') {
      const recovery=run.player.hp<run.player.maxHp*.65&&['vitality','repair'].find(id=>run.choices.includes(id));
      const id = recovery || preference.find((candidate) => run.choices.includes(candidate));
      assert.equal(chooseUpgrade(run, id), true);
    }
  }
  assert.equal(run.status, 'won');
  assert.equal(run.bossesDefeated, 3);
  assert.ok(run.kills > 100 && run.player.hp > 0);
  assert.ok(restore(serialize(run)));
});
