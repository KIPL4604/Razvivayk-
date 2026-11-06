import { WIDTH, HEIGHT } from "./flight.mjs?v=2";

const SHIP = [
  "........w........",
  ".......wBw.......",
  ".......wBw.......",
  "......bBCBb......",
  "..b...bBCBb...b..",
  "..bb.bBwCwBb.bb..",
  ".bBBBbBwCwBbBBBb.",
  ".bBwwBBwCwBBwwBb.",
  "bBBbBBBBwBBBBbBBb",
  "bBbb.BBWWWBB.bbBb",
  "bBb..bBBwBBb..bBb",
  "b...bbBBwBBbb...b",
  "....bb.bBb.bb....",
  ".......bBb.......",
];
const SCOUT = [
  "....rrr....",
  ".r.rrrrr.r.",
  "rrrroorrrrr",
  ".rroooworr.",
  "..rrwwwrr..",
  "...rwrwr...",
  "....r.r....",
];
const WING = [
  "r......r......r",
  "rr....ror....rr",
  "rro..rooor..orr",
  "rroorrooorroorr",
  "r.rrrwwwwwrrr.r",
  "...rrwwwwwrr...",
  "....roowoor....",
  ".....rr.rr.....",
];
const LANCER = [
  "......rrr......",
  "..rr.rrorr.rr..",
  "..orrrrorrrro..",
  "..orrooooorro..",
  "r.orrwwwwwrro.r",
  "rroorrwwwoororr",
  ".rrrroowoorrrr.",
  ".....rowor.....",
  "......ror......",
  ".......o.......",
];

const PLAYER_COLORS = { b: "#245876", B: "#58a6c4", C: "#286786", w: "#bfe2e8", W: "#ebffff" };
const HOSTILE_COLORS = [
  { r: "#722e53", o: "#d85c81", w: "#ffd0bc" },
  { r: "#7b414d", o: "#e5865e", w: "#ffe1aa" },
];
const HULL_COLORS = [
  { dark: "#2b2347", mid: "#554570", light: "#9279a4", panel: "#68578d", hot: "#ff709f", core: "#ffe4cf" },
  { dark: "#432640", mid: "#75475b", light: "#ba7c7c", panel: "#98566c", hot: "#ff9564", core: "#ffe0ad" },
];

function sprite(ctx, rows, colors, x, y, size, flash = false) {
  const left = Math.round(x - rows[0].length * size / 2);
  const top = Math.round(y - rows.length * size / 2);
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (!colors[row[i]]) continue;
      ctx.fillStyle = flash ? "#fff3df" : colors[row[i]];
      ctx.fillRect(left + i * size, top + j * size, size, size);
    }
  });
}

function box(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
}

function mirrored(ctx, color, x, y, offset, width, height) {
  box(ctx, color, x - offset - width, y, width, height);
  box(ctx, color, x + offset, y, width, height);
}

function commander(ctx, boss, sector) {
  const { x, y } = boss;
  const c = HULL_COLORS[sector];
  const charging = boss.delay < .22 && boss.age > 1.2;
  const bright = boss.hit > 0 ? "#d7c4cc" : c.light;
  const flare = charging ? c.core : c.hot;
  mirrored(ctx, c.dark, x, y - 10, 19, 30, 20);
  mirrored(ctx, c.mid, x, y - 14, 23, 22, 22);
  mirrored(ctx, c.panel, x, y - 16, 27, 13, 20);
  mirrored(ctx, bright, x, y - 16, 27, 13, 3);
  mirrored(ctx, c.dark, x, y - 5, 34, 12, 14);
  mirrored(ctx, c.mid, x, y + 2, 23, 15, 10);
  mirrored(ctx, bright, x, y + 10, 28, 9, 3);
  mirrored(ctx, flare, x, y + 10, 32, 4, 4);
  box(ctx, c.dark, x - 25, y - 13, 50, 25);
  box(ctx, c.mid, x - 18, y - 20, 36, 36);
  box(ctx, c.panel, x - 12, y - 23, 24, 33);
  box(ctx, bright, x - 12, y - 23, 24, 3);
  mirrored(ctx, bright, x, y - 15, 11, 6, 19);
  box(ctx, c.dark, x - 9, y - 11, 18, 19);
  box(ctx, flare, x - 6, y - 7, 12, 11);
  box(ctx, c.core, x - 3, y - 5, 6, 6);
  box(ctx, c.dark, x - 14, y + 8, 28, 8);
  box(ctx, c.panel, x - 9, y + 12, 18, 8);
  box(ctx, flare, x - 4, y + 16, 8, 3);
  if (sector === 1) {
    mirrored(ctx, c.dark, x, y - 24, 39, 12, 30);
    mirrored(ctx, c.panel, x, y - 27, 42, 6, 26);
    mirrored(ctx, bright, x, y - 27, 42, 6, 4);
    mirrored(ctx, flare, x, y - 14, 44, 3, 9);
    mirrored(ctx, c.dark, x, y + 11, 13, 12, 12);
    mirrored(ctx, bright, x, y + 19, 16, 7, 3);
  }
}

