import { PARTS, PART_IDS } from "./economy.mjs?v=2";
import { cannonProfile } from "./guns.mjs?v=1";

function hull(half) {
  const width = Math.max(...half.map(row => row.length));
  return half.map(row => {
    const left = row.padStart(width, ".");
    return left + [...left.slice(0, -1)].reverse().join("");
  });
}

export const SHIP_SPRITES = {
  swift: {
    rows: [
      "........w........", ".......wBw.......", ".......wBw.......",
      "......bBCBb......", "..b...bBCBb...b..", "..bb.bBwCwBb.bb..",
      ".bBBBbBwCwBbBBBb.", ".bBwwBBwCwBBwwBb.", "bBBbBBBBwBBBBbBBb",
      "bBbb.BBWWWBB.bbBb", "bBb..bBBwBBb..bBb", "b...bbBBwBBbb...b",
      "....bb.bBb.bb....", ".......bBb.......",
    ],
    colors: { b: "#245876", B: "#58a6c4", C: "#286786", w: "#bfe2e8", W: "#ebffff" },
    jet: "#62e6ff",
  },
  ion: {
    rows: hull([
      "w", "wB", "wC", "bwC", "bBC", "bwBC", "bwWC", "b.bwWC",
      "bB.bBWC", "bBw.bBWC", "bBBwbwWB", "bCBwwBwC", "bCbbBwWB",
      "bBw.bBwW", "bBw..bwB", "bB...bCB", "bw...bbW", "b....bw", "w....b",
    ]),
    colors: { b: "#214354", B: "#4d938e", C: "#145c57", w: "#91ddaf", W: "#dcffdd" },
    jet: "#97ffad",
  },
  bastion: {
    rows: hull([
      "bbB", "bwwB", "bBwCB", "bBBwCB", "bb.BBwCB", "bbw.bBwCB",
      "bwwB.bBwCB", "bBCBBbBBwCB", "bBCBBbBBwWW", "bCBBCBbBwCW",
      "bCwBCBbBBwW", "bBwBBbbBBBC", "bBwBBb.bBBC", "bBBBbb.bBwW",
      "bwBbb..bBwW", "bwB....bbWB", "bB......bCB", "b.......bw", "........bb",
    ]),
    colors: { b: "#553446", B: "#b97457", C: "#76494f", w: "#f4b47c", W: "#fff0b6" },
    jet: "#ffc27c",
  },
  prism: {
    rows: hull([
      "W", "wW", "wC", "bwC", "bBC", "w....bwC", "bw....bBWC", "bww...bBWC",
      "bBBw..bBwC", "bCBBw.bBwW", "bCwBBwbBwW", "bBwCBBwwBW",
      "bBwCBBbBwC", "bBwBBb.bBw", "bCBBb..bwW", "bBBb...bCW",
      "bBw....bwB", "bw.....bB", "w......bb",
    ]),
    colors: { b: "#493664", B: "#8867ae", C: "#674a91", w: "#caa6fc", W: "#ffe9fb" },
    jet: "#d5a5ff",
  },
};

