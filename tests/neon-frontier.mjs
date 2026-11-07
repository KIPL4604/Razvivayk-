import assert from "node:assert/strict";
import test from "node:test";
import { HEIGHT, HULL, SECTORS, WIDTH, newFlight, stepFlight } from "../webapp/frontend/js/neon-frontier/flight.mjs";
import {
  acknowledgeCase, completeFlight, fitModule, openCase, restoreHangar, rewardFor, selectShip,
  shipStats, upgradeShip,
} from "../webapp/frontend/js/neon-frontier/economy.mjs";

const STEP = 1 / 60;

function advance(run, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) stepFlight(run, input, STEP);
}

function rangeWithCannon(rank, targets) {
  const profile = restoreHangar(null);
  profile.modules.cannon = rank;
  fitModule(profile, "swift", "cannon", rank);
  const run = newFlight(shipStats(profile));
  run.wave = SECTORS[0].waves.length;
  run.enemies = targets.map(([x, y]) => ({
    kind: "scout", baseX: x, x, y, age: 0, sway: 0, offset: 0, speed: 0,
    delay: 60, hit: 0, hp: 100, radius: 8,
  }));
  return run;
}

test("the equipped Photon Cutter charges then hits multiple targets down one lane", () => {
  const run = rangeWithCannon(2, [[128, 120], [128, 225], [165, 225]]);
  advance(run, .2);
  assert.deepEqual(run.enemies.map(e => e.hp), [100, 100, 100]);
  assert.equal(run.bolts.length, 0);
  advance(run, .26);
  const [top, middle, side] = run.enemies.map(e => e.hp);
  assert.ok(top < 100);
  assert.equal(top, middle);
  assert.equal(side, 100);
  advance(run, .16, { target: { x: 165, y: run.player.y } });
  assert.ok(run.enemies[2].hp < 100);
});

test("the equipped Quasar detonates once and damages only targets in reach", () => {
  const run = rangeWithCannon(3, [[128, 330], [150, 330], [190, 330]]);
  advance(run, .1);
  assert.deepEqual(run.enemies.map(e => e.hp), [100, 100, 100]);
  assert.equal(run.bolts.length, 1);
  advance(run, .2);
  const [direct, nearby, far] = run.enemies.map(e => e.hp);
  assert.ok(direct < nearby && nearby < 100);
  assert.equal(far, 100);
  assert.equal(run.bolts.length, 0);
  advance(run, .1);
  assert.deepEqual(run.enemies.map(e => e.hp), [direct, nearby, far]);
});

test("a new flight fires automatically, upgrades for kills and clamps the ship", () => {
  const run = newFlight();
  advance(run, STEP);
  assert.equal(run.bolts.length, 3);
  advance(run, 8);
  assert.ok(run.score > 0);
  assert.equal(run.weapon, 2);
  const fresh = newFlight();
  advance(fresh, 1.1, { x: -1, y: 1 });
  assert.equal(fresh.player.x, 12);
  assert.equal(fresh.player.y, HEIGHT - 16);
});

test("overlapping threats remove one hull, and standing still eventually loses", () => {
  const run = newFlight();
  const shot = { x: run.player.x, y: run.player.y, vx: 0, vy: 0, kind: "rose" };
  run.threats.push({ ...shot }, { ...shot });
  advance(run, STEP);
  assert.equal(run.player.hull, HULL - 1);
  assert.ok(run.player.guard > 0);
  assert.equal(run.threats.length, 1);
  advance(run, 15);
  assert.equal(run.phase, "lost");
  const elapsed = run.elapsed;
  advance(run, 1);
  assert.equal(run.elapsed, elapsed);
});

function approachCommander(sector) {
  const run = newFlight();
  run.sector = sector;
  run.wave = SECTORS[sector].waves.length;
  run.clock = SECTORS[sector].waves.at(-1)[0] + 4;
  advance(run, STEP);
  assert.equal(run.phase, "boss");
  return run;
}

test("bosses differ in volley pattern and increase pressure in their second phase", () => {
  for (const [sector, normal, fierce] of [[0, 7, 9], [1, 15, 21]]) {
    for (const [fraction, count] of [[1, normal], [.4, fierce]]) {
      const run = approachCommander(sector);
      run.boss.hp = Math.floor(run.boss.maxHp * fraction);
      run.boss.y = 77;
      run.boss.delay = 0;
      advance(run, STEP);
      assert.equal(run.threats.length, count);
      assert.equal(new Set(run.threats.map(s => `${s.vx.toFixed(3)},${s.vy.toFixed(3)}`)).size, count);
    }
  }
});

test("defeating the commanders clears their fire, repairs the ship and ends the run", () => {
  const run = approachCommander(0);
  function lastHit() {
    Object.assign(run.boss, { y: 77, hp: 1 });
    run.bolts.push({ x: WIDTH / 2, y: 86, vx: 0, vy: -285 });
    run.threats.push({ x: 40, y: 200, vx: 0, vy: 90, kind: "rose" });
    advance(run, STEP);
    assert.equal(run.boss, null);
    assert.equal(run.threats.length, 0);
  }
  run.player.hull = 1;
  lastHit();
  assert.equal(run.phase, "transit");
  assert.equal(run.score, 2200);
  advance(run, 2.65);
  assert.equal(run.sector, 1);
  assert.equal(run.player.hull, HULL);
  run.wave = SECTORS[1].waves.length;
  run.clock = SECTORS[1].waves.at(-1)[0] + 4;
  advance(run, STEP);
  lastHit();
  assert.equal(run.phase, "won");
  assert.equal(run.score, 6000);
});