function ring(ctx, x, y, radius, front, colors) {
  for (let i = 0; i < 720; i++) {
    const a = i * Math.PI / 360;
    if ((Math.sin(a) >= 0) !== front) continue;
    for (let band = 0; band < 3; band++) {
      const r = radius * (1.15 + band * .13);
      const u = Math.cos(a) * r;
      const v = Math.sin(a) * (r * .29);
      box(ctx, colors[band], x + u + v * .36, y + v - u * .32, band === 1 ? 2 : 1, 1);
    }
  }
}

function backdrop(sector) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  const x = sector ? 48 : 188;
  const y = sector ? 244 : 143;
  const radius = sector ? 61 : 55;
  const colors = sector
    ? ["#141326", "#241629", "#321b31", "#48243a", "#583047", "#714252"]
    : ["#0e192b", "#14253b", "#19324a", "#22415b", "#2d536c", "#426882"];
  const ringColors = sector ? ["#332038", "#49293e", "#2f2032"] : ["#22344a", "#344f62", "#1c3146"];
  ring(ctx, x, y, radius, false, ringColors);
  for (let py = -radius; py < radius; py++) {
    for (let px = -radius; px < radius; px++) {
      const nz = 1 - (px ** 2 + py ** 2) / radius ** 2;
      if (nz < 0) continue;
      const light = Math.sqrt(nz) * .52 - px / radius * .34 - py / radius * .38;
      const stripe = Math.sin(py * .26 + px * .047 + Math.sin(px * .16 + py * .06)) * .09;
      const dither = ((px + py) & 1) * .04;
      const band = Math.min(5, Math.max(0, Math.floor((light + stripe + dither + .11) * 8)));
      box(ctx, colors[band], x + px, y + py, 1, 1);
    }
  }
  ring(ctx, x, y, radius, true, ringColors);
  return canvas;
}

function stars() {
  let seed = 710;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  return Array.from({ length: 126 }, (_, i) => ({
    x: Math.floor(random() * WIDTH), y: Math.floor(random() * HEIGHT),
    speed: i < 15 ? 36 : i < 48 ? 18 : 7,
    color: i < 15 ? "#7191a6" : i < 48 ? "#344760" : "#233047",
  }));
}

function effects(ctx, run) {
  for (const burst of run.bursts) {
    const distance = 4 + burst.age * (70 + burst.size);
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.39996 + burst.x;
      const scale = 1 - (i % 4) * .15;
      const color = i % 3 === 0 ? "#ffd69a" : burst.kind === "pilot" ? "#78ecf5" : "#de6291";
      box(ctx, color, burst.x + Math.cos(angle) * distance * scale,
        burst.y + Math.sin(angle) * distance * scale, burst.age < .22 ? 3 : 1, 2);
    }
  }
}

export function createPainter(ctx) {
  const field = stars();
  const plates = [backdrop(0), backdrop(1)];

  return (run, reduced) => {
    const sector = run?.sector ?? 0;
    const time = run?.elapsed ?? 0;
    box(ctx, sector ? "#100e20" : "#090f20", 0, 0, WIDTH, HEIGHT);
    for (const star of field) {
      const y = (star.y + (reduced ? 0 : time * star.speed)) % HEIGHT;
      box(ctx, star.color, star.x, y, 1, star.speed === 36 ? 2 : 1);
    }
    ctx.drawImage(plates[sector], 0, 0);
    if (run) {
      for (const bolt of run.bolts) {
        box(ctx, bolt.core ? "#45daf1" : "#177cbd", bolt.x - 1, bolt.y - 6, 3, 11);
        box(ctx, bolt.core ? "#e0ffff" : "#6ddef4", bolt.x, bolt.y - 5, 1, 7);
      }
      for (const enemy of run.enemies) {
        const rows = enemy.kind === "scout" ? SCOUT : enemy.kind === "wing" ? WING : LANCER;
        sprite(ctx, rows, HOSTILE_COLORS[sector], enemy.x, enemy.y, 2, !reduced && enemy.hit > 0);
      }
      if (run.boss) commander(ctx, run.boss, sector);
      if (!reduced) effects(ctx, run);
    }
    const p = run?.player ?? { x: WIDTH / 2, y: HEIGHT - 57, bank: 0, guard: 0, hull: 3 };
    if (p.hull) {
      const flames = reduced ? 5 : 5 + Math.floor(time * 45) % 6;
      mirrored(ctx, "#22739e", p.x, p.y + 11, 5, 3, flames + 4);
      mirrored(ctx, "#5ce5f1", p.x, p.y + 11, 6, 1, flames);
      sprite(ctx, SHIP, PLAYER_COLORS, p.x + p.bank * 1.6, p.y, 2);
      if (p.guard > 0) {
        ctx.strokeStyle = "#66d6df";
        ctx.strokeRect(Math.round(p.x) - 19.5, Math.round(p.y) - 17.5, 39, 35);
      }
      box(ctx, "#fff5c3", p.x - 1, p.y - 1, 3, 3);
    }
    for (const shot of run?.threats ?? []) {
      const x = Math.round(shot.x);
      const y = Math.round(shot.y);
      if (shot.kind === "rose") {
        box(ctx, "#f34b91", x - 3, y - 1, 7, 3);
        box(ctx, "#f34b91", x - 1, y - 3, 3, 7);
        box(ctx, "#ffd9e2", x - 1, y - 1, 3, 3);
      } else {
        box(ctx, "#ec793e", x - 2, y - 4, 5, 9);
        box(ctx, "#fff0b1", x - 1, y - 2, 3, 5);
      }
    }
  };
}