// D = shaded steel, M = metal, L = lit edge, E = luminous insert, W = reflection.
// Each half module is installed as a mirrored pair. The same pixels are used in Canvas and the dock.
const ATLAS = {
  core: [
    ["..LLL..", ".LMMML.", "DMMMMMD", "DMLMLMD", "DMMMMMD", ".DMMMD.", "..DDD.."],
    ["..LLLLL..", ".LMMMMML.", "DMLMMMLMD", "DMMDMDMMD", "DMMMMMMMD", "DMLMMMLMD", ".DDMMMDD.", "..DDDDD.."],
    ["...LLLLL...", ".LLMMMMMLL.", "LMDLMMMLDML", "DMMMMMMMMMD", "DMDLEMELDMD", "DMMMMMMMMMD", ".DDLMLMLDD.", "..DDMMMDD..", "....DDD...."],
    ["..LLLLLLL..", ".LLMEMEMLL.", "LLMMMMMMMLL", "DMMLMMMLMMD", "DMLMMMMMLMD", "DEMDLMLDMED", "DMLMMMMMLMD", ".DDMMMMMDD.", "...DDDDD..."],
  ],
  cockpit: [
    ["..L..", ".DED.", "DEWED", "DEWED", ".DED.", "..D.."],
    ["..L..", ".LEL.", ".DEW.", "DEWED", "DEWED", "DEWED", ".DDD."],
    ["..LLL..", ".LEWEL.", "LEWEWEL", "DEWEWED", "DEEEEED", ".DMMMD."],
    ["...L...", "..LWL..", ".LEWEL.", "LEWEWEL", "DEWLWED", "DEWLWED", ".DELED.", "..DDD.."],
  ],
  drive: [
    [".MMM.", ".LML.", "DMMMD", "DLELD", ".LEL.", ".EEE.", "..E.."],
    [".MMM.", "LMMML", "DLMLD", "DLELD", "LWEWL", ".WEW.", ".EEE.", "..E.."],
    ["..MMM..", ".LMMML.", ".DMLMD.", "DLLMLLD", "DLEWELD", ".LWEWL.", ".EEWEE.", "..EWE..", "...E..."],
    [".M...M.", "LML.LML", "DMDMDMD", "LELELEL", "LWEWEWL", "EWEWEWE", ".EEWEE.", ".E.W.E.", "...E..."],
  ],
  armor: [
    ["...LM", "..LMM", ".LMMM", ".DMLM", "DMMMD", ".DDD."],
    ["...LL.", "..LMM.", ".LMLMD", ".LMMMD", "LMLMMD", "DMMMDD", ".DDD.."],
    ["..WLL..", ".LLMMMD", "LMLLMMD", "LMDMMLD", "LMMLLMD", "DMMMMDD", ".DDDD.."],
    ["..WLW..", ".LLMLL.", "LMDMDML", "LMLMLML", "DMLMLMD", "DEMLMED", ".DMMMD.", "..DDD.."],
  ],
  reactor: [
    [".LML.", "DEWED", "DEWED", ".DMD."],
    [".LML.", "LEWEL", "DWWWD", "DEWED", ".DMD."],
    ["..L..", ".LEL.", "LEWEL", "LWWWL", "DEWED", ".DED.", "..D.."],
    ["..L.L..", ".LEWEL.", "LEWMWEL", "DWWLWWD", "DEWWWED", ".DEWED.", "..DDD.."],
  ],
};

// Cannon shapes drawn directly on the finer half-unit grid.
const CANNONS = [
  [
    "...LEL...", "...MEM...", "...MWM...", "..LMEML..", "..DMEMD..",
    "..LMEML..", ".DDMWMDD.", ".LDLMLDL.", ".DMMMMMD.", "..DDDDD..",
    "...DDD...",
  ],
  [
    "....LWL....", "....MEM....", "....MEM....", "...LMEML...", "...DMEMD...",
    "...LMWML...", "..LDMEMDL..", ".LLMMEMMLL.", ".DMDLMLDMD.", "LMMMLELMMML",
    "DMDMMLMMDMD", "DMMMDLDMMMD", ".DDMMLMMDD.", "...DDDDD...", "....DDD....",
  ],
  [
    "..LW...WL..", "..LE...EL..", "..ME...EM..", "..ME...EM..", "..DE...ED..",
    "..LW...WL..", ".LMEM.MEML.", ".DLEMDMELD.", "LDMEWLWEMDL", "DMMDLELDMMD",
    "DLMMWEWMMLD", "DMMMLELMMMD", "DLDDMLMDDLD",
    ".DDMMLMMDD.", "..DDMMMDD..", "....DDD....", "....DDD....", "....DDD....",
  ],
  [
    "....LWWWL....", "...LMEWEML...", "..LDEWWWEDL..", "..DMEWWWEMD..",
    "..LDEWEWEDL..", ".LLMEWEWEMLL.", "LDMDLWELDMDML", "DLEMEEWEEMELD",
    "DEWMLEWELMWED", "DLEMEEWEEMELD", "LDMDLWELDMDML", ".LLMELELEMLL.",
    ".DDMLMMMLMDD.", "..DLMDMDMLD..", "...DMMMMMD...", "....DMMMD....",
    ".....DDD.....", ".....DDD.....",
  ],
];

