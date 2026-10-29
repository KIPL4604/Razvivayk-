// Presentation history only. No simulation RNG, entity writes or save fields.
const TAU = Math.PI * 2;
const clamp = n => Math.max(0, Math.min(1, n));
const noise = n => ((Math.imul(n | 0, 1597334677) ^ 3812015801) >>> 0) / 4294967296;
const palette = {
  spark: '#ffe2a1', flame: '#ffb46c', ice: '#b7f1f3', prism: '#b6fff0',
  needle: '#ede7cd', fan: '#efc39b', drone: '#d1ffc0', spear: '#b7e5f5',
  cleaver: '#f2c3a1', chakram: '#9af9df', sunrise: '#ffe7a7',
};
const rowFor = weapon => ['ice', 'frostnova', 'prism'].includes(weapon) ? 1
  : ['flame', 'meteor', 'sunrise'].includes(weapon) ? 0
    : ['spark', 'storm', 'cyclone', 'drone', 'sunlance'].includes(weapon) ? 2
      : ['gravity', 'eclipse'].includes(weapon) ? 4 : 3;

/** Fit the entire dangerous perimeter without changing any world coordinates. */
export function arenaCamera(width, height, baseScale, player, arena, insets) {
  if(arena&&insets){
    const top=insets.top??220,bottom=insets.bottom??height-140,available=Math.max(80,bottom-top);
    const upper=Math.max(arena.radius+32,(insets.bossHeight||252)*.96+16),lower=arena.radius+32;
    const scale=Math.min(baseScale,width/(arena.radius*2+160),available/(upper+lower));
    return {x:arena.x,y:arena.y,scale,screenY:top+upper*scale+(available-(upper+lower)*scale)/2};
  }
  const radius = arena?.radius || 330;
  const scale = Math.min(baseScale, width / (radius * 2 + 160), Math.max(140, height - 320) / (radius * 2 + 140));
  return arena ? { x: arena.x, y: arena.y, scale } : { x: player.x, y: player.y, scale: baseScale };
}

export class WeaponVFX {
  constructor() { this.reset(); }

  reset() {
    this.runId = null; this.time = -1; this.shots = new Map();
    this.bursts = []; this.lights = 0; this.trails = 0;
  }

  observe(state) {
    const time = state.time || 0;
    const fresh = this.runId !== state.runId || this.time < 0 || time < this.time;
    if (fresh) { this.shots.clear(); this.bursts = []; }
    if (time === this.time && this.runId === state.runId) return;
    const next = new Map();
    for (const shot of (state.projectiles || []).slice(-160)) {
      const old = this.shots.get(shot.id);
      const points = old ? old.points.filter(p => time - p.time < .13) : [];
      if (!points.length || Math.hypot(shot.x - points.at(-1).x, shot.y - points.at(-1).y) > 3) {
        points.push({ x: shot.x, y: shot.y, time });
      }
      next.set(shot.id, { points: points.slice(-7), weapon: shot.weapon, hostile: shot.hostile });
      if (!old && !fresh && !shot.hostile) this.bursts.push({
        x: shot.x, y: shot.y, angle: Math.atan2(shot.vy, shot.vx), weapon: shot.weapon,
        since: time, life: .12, seed: shot.id,
      });
    }
    this.shots = next;
    this.bursts = this.bursts.filter(e => time - e.since < e.life).slice(-28);
    this.time = time; this.runId = state.runId;
  }

  beginFrame() { this.lights = 0; this.trails = 0; }

  glow(r, x, y, radius, color, alpha = .2) {
    if (this.lights++ >= 12 || r.media.matches || alpha <= 0) return;
    const c = r.ctx, [px, py] = r.at(x, y), size = radius * r.zoom;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha;
    const light = c.createRadialGradient(px, py, 0, px, py, Math.max(1, size));
    light.addColorStop(0, color); light.addColorStop(1, '#000000');
    c.fillStyle = light; c.fillRect(px - size, py - size, size * 2, size * 2); c.restore();
  }