test("an old browser record survives migration and malformed upgrades are repaired", () => {
  const fresh = restoreHangar(null, 15900);
  assert.equal(fresh.best, 15900);
  assert.equal(fresh.coins, 120);
  assert.equal(fresh.active, "swift");
  const restored = restoreHangar({
    version: 1, coins: -100, ships: { ion: { cannon: 7, drive: 2 } }, active: "unknown",
    modules: { cannon: 99, drive: 1, reactor: -4 }, pending: { id: 9, part: "unknown" },
  }, 15900);
  assert.equal(restored.best, 15900);
  assert.equal(restored.coins, 120);
  assert.deepEqual(restored.ships.ion, { cannon: 0, drive: 2, armor: 0 });
  assert.deepEqual(restored.modules, { core: 0, cockpit: 0, cannon: 0, drive: 1, armor: 0, reactor: 0 });
  assert.equal(restored.active, "swift");
  assert.equal(restored.pending, null);
});

test("purchase, selection and upgrades charge once at the current price", () => {
  const profile = restoreHangar(null);
  assert.ok(selectShip(profile, "ion"));
  assert.equal(profile.coins, 120);
  completeFlight(profile, 15900, 1000);
  assert.equal(profile.best, 15900);
  assert.equal(selectShip(profile, "ion"), undefined);
  assert.equal(profile.active, "ion");
  assert.equal(profile.coins, 770);
  selectShip(profile, "swift");
  selectShip(profile, "ion");
  assert.equal(profile.coins, 770);
  assert.equal(upgradeShip(profile, "ion", "drive", 0), undefined);
  assert.ok(upgradeShip(profile, "ion", "drive", 0));
  assert.equal(profile.coins, 650);
  assert.equal(shipStats(profile).speed, 267);
});

test("opening commits one reward and one debit, including duplicate recovery after reload", () => {
  let profile = restoreHangar(null);
  profile.coins = 900;
  const rig = (rank, part) => {
    const rolls = [rank, part];
    return () => rolls.shift();
  };
  assert.equal(openCase(profile, "patrol", rig(.25, .6)), undefined);
  assert.deepEqual(profile.pending, { id: 1, caseId: "patrol", part: "drive", rank: 1, refund: 0 });
  assert.equal(profile.coins, 800);
  assert.ok(openCase(profile, "orbital", rig(.95, .9)));
  profile = restoreHangar(JSON.parse(JSON.stringify(profile)));
  acknowledgeCase(profile, 1);
  openCase(profile, "orbital", rig(.95, .9));
  assert.equal(profile.modules.reactor, 3);
  assert.equal(profile.coins, 600);
  acknowledgeCase(profile, 2);
  openCase(profile, "stellar", rig(.7, .9));
  assert.deepEqual(profile.pending, { id: 3, caseId: "stellar", part: "reactor", rank: 3, refund: 140 });
  assert.equal(profile.coins, 240);
  acknowledgeCase(profile, 2);
  assert.equal(profile.pending.id, 3);
  fitModule(profile, "swift", "reactor", 3);
  assert.equal(rewardFor({ score: 2800, phase: "won", build: shipStats(profile) }), 299);
});

test("installing, swapping to stock and reloading preserve a separate loadout per ship", () => {
  let profile = restoreHangar(null);
  profile.coins = 700;
  openCase(profile, "orbital", () => .03);
  assert.equal(profile.pending.part, "core");
  assert.equal(profile.modules.core, 1);
  assert.ok(fitModule(profile, "swift", "core", 2));
  assert.equal(fitModule(profile, "swift", "core", 1), undefined);
  assert.equal(shipStats(profile).hull, 4);
  assert.ok(fitModule(profile, "ion", "core", 1));
  selectShip(profile, "ion");
  assert.equal(shipStats(profile).hull, 3);
  profile = restoreHangar(JSON.parse(JSON.stringify(profile)));
  assert.equal(shipStats(profile, "swift").parts.core, 1);
  assert.equal(fitModule(profile, "swift", "core", 0), undefined);
  assert.equal(shipStats(profile, "swift").hull, 3);
});

test("a flight takes a snapshot of the active ship and the modules affect combat", () => {
  const profile = restoreHangar(null);
  profile.coins = 1100;
  selectShip(profile, "prism");
  profile.modules.armor = 3;
  profile.modules.cannon = 2;
  profile.modules.cockpit = 3;
  fitModule(profile, "prism", "armor", 3);
  fitModule(profile, "prism", "cannon", 2);
  fitModule(profile, "prism", "cockpit", 3);
  const loadout = shipStats(profile);
  const run = newFlight(loadout);
  loadout.hull = 2;
  loadout.parts.armor = 0;
  assert.equal(run.build.parts.armor, 3);
  assert.ok(run.build.cadence < .123);
  assert.equal(run.player.hull, 6);
  advance(run, STEP, {x: 1});
  assert.equal(run.gun, "beam");
  assert.equal(run.beam.width, 6);
  assert.equal(run.player.x, WIDTH / 2 + 230 / 60);
  run.threats.push({ x: run.player.x, y: run.player.y, vx: 0, vy: 0, kind: "amber" });
  advance(run, STEP);
  assert.equal(run.player.hull, 5);
  assert.ok(run.player.guard > 1.9);
  assert.equal(run.build.damage, 1.24);
});