// Inboard ends are on the right; the opposite wing mirrors the same shell.
const WING_SHELLS = {
  swift: { x: 7, y: 0, rows: [
    "..........wB...", ".........wBBb..", "........wB.CBb.", ".......wBBCBBb.",
    "......wBBCCBBbb", "....wwBBCCBBBbb", "...wBBCCBwwBBbb", ".wwBBBCCBBbBBbb",
    "wBBBBCBBBbBBBbb", "bBBwBBBBBBBBBbb", ".bBBbwBBBBBBbb.", "..bbBBbbbbb....",
    "....bbb........",
  ] },
  ion: { x: 9, y: 3, rows: [
    "........wBb....", "........wBCb...", ".......wBCBb...", ".......wBCBb...",
    "......wBCBBb...", ".....wBCCCBBb..", "....wBBCCBWBb..", "...wBCCCBBBBb..",
    "..wBCCBwwBBb...", ".wBCBBBwBBb....", "wBCBBwwBBb.....", "bBBBBBBBb......",
    "bbBBBbbb.......", ".bbbb..........", ".bb............", "..b............",
  ] },
  bastion: { x: 10, y: 1, rows: [
    "......wwwBBBBbb..", "....wwBBBBBBBBbb.", "...wBBCCCCBBBCBbb", "..wBBCCwwCCBBCBbb",
    ".wBBBCBBBBCBBCBbb", ".wBBBCBwbBCBBCBbb", "wBBBBCBwbBCBBBBbb", "wBCBBCBBBBCBBCBbb",
    "bBCBBBCCCCBBBBBbb", "bBBwwBBBBBwwBBBbb", "bBBBBBBBBBBBBBBbb", ".bbBCBBCCBBBbbb.",
    "..bbBBBBBBbbb....", "....bbbbbbb......",
  ] },
  prism: { x: 9, y: 1, rows: [
    "...........wB....", "..........wWBBb..", "........wwBBBbBb.", ".......wBBCCBBBbb",
    ".....wwBBBCCBBBbb", "...wwBCCCCBBBBbb.", "..wBBCCwWBBBBbb..", ".wBBCBwWBBBBbb...",
    "wBBCBwWBBBBbb....", "bBBBBBBBBBbb.....", "bbBBBBBBbb.......", "..bbBBBbb........",
    "....bbbb.........",
  ] },
};

const PALETTES = {
  cockpit: { D: "#1a4f55", M: "#367577", L: "#9edbd2", E: "#59e7b2", W: "#e2fff0" },
  drive: { D: "#29485e", M: "#53758d", L: "#8abacc", E: "#52dbff", W: "#e2fcff" },
  armor: { D: "#26384f", M: "#607e9b", L: "#a9c0d7", E: "#83bdfc", W: "#e9faff" },
  reactor: { D: "#512f66", M: "#7f5596", L: "#cf93dc", E: "#f495ff", W: "#fff0ff" },
};

