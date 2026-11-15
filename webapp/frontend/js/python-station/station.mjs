const TAU = 2 * Math.PI;
const palette = {
  hull: [59, 47, 80],
  deck: [44, 37, 61],
  armor: [89, 70, 117],
  steel: [119, 94, 156],
  black: [29, 23, 43],
  off: [105, 77, 146],
  violet: [168, 102, 245],
  hot: [226, 174, 255],
};

function stationMesh(progress) {
  const mesh = [];
  const lamp = level => progress >= level ? palette.hot : palette.off;
  const add = (points, color, lit = false) => mesh.push({ points, color, lit });
  function shell(outline, low, high, color, inset = 1, lit = false) {
    const length = outline.length;
    const [cx, cz] = outline.reduce(([x, z], point) => [x + point[0] / length, z + point[1] / length], [0, 0]);
    const bottom = outline.map(([x, z]) => [x, low, z]);
    const top = outline.map(([x, z]) => [cx + (x - cx) * inset, high, cz + (z - cz) * inset]);
    for (let i = 0; i < length; i++) {
      const next = (i + 1) % length;
      add([bottom[i], top[i], top[next], bottom[next]], color, lit);
    }
    add([...top].reverse(), color, lit);
  }
  const box = (x, y, z, w, h, d, color, lit) => shell(
    [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]],
    y - h / 2, y + h / 2, color, 1, lit);
  const drum = (x, z, radius, low, high, color, count = 8, inset = 1, lit = false) => shell(
    Array.from({ length: count }, (_, index) => {
      const angle = TAU * (index + .5) / count;
      return [x + Math.cos(angle) * radius, z + Math.sin(angle) * radius];
    }), low, high, color, inset, lit);

  drum(0, 0, 4.55, -.46, -.21, palette.black);
  drum(0, 0, 4.55, -.21, .05, palette.hull);
  drum(0, 0, 4.54, .05, .25, palette.armor, 8, .9);
  drum(0, 0, 4.08, .25, .30, palette.deck);
  drum(0, 0, 3.35, .30, .38, palette.hull);
  for (const x of [-3.13, 3.13]) {
    for (const z of [-1.42, 1.42]) {
      box(x, -.2, z, .58, .56, .65, palette.black);
      box(x, .2, z, .32, .11, .27, lamp(1), true);
    }
  }

  // Reactor stack and armored cooling ribs.
  drum(-.65, .05, 1.84, .38, .63, palette.armor);
  drum(-.65, .05, 1.63, .63, 1.20, palette.hull);
  drum(-.65, .05, 1.64, 1.20, 1.25, lamp(2), 8, 1, true);
  drum(-.65, .05, 1.62, 1.25, 1.53, palette.steel, 8, .83);
  drum(-.65, .05, 1.23, 1.53, 2.18, palette.black);
  drum(-.65, .05, 1.24, 2.18, 2.24, lamp(2), 8, 1, true);
  drum(-.65, .05, 1.25, 2.24, 2.50, palette.armor, 8, .83);
  drum(-.65, .05, .88, 2.50, 2.55, palette.black);
  drum(-.65, .05, .62, 2.55, 2.61, lamp(2), 12, 1, true);
  drum(-.65, .05, .43, 2.61, 2.65, palette.steel, 12);
  for (let i = 0; i < 8; i++) {
    const angle = TAU * i / 8;
    const x = -.65 + Math.cos(angle) * 1.19;
    const z = .05 + Math.sin(angle) * 1.19;
    box(x, 1.86, z, .17, .65, .17, palette.armor);
    box(x, 1.84, z, .08, .31, .19, lamp(2), true);
  }

  // Antenna mast on its own service pad.
  drum(1.95, -1.37, .91, .31, .56, palette.armor);
  drum(1.95, -1.37, .71, .56, .94, palette.deck);
  box(1.95, 1.78, -1.37, .18, 1.84, .18, palette.steel);
  box(1.95, 2.36, -1.37, .77, .11, .18, palette.armor);
  drum(1.95, -1.37, .31, 2.69, 2.84, palette.armor, 8, .48);
  drum(1.95, -1.37, .15, 2.84, 3.03, lamp(1), 8, .65, true);
  for (const x of [1.61, 2.29]) box(x, 2.5, -1.37, .09, .36, .11, lamp(1), true);

  // Corridor, gate, and runway lamps are readable even from the low angle.
  box(1.36, .42, 1.22, 3.58, .19, 1.38, palette.armor);
  box(1.58, .54, 1.22, 3.78, .06, 1.12, palette.black);
  for (const z of [.7, 1.74]) {
    box(2.04, .68, z, 3.4, .23, .12, palette.hull);
    for (let x = .58; x < 3.7; x += .48) box(x, .82, z, .28, .033, .075, lamp(3), true);
  }
  for (const z of [.74, 1.7]) {
    box(2.62, 1.08, z, .26, .94, .19, palette.armor);
    box(2.62, 1.09, z, .29, .62, .073, lamp(4), true);
  }
  box(2.62, 1.56, 1.22, .29, .16, 1.16, palette.steel);
  if (progress < 4) box(2.63, .99, 1.22, .11, .75, .76, palette.hull);
  for (const z of [.94, 1.5]) box(3.26, .59, z, .58, .035, .075, lamp(5), true);

  // Forward beacon and the returning two-track robot.
  drum(1.74, 2.7, .7, .31, .46, palette.armor);
  drum(1.74, 2.7, .46, .46, .82, palette.hull);
  drum(1.74, 2.7, .32, .82, 1.1, lamp(6), 10, .67, true);
  drum(1.74, 2.7, .18, 1.1, 1.26, palette.steel, 10, .6);
  const robotX = progress >= 6 ? 1.05 : progress >= 5 ? 3.18 : -.02;
  for (const offset of [-.23, .23]) box(robotX, .69, 1.22 + offset, .52, .21, .14, palette.steel);
  box(robotX, .83, 1.22, .43, .25, .41, palette.hull);
  box(robotX + .09, 1.02, 1.22, .25, .17, .34, palette.steel);
  box(robotX + .22, 1.03, 1.22, .03, .065, .25, lamp(1), true);

  // Crates, console and panel seams.
  for (const [x, z] of [[-2.48, 1.3], [-2.65, 1.9], [-2.55, -1.81], [.51, -2.47]]) {
    box(x, .56, z, .58, .44, .47, palette.hull);
    box(x, .80, z, .60, .07, .49, palette.armor);
    box(x, .85, z, .38, .028, .033, palette.steel);
  }
  box(-1.1, .55, 2.82, 1.08, .47, .61, palette.hull);
  box(-1.1, .83, 2.82, 1.03, .13, .52, palette.steel);
  for (let x = -1.48; x < -.78; x += .16) box(x, .91, 2.82, .08, .027, .24, lamp(3), true);
  return mesh;
}

