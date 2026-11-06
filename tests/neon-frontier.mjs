import assert from "node:assert/strict";
import test from "node:test";
import { HEIGHT, HULL, SECTORS, WIDTH, newFlight, stepFlight } from "../webapp/frontend/js/neon-frontier/flight.mjs";

const STEP = 1 / 60;

function advance(run, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) stepFlight(run, input, STEP);
}

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