const MOUNTS = {
  swift: { cannon: [9, -7], armor: [13, 2], drive: [5, 10], cockpit: [0, -9] },
  ion: { cannon: [8, -7], armor: [13, 3], drive: [7, 12], cockpit: [0, -10] },
  bastion: { cannon: [12, -8], armor: [15, 2], drive: [8, 12], cockpit: [0, -8] },
  prism: { cannon: [11, -6], armor: [14, 2], drive: [6, 10], cockpit: [0, -11] },
};
const EXPLODED = {
  cockpit: [0, -17, 0, -23], cannon: [15, -10, -15, -18],
  core: [0, -3, 0, -9], armor: [20, 3, 20, -4],
  reactor: [0, 9, 0, 3.5], drive: [11, 19, 11, 12.5],
};
const LAYERS = ["drive", "armor", "cannon", "core", "reactor", "cockpit"];

function pixels(rows, palette, cx, cy, scale = 1, mirror = false) {
  const blocks = [];
  const width = Math.max(...rows.map(row => row.length));
  const left = cx - Math.floor(width / 2) * scale;
  const top = cy - Math.floor(rows.length / 2) * scale;
  rows.forEach((row, y) => {
    if (mirror) row = [...row].reverse().join("");
    for (let x = 0; x < row.length;) {
      const key = row[x];
      let end = x + 1;
      while (row[end] === key) end++;
      if (palette[key]) blocks.push([left + x * scale, top + y * scale, (end - x) * scale, scale, palette[key]]);
      x = end;
    }
  });
  return blocks;
}

function tint(color, target, amount) {
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(color.slice(offset, offset + 2), 16);
    return Math.round(value + (target - value) * amount).toString(16).padStart(2, "0");
  });
  return "#" + channels.join("");
}

function detailedPixels(rows, palette, cx, cy, mirror = false) {
  const width = Math.max(...rows.map(row => row.length));
  const left = cx - Math.floor(width / 2);
  const top = cy - Math.floor(rows.length / 2);
  const tones = Object.fromEntries(Object.entries(palette).map(([key, color]) =>
    [key, [tint(color, 255, .22), tint(color, 0, .29)]]));
  const blocks = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = row[x];
      const color = palette[key];
      if (!color) continue;
      const bx = left + (mirror ? width - x - 1 : x);
      const by = top + y;
      const [light, shadow] = tones[key];
      const topTone = !palette[rows[y - 1]?.[x]] ? light : color;
      const bottomTone = !palette[rows[y + 1]?.[x]] ? shadow : color;
      const leftTone = palette[row[x - 1]] ? bottomTone : light;
      const rightTone = palette[row[x + 1]] ? topTone : shadow;
      if (rightTone === topTone) blocks.push([bx, by, 1, .5, topTone]);
      else blocks.push([bx, by, .5, .5, topTone], [bx + .5, by, .5, .5, rightTone]);
      if (leftTone === bottomTone) blocks.push([bx, by + .5, 1, .5, bottomTone]);
      else blocks.push([bx, by + .5, .5, .5, leftTone], [bx + .5, by + .5, .5, .5, bottomTone]);
    }
  });
  return blocks;
}

function modulePixels(id, part, rank, x = 0, y = 0, mirror = false) {
  if (part === "cannon") {
    const { shade, edge, light } = cannonProfile(rank);
    return pixels(CANNONS[rank], { D: "#202b47", M: "#465f7b", L: shade, E: edge, W: light }, x, y, .5, mirror);
  }
  const skin = SHIP_SPRITES[id].colors;
  const palette = part === "core"
    ? { D: skin.b, M: skin.B, L: skin.w, E: skin.W, W: "#ffffff" } : PALETTES[part];
  return detailedPixels(ATLAS[part][rank], palette, x, y, mirror);
}

