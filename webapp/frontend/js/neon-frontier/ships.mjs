import { PARTS, PART_IDS } from "./economy.mjs?v=2";

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
  cannon: [
    ["..W..", "..E..", ".DED.", ".MEL.", ".MEL.", ".DDD."],
    ["..W..", "..E..", ".LEL.", ".MEL.", ".MEL.", "DELED", "DMMMD", ".DDD."],
    [".W.W.", ".E.E.", ".E.E.", "DEDED", "LELEL", "DEDED", "LMMML", "DMMMD", ".DDD."],
    [".WWW.", ".LEL.", ".LEL.", ".LEL.", "LWEWL", "LEWEL", "DELED", "DMMMD", "LMMML", ".DDD."],
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

const PALETTES = {
  cockpit: { D: "#1a4f55", M: "#367577", L: "#9edbd2", E: "#59e7b2", W: "#e2fff0" },
  cannon: { D: "#674552", M: "#9b704f", L: "#dfae79", E: "#ffbe55", W: "#fff1b6" },
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
  const left = cx - Math.floor(width * scale / 2);
  const top = cy - Math.floor(rows.length * scale / 2);
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

function modulePixels(id, part, rank, x = 0, y = 0, mirror = false) {
  const skin = SHIP_SPRITES[id].colors;
  const palette = part === "core"
    ? { D: skin.b, M: skin.B, L: skin.w, E: skin.W, W: "#ffffff" } : PALETTES[part];
  return pixels(ATLAS[part][rank], palette, x, y, 1, mirror);
}

export function shipLayout(id, parts = {}, exploded = false) {
  const frame = SHIP_SPRITES[id];
  const base = pixels(frame.rows, frame.colors, 0, 0, 1);
  const ink = frame.colors;
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
    beam(3, gunY + 3, gunX - 2, 1, ink.B);
    beam(armorX - 2, gunY + 4, 3, armorY - gunY - 2, ink.b);
    beam(3, armorY, armorX - 2, 4, ink.b);
    beam(5, armorY, armorX - 4, 1, ink.w);
    beam(engineX - 2, 2, 4, engineY - 2, ink.b);
    beam(engineX - 1, 4, 2, engineY - 4, ink.B);
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
  return { base, rails, pieces, jetX, jetY: jetY + Math.floor(ATLAS.drive[parts.drive ?? 0].length / 2) };
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
  const { base, rails, pieces } = shipLayout(id, parts, exploded);
  const guide = exploded ? `<path d="M0-13V-7M0 0V6M-8 0H-15M8 0H15M-4-3l-8-6M4-3l8-6M-4 6l-6 9M4 6l6 9" class="nf-mount-lines"/>` : "";
  const labels = exploded ? PART_IDS.map(part => {
    const [, , x, y] = EXPLODED[part];
    return `<text class="nf-mount-label" fill="${PARTS[part].ink}" x="${x}" y="${y}">${PARTS[part].label}</text>`;
  }).join("") : "";
  return `<svg class="${className}" viewBox="${exploded ? "-29 -27 58 53" : "-22 -18 44 37"}" shape-rendering="crispEdges" aria-hidden="true">${guide}
    <g>${svgPixels(rails)}</g><g${exploded ? ' opacity=".13"' : ""}>${svgPixels(base)}</g>
    ${pieces.map(({ part, blocks }) => `<g data-slot-art="${part}" class="${part === selected ? "nf-part-selected" : ""}">${svgPixels(blocks)}</g>`).join("")}
    ${labels}</svg>`;
}
