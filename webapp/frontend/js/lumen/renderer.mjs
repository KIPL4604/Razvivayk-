import { hero as legacyHero, enemySprite } from './legacy-art.mjs';

const TAU = Math.PI * 2;
const round = Math.round;
const hash = (x, y) => ((Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Presentation only. Simulation coordinates, collisions and save records are untouched. */
export class Renderer {
  constructor(canvas, art) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx || !art) throw new Error('Lumen artwork not ready');
    this.art = art;
    this.width = 0; this.height = 0;
    this.views = new Map(); this.ghosts = [];
    this.lastTime = -1; this.lastBolt = 0; this.attackUntil = 0;
    this.media = matchMedia('(prefers-reduced-motion: reduce)');
    this.legacy = Object.fromEntries(['beetle', 'wasp', 'guardian'].map(kind => [kind, enemySprite(kind)]));
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    this.width = box.width; this.height = box.height;
    // Every rendered pixel occupies about two CSS pixels at every DPR. Preserve
    // the old world/camera scale, so screen size never alters gameplay distances.
    const width = Math.ceil(box.width / 2), height = Math.ceil(box.height / 2);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    this.scale = Math.max(.72, Math.min(1.25, Math.min(box.width / 650, box.height / 650)));
    this.zoom = this.scale / 2;
    this.ctx.imageSmoothingEnabled = false;
  }

  at(x, y) { return [round(this.cx + x * this.zoom), round(this.cy + y * this.zoom)]; }

  blit(key, sx, sy, sw, sh, x, y, worldWidth, worldHeight = worldWidth, anchor = .94, flip = false) {
    const image = this.art.images[key];
    const [px, py] = this.at(x, y);
    const width = Math.max(1, round(worldWidth * this.zoom)), height = Math.max(1, round(worldHeight * this.zoom));
    const left = px - Math.floor(width / 2), top = py - Math.round(height * anchor);
    if (flip) {
      this.ctx.save(); this.ctx.translate(left + width, top); this.ctx.scale(-1, 1);
      this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height); this.ctx.restore();
    } else this.ctx.drawImage(image, sx, sy, sw, sh, left, top, width, height);
  }

  actor(key, animation, x, y, size, time, since = 0, flip = false) {
    const data = this.art.manifest.animations[animation];
    const elapsed = Math.max(0, time - since);
    const frame = this.media.matches && animation === 'idle' ? 0
      : data.loop ? Math.floor(elapsed * data.fps) % data.frames
        : Math.min(data.frames - 1, Math.floor(elapsed * data.fps));
    this.blit('fx', 0, 0, 16, 16, x, y + 7, size * .58, size * .28, .75);
    this.blit(key, frame * 48, data.row * 48, 48, 48, x, y + 7, size, size, 45 / 48, flip);
  }

  view(state) {
    const t = state.time;
    // A fresh renderer (including resume) never replays stale events.
    if (this.lastTime < 0 || t < this.lastTime) {
      this.views.clear(); this.ghosts = []; this.attackUntil = 0;
      this.lastBolt = state.boltTimer;
    }
    if (t === this.lastTime) return;
    if (state.boltTimer > this.lastBolt + .08) this.attackUntil = t + .375;
    this.lastBolt = state.boltTimer;
    const next = new Map();
    for (const enemy of state.enemies || []) {
      if (enemy.kind !== 'mote') continue;
      const old = this.views.get(enemy.id);
      const near = distance(enemy, state.player) < enemy.radius + state.player.radius + 10;
      const hurtUntil = enemy.hitFlash > (old?.flash || 0) ? t + .375 : old?.hurtUntil || 0;
      const animation = hurtUntil > t ? 'hurt' : near ? 'attack'
        : old && distance(enemy, old) < .02 ? 'idle' : 'walk';
      const since = animation === old?.animation && !(animation === 'attack' && t - old.since >= .8) ? old.since : t;
      next.set(enemy.id, { ...enemy, animation, since, hurtUntil, flash: enemy.hitFlash,
        flip: enemy.x > state.player.x });
    }
    for (const [id, old] of this.views) {
      if (next.has(id)) continue;
      // Far-away despawns are not deaths. Match the simulation's dissolve event.
      if ((state.effects || []).some(e => e.kind === 'dissolve' && distance(e, old) < 45)) {
        this.ghosts.push({ ...old, since: t });
      }
    }
    this.ghosts = this.ghosts.filter(e => t - e.since < .6).slice(-30);
    this.views = next; this.lastTime = t;
  }

  ground(player) {
    const c = this.ctx, z = this.zoom;
    const left = player.x - this.width / this.scale / 2 - 128;
    const top = player.y - this.height / this.scale / 2 - 128;
    const right = left + this.width / this.scale + 256, bottom = top + this.height / this.scale + 256;
    for (let y = Math.floor(top / 64); y <= Math.ceil(bottom / 64); y++) {
      for (let x = Math.floor(left / 64); x <= Math.ceil(right / 64); x++) {
        const n = hash(x, y), variant = n % 11 < 7 ? 0 : n % 4;
        const [px, py] = this.at(x * 64, y * 64);
        const [ex, ey] = this.at((x + 1) * 64, (y + 1) * 64);
        c.drawImage(this.art.images.tiles, variant * 32, 0, 32, 32, px, py, ex - px, ey - py);
      }
    }
    const props = [];
    // Deterministic garden islands. Pure scenery; never new collision walls.
    for (let y = Math.floor(top / 280); y <= Math.ceil(bottom / 280); y++) {
      for (let x = Math.floor(left / 300); x <= Math.ceil(right / 300); x++) {
        const n = hash(x + 53, y - 41);
        const px = x * 300 + 100 + n % 90, py = y * 280 + 90 + (n >>> 8) % 60;
        if (Math.hypot(px, py) < 175) continue;
        props.push({ kind: 'prop', index: n % 3 + 1, x: px, y: py, size: n % 3 === 2 ? 150 : 126 });
        if (n % 3 !== 0) props.push({ kind: 'prop', index: 1, x: px - 66, y: py + 34, size: 88 });
      }
    }
    // Texture marks gently frame the beacon without introducing obstacles.
    c.fillStyle = '#111b2524';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    return props;
  }

  ring(x, y, radius, warning = false, alpha = 1) {
    const count = Math.max(20, Math.min(80, Math.round(radius / 3)));
    this.ctx.save(); this.ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const angle = i / count * TAU;
      this.blit('ui', (warning ? 13 : 14) * 16, 0, 16, 16,
        x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 12, 12, .5);
    }
    this.ctx.restore();
  }

  draw(state, preview = false, terminalElapsed) {
    if (!this.width || !this.height) return;
    const c = this.ctx, p = state.player, t = state.time || 0, z = this.zoom;
    if (terminalElapsed !== undefined) this.terminalElapsed = terminalElapsed;
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
    c.globalAlpha = 1; c.fillStyle = '#17262e'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.cx = round(this.canvas.width / 2 - p.x * z);
    this.cy = round(this.canvas.height * .49 - p.y * z);
    this.view(state);
    const props = this.ground(p);
    for (const gem of state.gems || []) {
      this.blit('fx', 16, 0, 16, 16, gem.x, gem.y, gem.value >= 5 ? 23 : 17, undefined, .5);
    }
    if (state.upgrades?.orbit) {
      const count = 1 + state.upgrades.orbit, radius = 76 + state.upgrades.orbit * 6;
      for (let i = 0; i < count; i++) {
        const angle = state.orbitAngle + i / count * TAU;
        this.blit('ui', 16, 0, 16, 16, p.x + Math.cos(angle) * radius,
          p.y + Math.sin(angle) * radius, 32, 32, .5);
      }
    }
    const entities = [...props, { kind: 'prop', index: 0, x: 0, y: 0, size: 178 },
      ...(state.enemies || []), ...this.ghosts.map(e => ({ ...e, kind: 'dead' })), { ...p, kind: 'hero' }]
      .sort((a, b) => a.y - b.y);
    for (const entity of entities) {
      if (Math.abs(entity.x - p.x) > this.width / this.scale * .6 + 180
        || Math.abs(entity.y - p.y) > this.height / this.scale * .6 + 180) continue;
      if (entity.kind === 'prop') {
        c.globalAlpha = entity.index && entity.y > p.y - 15 && distance(entity, p) < 85 ? .4 : 1;
        this.blit('garden', entity.index * 64, 0, 64, 64, entity.x, entity.y, entity.size);
        c.globalAlpha = 1;
      } else if (entity.kind === 'hero') {
        if (state.character === 'keeper') {
          c.save(); const [x, y] = this.at(p.x, p.y); c.translate(x, y); c.scale(z, z);
          legacyHero(c, 0, 0, this.media.matches ? 0 : t, 'keeper', p.invulnerable, state.moving); c.restore();
        } else {
          const animation = state.status === 'lost' ? 'death' : p.invulnerable > .42 ? 'hurt'
            : this.attackUntil > t ? 'attack' : state.moving ? 'walk' : 'idle';
          const since = animation === 'death' ? t - (this.terminalElapsed ?? .6) : animation === 'hurt' ? t - (.8 - p.invulnerable)
            : animation === 'attack' ? this.attackUntil - .375 : 0;
          this.actor('scout', animation, p.x, p.y, 96, t, since, p.facingX < -.1);
        }
      } else if (entity.kind === 'mote' || entity.kind === 'dead') {
        const view = entity.kind === 'dead' ? entity : this.views.get(entity.id) || entity;
        this.actor('mote', entity.kind === 'dead' ? 'death' : view.animation || 'walk',
          entity.x, entity.y, 80, t, view.since || 0, view.flip);
      } else {
        const image = this.legacy[entity.kind], size = entity.kind === 'guardian' ? entity.radius * 3.4 : entity.radius * 4.6;
        const [x, y] = this.at(entity.x, entity.y);
        c.drawImage(image, x - round(size * z / 2), y - round(size * z / 2), round(size * z), round(size * z));
      }
      if (!['hero', 'prop', 'dead'].includes(entity.kind) && (entity.kind === 'guardian' || entity.hp < entity.maxHp)) {
        const [x, y] = this.at(entity.x, entity.y - entity.radius - 23);
        const width = round(entity.radius * 2 * z);
        c.fillStyle = '#111b25'; c.fillRect(x - round(width / 2) - 1, y, width + 2, 3);
        c.fillStyle = entity.kind === 'guardian' ? '#e39b5d' : '#83cda4';
        c.fillRect(x - round(width / 2), y + 1, Math.max(0, round(width * entity.hp / entity.maxHp)), 1);
      }
    }
    for (const shot of state.projectiles || []) {
      const [x, y] = this.at(shot.x, shot.y);
      c.save(); c.translate(x, y);
      c.rotate(Math.round(Math.atan2(shot.vy, shot.vx) / (TAU / 8)) * TAU / 8);
      c.drawImage(this.art.images.fx, shot.hostile ? 16 : 48, 0, 16, 16, -7, -5, 14, 10); c.restore();
    }
    for (const effect of state.effects || []) {
      const fraction = effect.life / (effect.maxLife || .5);
      if (effect.kind === 'pulse' || effect.kind === 'warning') {
        this.ring(effect.x, effect.y, effect.radius, effect.kind === 'warning', Math.min(.75, fraction));
      } else if (!this.media.matches) {
        c.save(); c.globalAlpha = Math.min(.8, fraction);
        this.blit('fx', 32, 0, 16, 16, effect.x, effect.y, 45 * (1.4 - fraction), undefined, .5); c.restore();
      }
    }
    if (!this.media.matches) {
      for (let i = 0; i < 12; i++) {
        const x = p.x - this.width / this.scale / 2 + (i * 179 + t * 3) % (this.width / this.scale);
        const y = p.y - this.height / this.scale / 2 + (i * 127 + Math.sin(t + i) * 5) % (this.height / this.scale);
        c.save(); c.globalAlpha = .35;
        this.blit('ui', 15 * 16, 0, 16, 16, x, y, 12, 12, .5); c.restore();
      }
    }
    // Discrete edge shade keeps pixel clusters intact; no blur/filters over art.
    c.fillStyle = '#111b2533';
    c.fillRect(0, 0, this.canvas.width, 4); c.fillRect(0, this.canvas.height - 4, this.canvas.width, 4);
    if (preview) { c.fillStyle = '#111b2540'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); }
  }

  destroy() {
    this.canvas.width = 1; this.canvas.height = 1;
    this.views.clear(); this.ghosts = []; this.legacy = {}; this.art = null;
  }
}