  atlas(r, row, age, life, x, y, size, alpha = 1, angle = 0) {
    const image = r.art.images['arena-fx'];
    if (!image) return;
    const frame = Math.min(5, Math.floor(clamp(age / life) * 6));
    const c = r.ctx, [px, py] = r.at(x, y), width = Math.round(size * r.zoom);
    c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.translate(px, py); c.rotate(angle);
    c.drawImage(image, frame * 64, row * 64, 64, 64, -width / 2, -width / 2, width, width); c.restore();
  }

  trail(r, shot, point, time) {
    const c = r.ctx, history = this.shots.get(shot.id);
    if (r.media.matches || !history || shot.hostile) return;
    const points = history.points;
    if (points.length < 2) return;
    if (this.trails++ >= 24) return;
    const blade = ['cleaver', 'chakram', 'sunrise'].includes(shot.weapon);
    const color = palette[shot.weapon] || '#b2def5';
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = i === points.length - 1 ? point : points[i];
      const [x, y] = r.at(a.x, a.y), [tx, ty] = r.at(b.x, b.y);
      c.globalAlpha = .1 + .35 * i / points.length;
      c.strokeStyle = color; c.lineWidth = Math.max(r.dpr, (blade ? 10 : shot.weapon === 'flame' ? 7 : 3) * r.zoom * i / points.length);
      c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke();
    }
    c.restore();
    if (shot.weapon === 'flame') {
      for (let i = 0; i < Math.min(3, points.length); i++) {
        const p = points[Math.max(0, points.length - 2 - i)], age = time - p.time;
        this.atlas(r, 0, .1 + age * 2, .5, p.x, p.y - age * 26, 35 + age * 45, .45 - i * .1);
      }
      this.glow(r, point.x, point.y, 32, '#f77937', .22);
    } else if (['spark', 'prism', 'drone'].includes(shot.weapon)) this.glow(r, point.x, point.y, 23, color, .16);
  }

  muzzles(r, time) {
    if (r.media.matches) return;
    const c = r.ctx;
    for (const e of this.bursts) {
      const age = time - e.since, life = 1 - clamp(age / e.life);
      this.atlas(r, rowFor(e.weapon), age, e.life, e.x + Math.cos(e.angle) * 17, e.y + Math.sin(e.angle) * 17, 43 * life + 12, .7 * life, e.angle);
      const [x, y] = r.at(e.x, e.y);
      c.save(); c.translate(x, y); c.rotate(e.angle); c.globalCompositeOperation = 'lighter'; c.globalAlpha = life * .8;
      c.fillStyle = palette[e.weapon] || '#f4dfb2';
      c.beginPath(); c.moveTo(7 * r.zoom, 0); c.lineTo(28 * r.zoom * life, -4 * r.zoom); c.lineTo(40 * r.zoom * life, 0); c.lineTo(28 * r.zoom * life, 4 * r.zoom); c.closePath(); c.fill(); c.restore();
    }
  }

  zone(r, zone, time) {
    if (!['flame', 'briar', 'meteor', 'gravity'].includes(zone.kind)) return false;
    const age = Math.max(0, (zone.maxLife || 1) - zone.life), fraction = clamp(zone.life / .4);
    if (zone.kind === 'meteor') {
      const c = r.ctx, [x, y] = r.at(zone.x, zone.y), progress = clamp(age / (zone.maxLife || .65));
      c.save(); c.globalAlpha = .45 + progress * .35; c.strokeStyle = '#efb184';
      c.lineWidth = Math.max(r.dpr, 2 * r.zoom); c.setLineDash([8 * r.zoom, 6 * r.zoom]);
      c.beginPath(); c.ellipse(x, y, zone.radius * r.zoom, zone.radius * .76 * r.zoom, 0, 0, TAU); c.stroke();
      c.setLineDash([]); c.globalAlpha = .12; c.fillStyle = '#d58653'; c.fill(); c.restore();
      const fall = r.media.matches ? 22 : (1 - progress) ** 1.5 * 190;
      this.atlas(r, 0, progress * .38, .55, zone.x - fall * .26, zone.y - fall, 82, .95, .25);
      if (progress > .7) this.glow(r, zone.x, zone.y, 70, '#ffb566', (progress - .7) * .5);
    } else if (zone.kind === 'gravity') {
      const c = r.ctx, [x, y] = r.at(zone.x, zone.y);
      c.save(); c.fillStyle = '#19182c'; c.globalAlpha = .45 * fraction;
      c.beginPath(); c.ellipse(x, y, zone.radius * r.zoom, zone.radius * .67 * r.zoom, 0, 0, TAU); c.fill(); c.restore();
      this.atlas(r, 4, r.media.matches ? .2 : age % .72, .72, zone.x, zone.y, zone.radius * 2.2, .62 * fraction);
      if (!r.media.matches) for (let n = 0; n < 5; n++) {
        const a = n / 5 * TAU - age * 2, radius = zone.radius * (1 - (age * .7 + n * .2) % 1);
        this.atlas(r, 4, .1, .4, zone.x + Math.cos(a) * radius, zone.y + Math.sin(a) * radius * .67, 20, .65 * fraction);
      }
    } else {
      const count = r.media.matches ? 2 : 4;
      for (let n = 0; n < count; n++) {
        const a = n / count * TAU, radius = zone.radius * .47, drift = r.media.matches ? 0 : age * .75 + n * .21;
        this.atlas(r, 0, drift % .65, .65, zone.x + Math.cos(a) * radius, zone.y + Math.sin(a) * radius * .65 - 10,
          zone.radius * 1.35, .72 * fraction);
      }
      this.glow(r, zone.x, zone.y, zone.radius * 1.2, '#a94824', .13 * fraction);
      if (zone.kind === 'briar') {
        const frame = r.media.matches ? 0 : Math.floor(time * 8) % 4;
        r.blit('arsenal', (frame + 4) * 48, 96, 48, 48, zone.x, zone.y, zone.radius * 2, zone.radius * 1.5, .5);
      }
    }
    return true;
  }

  lightning(r, effect, age, fraction) {
    const c = r.ctx, dx = effect.toX - effect.x, dy = effect.toY - effect.y;
    const length = Math.hypot(dx, dy), nx = -dy / (length || 1), ny = dx / (length || 1);
    const count = Math.max(3, Math.min(14, Math.ceil(length / 28)));
    const points = [];
    for (let n = 0; n <= count; n++) {
      const offset = n && n < count ? (noise(n * 31 + Math.floor(effect.x + effect.y)) - .5) * 26 : 0;
      points.push(r.at(effect.x + dx * n / count + nx * offset, effect.y + dy * n / count + ny * offset));
    }
    c.save(); c.globalAlpha = Math.min(1, fraction * 2); c.lineJoin = 'bevel';
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = '#9ca9e7'; c.lineWidth = Math.max(3 * r.dpr, 7 * r.zoom); c.globalAlpha *= .36; c.stroke();
    c.strokeStyle = '#fff3b2'; c.lineWidth = Math.max(r.dpr, 2 * r.zoom); c.globalAlpha = Math.min(.95, fraction * 2); c.stroke();
    if (!r.media.matches) for (let n = 2; n < count; n += 3) {
      const [x, y] = points[n]; c.globalAlpha = fraction * .6; c.lineWidth = r.dpr; c.beginPath(); c.moveTo(x, y);
      c.lineTo(x + nx * (12 + n * 2) * r.zoom, y + ny * (12 + n * 2) * r.zoom - 6 * r.zoom); c.stroke();
    }
    c.restore();
    this.atlas(r, 2, age, effect.maxLife || .2, effect.toX, effect.toY, 65, Math.min(1, fraction * 2));
    this.glow(r, effect.toX, effect.toY, 42, '#d8cfa2', fraction * .19);
  }

  effect(r, effect) {
    const life = effect.maxLife || .5, fraction = clamp(effect.life / life), age = life - effect.life;
    const weapon = effect.weapon || (effect.kind === 'arc' ? 'storm' : effect.kind === 'pulse' ? 'pulse' : 'spark');
    if (effect.kind === 'impact') {
      const row = rowFor(weapon), size = ['meteor', 'flame'].includes(weapon) ? 86 : row === 1 ? 65 : 48;
      this.atlas(r, row, age, life, effect.x, effect.y - 8, size, Math.min(.85, fraction * 2));
      this.glow(r, effect.x, effect.y, size * .55, palette[weapon] || '#e7dba0', fraction * .15);
      if (!r.media.matches && row === 1) this.fragments(r, effect, age, fraction, '#b7eff5', 6, 55);
      return true;
    }
    if (effect.kind === 'arc') {
      if (weapon !== 'sunlance') this.lightning(r, effect, age, fraction);
      else {
        const c = r.ctx, [x, y] = r.at(effect.x, effect.y), [tx, ty] = r.at(effect.toX, effect.toY);
        c.save(); c.globalAlpha = Math.min(.8, fraction * 1.4); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty);
        c.strokeStyle = '#d69d4d'; c.lineWidth = Math.max(5 * r.dpr, effect.radius * r.zoom * 1.4); c.stroke();
        c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ffeab0'; c.lineWidth = Math.max(2 * r.dpr, effect.radius * r.zoom * .45); c.stroke();
        c.strokeStyle = '#fff8de'; c.lineWidth = r.dpr; c.stroke(); c.restore();
        this.atlas(r, 2, age, life, effect.x, effect.y, 96, fraction);
      }
      return true;
    }
    if (!['pulse', 'fusion'].includes(effect.kind)) return false;
    const c = r.ctx, [x, y] = r.at(effect.x, effect.y);
    const progress = r.media.matches ? .8 : 1 - fraction ** 2;
    const radius = effect.radius * (.22 + .78 * progress), cold = weapon === 'frostnova', dark = ['gravity', 'eclipse'].includes(weapon);
    const color = cold ? '#b7eff5' : dark ? '#cbb0ee' : weapon === 'bell' ? '#b1d8e5' : '#f0ca8a';
    if (effect.kind === 'fusion' && ['meteor', 'mine'].includes(weapon)) {
      this.atlas(r, weapon === 'meteor' ? 0 : 2, age, life, effect.x, effect.y - 8, effect.radius * 1.65, Math.min(1, fraction * 2));
      this.atlas(r, 3, age, life, effect.x, effect.y + 4, effect.radius * 2.5, .6 * Math.min(1, fraction * 2));
      if (!r.media.matches) this.fragments(r, effect, age, fraction, '#deb58f', 9, effect.radius * .9);
      this.glow(r, effect.x, effect.y, effect.radius, '#ea9149', fraction * .22);
    } else if (cold) {
      this.atlas(r, 1, age, life, effect.x, effect.y, effect.radius * 1.8, Math.min(.75, fraction * 1.3));
      if (!r.media.matches) this.fragments(r, effect, age, fraction, color, 12, effect.radius * .8);
    } else if (dark) this.atlas(r, 4, age, life, effect.x, effect.y, radius * 2, .75 * fraction);
    else this.atlas(r, 3, age, life, effect.x, effect.y, radius * 2.1, .35 * fraction);
    c.save(); c.strokeStyle = color; c.globalAlpha = .66 * fraction;
    c.lineWidth = Math.max(r.dpr, (weapon === 'bell' ? 5 : 3) * r.zoom * fraction);
    c.beginPath(); c.ellipse(x, y, radius * r.zoom, radius * .8 * r.zoom, 0, 0, TAU); c.stroke();
    if (weapon === 'bell' && !r.media.matches) {
      c.globalAlpha *= .5; c.beginPath(); c.ellipse(x, y, radius * .8 * r.zoom, radius * .64 * r.zoom, 0, 0, TAU); c.stroke();
    }
    c.restore(); return true;
  }

  fragments(r, effect, age, fraction, color, count, speed) {
    const c = r.ctx;
    c.save(); c.fillStyle = color; c.globalAlpha = .75 * fraction;
    for (let n = 0; n < count; n++) {
      const a = n / count * TAU + noise(n * 19) * .35, radius = speed * age * (1 + noise(n * 11));
      const [x, y] = r.at(effect.x + Math.cos(a) * radius, effect.y + Math.sin(a) * radius * .65 - Math.sin(clamp(age * 2) * Math.PI) * 25);
      c.save(); c.translate(x, y); c.rotate(a); c.fillRect(-r.zoom * 2, -r.zoom * 5, r.zoom * 4, r.zoom * 10); c.restore();
    }
    c.restore();
  }
}