const random = seed => {
  const value = Math.sin(seed * 127.1 + 19.3) * 43758.5453;
  return value - Math.floor(value);
};

export function paintStation(canvas, progress = 0, angle = -.60) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const scale = Math.min(width / 10.9, height / 6.85);
  const centerX = width * .5;
  const centerY = height * .61;
  const a = Math.cos(angle), b = Math.sin(angle);
  const project = ([x, y, z]) => {
    const depth = x * b + z * a;
    return [centerX + (x * a - z * b) * scale, centerY + (.53 * depth - .85 * y) * scale, .85 * depth + .53 * y];
  };
  function line(from, to) {
    const [x1, y1] = project(from), [x2, y2] = project(to);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.fillStyle = "#100d18";
  ctx.fillRect(0, 0, width, height);
  const light = ctx.createRadialGradient(centerX * .88, centerY * .76, 0, centerX, centerY * .75, width * .66);
  light.addColorStop(0, progress >= 2 ? "#362052" : "#251a38");
  light.addColorStop(1, "#100d18");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 78; i++) {
    const alpha = .08 + random(i * 5 + 2) * .45;
    ctx.fillStyle = "rgba(206,176,244," + alpha + ")";
    const size = Math.max(.8, scale * .024 * random(i * 3 + 17));
    ctx.fillRect(width * random(i * 2 + 31), height * random(i * 2 + 32), size, size);
  }
  ctx.strokeStyle = "#9364c426";
  ctx.lineWidth = Math.max(1, scale * .011);
  for (let i = -8; i <= 8; i++) {
    line([-9, -.65, i], [9, -.65, i]);
    line([i, -.65, -9], [i, -.65, 9]);
  }

  const faces = stationMesh(progress).map(face => {
    const points = face.points.map(project);
    const [p, q, r] = points;
    const area = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const depth = points.reduce((total, point) => total + point[2], 0) / points.length;
    return { ...face, points, depth, area };
  }).filter(face => face.area < -.01).sort((left, right) => left.depth - right.depth);

  for (const face of faces) {
    const [[x, y], ...rest] = face.points;
    const [p, q, r] = face.points;
    const facing = Math.abs((q[1] - p[1]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[1] - p[1]));
    const shade = face.lit ? 1 : .62 + .49 * Math.abs(face.area) / (Math.abs(face.area) + facing * scale + .001);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (const point of rest) ctx.lineTo(point[0], point[1]);
    ctx.closePath();
    ctx.fillStyle = "rgb(" + face.color.map(channel => Math.min(255, Math.round(channel * shade))).join(",") + ")";
    ctx.strokeStyle = face.lit ? ctx.fillStyle : "#100d1a99";
    ctx.shadowColor = face.lit && face.color === palette.hot ? "#b551ffbb" : "transparent";
    ctx.shadowBlur = face.lit ? scale * .11 : 0;
    ctx.fill();
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  if (progress === 6) {
    const [x, y] = project([1.74, 1.21, 2.7]);
    const end = y - scale * 1.55;
    const beam = ctx.createLinearGradient(x, end, x, y);
    beam.addColorStop(0, "#b779f300");
    beam.addColorStop(1, "#dda5ffad");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - scale * .27, y);
    ctx.lineTo(x - scale * .44, end);
    ctx.lineTo(x + scale * .44, end);
    ctx.lineTo(x + scale * .27, y);
    ctx.fill();
  }
}

export function stationView(canvas) {
  let progress = 0, angle = -.60, target = angle, frame = 0, visible = false;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  function draw() {
    if (!visible) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(2, devicePixelRatio || 1);
    const width = Math.round(bounds.width * ratio), height = Math.round(bounds.height * ratio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    paintStation(canvas, progress, angle);
  }
  function animate() {
    frame = 0;
    if (!visible) return;
    const distance = target - angle;
    const done = motion.matches || Math.abs(distance) < .006;
    if (done) {
      angle = target % TAU;
      target = angle;
    } else angle += distance * .23;
    draw();
    if (!done) frame = requestAnimationFrame(animate);
  }
  new ResizeObserver(draw).observe(canvas);
  return {
    setProgress(value) { progress = value; draw(); },
    show(value) { visible = value; if (value) draw(); else if (frame) { cancelAnimationFrame(frame); frame = 0; angle = target; } },
    rotate() { target -= Math.PI / 4; if (!frame) animate(); },
  };
}