export function shipLayout(id, parts = {}, exploded = false) {
  const frame = SHIP_SPRITES[id];
  const ink = frame.colors;
  const wing = WING_SHELLS[id];
  const shell = [
    ...pixels(wing.rows, ink, -wing.x, wing.y, .5),
    ...pixels(wing.rows, ink, wing.x, wing.y, .5, true),
  ];
  const base = detailedPixels(frame.rows, ink, 0, 0);
  const mounts = MOUNTS[id];
  const rails = [];
  function beam(x, y, w, h, color) {
    rails.push([x, y, w, h, color], [-x - w, y, w, h, color]);
  }
  if (!exploded) {
    const [gunX, gunY] = mounts.cannon;
    const [armorX, armorY] = mounts.armor;
    const [engineX, engineY] = mounts.drive;
    rails.push([-2, mounts.cockpit[1], 4, 10, ink.b], [-1, mounts.cockpit[1] + 1, 2, 8, ink.B]);
    beam(2, gunY + 3, gunX - 1, 3, ink.b);
    beam(3, gunY + 3, gunX - 2, .5, ink.B);
    beam(gunX - 2, gunY + 4, 2, 1, ink.w);
    beam(armorX - 2, gunY + 4, 3, armorY - gunY - 2, ink.b);
    beam(3, armorY, armorX - 2, 4, ink.b);
    beam(5, armorY, armorX - 4, .5, ink.w);
    beam(armorX - 4, armorY + 1, 2.5, 1, ink.B);
    beam(engineX - 2, 2, 4, engineY - 2, ink.b);
    beam(engineX - 1, 4, .5, engineY - 4, ink.B);
    beam(engineX + .5, 6, .5, engineY - 6, ink.w);
  }
  const pieces = LAYERS.map(part => {
    const rank = parts[part] ?? 0;
    const [x, y] = exploded ? EXPLODED[part] : (MOUNTS[id][part] ?? [0, part === "reactor" ? 5 : -1]);
    const offset = !exploded && part === "cannon" ? -Math.floor(rank / 2) : 0;
    const blocks = x
      ? [...modulePixels(id, part, rank, -x, y + offset), ...modulePixels(id, part, rank, x, y + offset, true)]
      : modulePixels(id, part, rank, x, y);
    return { part, blocks };
  });
  const [jetX, jetY] = MOUNTS[id].drive;
  return { base, rails, shell, pieces, jetX, jetY: jetY + Math.floor(ATLAS.drive[parts.drive ?? 0].length / 2) };
}

function svgPixels(blocks) {
  const paths = new Map();
  for (const [x, y, w, h, color] of blocks) paths.set(color, (paths.get(color) ?? "") + `M${x} ${y}h${w}v${h}H${x}z`);
  return [...paths].map(([color, path]) => `<path fill="${color}" d="${path}"/>`).join("");
}

export function moduleSvg(id, part, rank) {
  return `<svg class="nf-part-preview" viewBox="-6 -6 12 12" shape-rendering="crispEdges" aria-hidden="true">${svgPixels(modulePixels(id, part, rank))}</svg>`;
}

export function shipSvg(id, className = "", parts = {}, { exploded = false, selected = "" } = {}) {
  const { base, rails, shell, pieces } = shipLayout(id, parts, exploded);
  const guide = exploded ? `<path d="M0-13V-7M0 0V6M-8 0H-15M8 0H15M-4-3l-8-6M4-3l8-6M-4 6l-6 9M4 6l6 9" class="nf-mount-lines"/>` : "";
  const labels = exploded ? PART_IDS.map(part => {
    const [, , x, y] = EXPLODED[part];
    return `<text class="nf-mount-label" fill="${PARTS[part].ink}" x="${x}" y="${y}">${PARTS[part].label}</text>`;
  }).join("") : "";
  return `<svg class="${className}" viewBox="${exploded ? "-29 -27 58 53" : "-22 -18 44 37"}" shape-rendering="crispEdges" aria-hidden="true">${guide}
    <g>${svgPixels(rails)}</g><g${exploded ? ' opacity=".13"' : ""}><g>${svgPixels(shell)}</g><g>${svgPixels(base)}</g></g>
    ${pieces.map(({ part, blocks }) => `<g data-slot-art="${part}" class="${part === selected ? "nf-part-selected" : ""}">${svgPixels(blocks)}</g>`).join("")}
    ${labels}</svg>`;
}
