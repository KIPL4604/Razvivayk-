import assert from 'node:assert/strict';
import test from 'node:test';
import {steer} from './helpers/lumen-pilot.mjs';
import {WEAPON_IDS,CHARACTERS} from '../webapp/frontend/js/lumen/catalog.mjs';
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
  assert.ok(run.contactTimer > 0);
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
  const chosen = run.choices[0], previousRank=run.upgrades[chosen]||0;
  assert.equal(chooseUpgrade(run, chosen), true);
  assert.equal(run.upgrades[chosen], previousRank+1);
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

test('target level starts the final arena, while time and guardian kills alone do not win', () => {
  const won=createRun({seed:1});won.level=29;won.xp=won.xpNext;
  step(won,{},1/60);assert.equal(won.status,'playing');assert.equal(won.level,30);assert.equal(won.arena.phase,'forming');assert.equal(won.endReason,'');
  assert.deepEqual(won.choices,[]);assert.equal(won.bossesDefeated,0);assert.ok(restore(serialize(won)));
  const ongoing=createRun({seed:1});ongoing.time=480;ongoing.spawnedGuardians=3;ongoing.spawnedElites=4;ongoing.finalGuardianDefeated=true;
  step(ongoing,{},1/60);assert.equal(ongoing.status,'playing');assert.ok(ongoing.time>480);assert.ok(restore(serialize(ongoing)));
  const dead=createRun({seed:2});dead.player.hp=1;dead.boltTimer=2;dead.enemies=[enemy({x:0})];
  step(dead,{},1/60);assert.equal(dead.status,'lost');assert.equal(dead.player.hp,0);
  const finalKill=createRun({seed:20});finalKill.enemies=[enemy({kind:'guardian',guardianStage:3,x:60,hp:1,maxHp:1,value:25})];
  advance(finalKill,.3);assert.equal(finalKill.finalGuardianDefeated,true);assert.notEqual(finalKill.status,'won');
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
      while (run.status === 'upgrade') assert.equal(chooseUpgrade(run, run.choices[0]),true,'the offered stress upgrade must remain selectable');
      for (const collection of ['enemies', 'projectiles', 'gems', 'effects']) assert.ok(run[collection].length <= LIMITS[collection]);
      assert.ok(Number.isFinite(run.player.x) && Number.isFinite(run.player.hp));
    }
    assert.ok(run.status==='won'||run.time>=DURATION-1/60);
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

for(const map of ['garden','quarry'])for(const character of Object.keys(CHARACTERS))test(`a complete normal ${map}/${character} run wins through movement, pickups, and legal upgrades`, (t) => {
  const attempts=[];
  // A survival game allows losing a seed. Prove each fighter can complete both
  // maps across three fixed seeds, always through legal choices and real HP.
  for(const seed of [1,17,61]){
  const run = createRun({ seed,character,map }),pilotMemory={};
  const preference = [...(character==='stormcaller'?['storm','haste','focus']:[]),'pulse', 'spark', 'orbit','flame', 'focus', 'haste', 'storm','ice','cleaver','thorn','aegis','chronogear','amplifier','collector','chakram','spear','prism','cyclone','briar','sunrise','sunlance','eclipse','gravity','drone','meteor','bell','mine','frostnova','needle','fan','laurel','heart','carapace','ember','compass','hourglass','magnet', 'vitality', 'stride', 'repair'];
  for (let frame = 0; frame < 900 * 60 && !['lost', 'won'].includes(run.status); frame += 1) {
    step(run, steer(run,frame,pilotMemory), 1 / 60);
    while (run.status === 'upgrade') {
      const recovery=run.player.hp<run.player.maxHp*.65&&['vitality','repair'].find(id=>run.choices.includes(id));
      const discovery=WEAPON_IDS.filter(id=>run.upgrades[id]).length<3&&preference.find(id=>WEAPON_IDS.includes(id)&&!run.upgrades[id]&&run.choices.includes(id));
      const defense=run.player.hp<run.player.maxHp*.8&&['aegis','stride'].find(id=>run.choices.includes(id));
      const id = recovery || discovery || defense || preference.find((candidate) => run.choices.includes(candidate)) || run.choices[0];
      assert.equal(chooseUpgrade(run, id), true);
    }
  }
  attempts.push({seed,status:run.status,time:run.time,level:run.level,kills:run.kills,upgrades:run.upgrades});
  assert.ok(restore(serialize(run)));
  if(run.status==='won'){
    assert.equal(run.level,map==='garden'?30:35);
    assert.ok(run.kills>100&&run.player.hp>0);
    t.diagnostic('Winning seed '+seed+'; attempts '+attempts.length);return;
  }
  }
  assert.fail(JSON.stringify({map,character,attempts}));
});
