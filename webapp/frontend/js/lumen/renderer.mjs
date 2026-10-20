import { FIXED_STEP, cameraScale, sceneryOpacity, lerp, crystalTier, HealthFeedback } from './presentation.mjs';
import {WEAPONS,weaponStats,BOSSES,MAPS} from './catalog.mjs';
import {bodyRadius,PLAYER_BODY} from './physics.mjs';

const TAU = Math.PI * 2;
const round = Math.round;
const hash = (x, y) => ((Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const spriteKey=e=>e.kind==='guardian'?BOSSES[e.guardianStage||1].sprite:e.kind;
const actorSize=e=>e.kind==='guardian'?220:e.elite?128:({beetle:90,wasp:76,crawler:92,spitter:90,wisp:76,quartzling:86,shardback:110,moonmoth:86}[e.kind]||80);

/** Presentation only. Simulation coordinates, collisions and save records are untouched. */
export class Renderer {
  constructor(canvas, art) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx || !art) throw new Error('Lumen artwork not ready');
    this.art = art;
    this.width = 0; this.height = 0;
    this.views = new Map(); this.ghosts = [];
    this.lastTime = -1; this.lastAttack = 0; this.attackUntil = 0; this.lastContact = 0;
    this.health = new HealthFeedback(); this.hitSheets = new Map();
    this.media = matchMedia('(prefers-reduced-motion: reduce)');
    this.previous = { player: null, enemies: new Map(), shots: new Map(), gems: new WeakMap() };
    this.captureTick = this.captureTick.bind(this);
    this.floorPatterns={};
    for(const [id,map] of Object.entries(MAPS)){
      const floor = document.createElement('canvas');floor.width=256;floor.height=256;
      const floorContext=floor.getContext('2d');floorContext.imageSmoothingEnabled=false;
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const n=hash(x,y),variant=n%11<7?0:n%4;
        floorContext.drawImage(art.images[map.tiles],variant*32,0,32,32,x*32,y*32,32,32);
      }
      this.floorPatterns[id]=this.ctx.createPattern(floor,'repeat');
    }
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    this.width = box.width; this.height = box.height;
    // Native device pixels prevent the old 2-CSS-pixel camera staircase. Artwork
    // itself is still sampled nearest-neighbor with a stable destination size.
    this.dpr=Math.min(3,Math.max(1,devicePixelRatio||1));
    const width = Math.round(box.width*this.dpr), height = Math.round(box.height*this.dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    this.scale = cameraScale(box.width,box.height);
    this.zoom = this.scale*this.dpr;
    this.ctx.imageSmoothingEnabled = false;
  }

  at(x, y) { return [round(this.cx + x * this.zoom), round(this.cy + y * this.zoom)]; }

  captureTick(state) {
    this.health.update(state);
    this.previous.time=state.time;
    this.previous.player={x:state.player.x,y:state.player.y};
    for(const [key,entities] of [['enemies',state.enemies],['shots',state.projectiles]]){
      const map=this.previous[key];map.clear();
      for(const e of entities)map.set(e.id,{x:e.x,y:e.y});
    }
    for(const gem of state.gems)this.previous.gems.set(gem,{x:gem.x,y:gem.y});
  }

  pose(entity, group='player') {
    const old=group==='player'?this.previous.player:group==='gems'?this.previous.gems.get(entity):this.previous[group].get(entity.id);
    return old&&this.alpha<1?{x:lerp(old.x,entity.x,this.alpha),y:lerp(old.y,entity.y,this.alpha)}:entity;
  }

  blit(key, sx, sy, sw, sh, x, y, worldWidth, worldHeight = worldWidth, anchor = .94, flip = false, image = this.art.images[key]) {
    const [px, py] = this.at(x, y);
    const width = Math.max(1, round(worldWidth * this.zoom)), height = Math.max(1, round(worldHeight * this.zoom));
    const left = px - Math.floor(width / 2), top = py - Math.round(height * anchor);
    if (flip) {
      this.ctx.save(); this.ctx.translate(left + width, top); this.ctx.scale(-1, 1);
      this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height); this.ctx.restore();
    } else this.ctx.drawImage(image, sx, sy, sw, sh, left, top, width, height);
  }

  hitSheet(key, color) {
    const id=key+color;
    if(!this.hitSheets.has(id)){
      const image=this.art.images[key],sheet=document.createElement('canvas');
      sheet.width=image.width;sheet.height=image.height;
      const c=sheet.getContext('2d');c.drawImage(image,0,0);
      c.globalCompositeOperation='source-in';c.fillStyle=color;
      c.fillRect(0,0,sheet.width,sheet.height);
      this.hitSheets.set(id,sheet);
    }
    return this.hitSheets.get(id);
  }

  actor(key, animation, x, y, size, time, since = 0, flip = false, tint) {
    const data = this.art.manifest.animations[animation];
    const actor=this.art.manifest.actors[key],frameSize=actor?.frameSize||48,anchor=(actor?.anchor?.[1]||45)/frameSize;
    const elapsed = Math.max(0, time - since);
    const frame = this.media.matches && animation === 'idle' ? 0
      : data.loop ? Math.floor(elapsed * data.fps) % data.frames
        : Math.min(data.frames - 1, Math.floor(elapsed * data.fps));
    if(!tint)this.blit('fx', 0, 0, 16, 16, x, y + 7, size * .58, size * .28, .75);
    this.blit(key, frame * frameSize, data.row * frameSize, frameSize, frameSize, x, y + 7, size, size, anchor, flip,
      tint?this.hitSheet(key,tint):this.art.images[key]);
  }

  heroHealth(player, cue) {
    const c=this.ctx,d=this.dpr;
    // CSS-sized minimum keeps the bar readable with the wider mobile camera.
    const width=round(Math.max(48,58*this.scale)*d),height=round(8*d),edge=round(d);
    const [x,y]=this.at(player.x,player.y-90);
    const left=x-Math.floor(width/2),top=y-height;
    c.fillStyle='#101820';c.fillRect(left-edge,top-edge,width+2*edge,height+2*edge);
    c.fillStyle=cue.ratio<=.3?'#f3b09e':'#b9cbbb';c.fillRect(left,top,width,height);
    c.fillStyle='#233039';c.fillRect(left+edge,top+edge,width-2*edge,height-2*edge);
    const inner=width-4*edge,fill=ratio=>Math.max(0,round(inner*ratio));
    c.fillStyle='#a35e4d';c.fillRect(left+2*edge,top+2*edge,fill(cue.trail),height-4*edge);
    c.fillStyle=cue.ratio<=.3?'#f17478':cue.ratio<=.55?'#ebbe69':'#85dfb4';
    c.fillRect(left+2*edge,top+2*edge,fill(cue.ratio),height-4*edge);
  }

  view(state) {
    const t = state.time;
    // A fresh renderer (including resume) never replays stale events.
    if (this.lastTime < 0 || t < this.lastTime) {
      this.views.clear(); this.ghosts = []; this.attackUntil = 0;
      this.lastAttack = state.attackSerial||0;
      this.lastContact = state.contactTimer||0;
    }
    if (t === this.lastTime) return;
    if ((state.attackSerial||0)>this.lastAttack) this.attackUntil = t + .375;
    this.lastAttack = state.attackSerial||0;
    const biting=(state.contactTimer||0)>this.lastContact;
    this.lastContact=state.contactTimer||0;
    const next = new Map();
    for (const enemy of state.enemies || []) {
      const old = this.views.get(enemy.id);
      const near = distance(enemy, state.player) <= bodyRadius(enemy) + PLAYER_BODY + 2;
      const hurtUntil = enemy.hitFlash > (old?.flash || 0) ? t + .375 : old?.hurtUntil || 0;
      const animation = hurtUntil > t ? 'hurt' : near||enemy.actionTimer>0 ? 'attack'
        : old && distance(enemy, old) < .02 ? 'idle' : 'walk';
      const since = animation === old?.animation && !(animation === 'attack' && (t - old.since >= .8 || near&&biting)) ? old.since : t;
      next.set(enemy.id, { ...enemy, animation, since, hurtUntil, flash: enemy.hitFlash,
        flip: enemy.x > state.player.x });
    }
    for (const [id, old] of this.views) {
      if (next.has(id)) continue;
      // Far-away despawns are not deaths. Match the simulation's dissolve event.
      if ((state.effects || []).some(e => ['dissolve','guardian'].includes(e.kind) && distance(e, old) < 45)) {
        this.ghosts.push({ ...old, sprite:spriteKey(old),size:actorSize(old), since: t });
      }
    }
    this.ghosts = this.ghosts.filter(e => t - e.since < .6).slice(-30);
    this.views = next; this.lastTime = t;
  }

  ground(player) {
    const c = this.ctx;
    const left = player.x - this.width / this.scale / 2 - 128;
    const top = player.y - this.height / this.scale / 2 - 128;
    const right = left + this.width / this.scale + 256, bottom = top + this.height / this.scale + 256;
    // Cache a world-anchored tile field once; never stretch individual tiles as
    // the fractional camera moves. Their pixels no longer change width per frame.
    const unit=this.zoom*2;
    c.setTransform(unit,0,0,unit,this.cx,this.cy);c.fillStyle=this.floorPatterns[this.map];
    c.fillRect(-this.cx/unit,-this.cy/unit,this.canvas.width/unit,this.canvas.height/unit);
    c.setTransform(1,0,0,1,0,0);
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
    const count = Math.max(24, Math.min(64, Math.round(radius / 4)));
    this.ctx.save(); this.ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const angle = i / count * TAU;
      this.blit('combat', (warning ? 3 : 2) * 32, 0, 32, 32,
        x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 25, 25, .5);
    }
    this.ctx.restore();
  }

  draw(state, preview = false, terminalElapsed) {
    if (!this.width || !this.height) return;
    this.alpha=state.status==='playing'&&Math.abs(state.time-(this.previous.time+FIXED_STEP))<1e-6
      ? Math.min(1,state.remainder/FIXED_STEP) : 1;
    const c = this.ctx, p = {...state.player,...this.pose(state.player)}, t = state.time || 0, z = this.zoom;
    this.map=state.map||'garden';
    if (terminalElapsed !== undefined) this.terminalElapsed = terminalElapsed;
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
    c.globalAlpha = 1; c.fillStyle = '#17262e'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.cx = this.canvas.width / 2 - p.x * z;
    this.cy = this.canvas.height * .49 - p.y * z;
    this.view(state);
    this.health.update(state);
    const cue=this.health.sample(t+(state.status==='lost'?(this.terminalElapsed||0):state.remainder||0));
    const heroAnimation=state.status==='lost'?'death':cue.hurt?'hurt'
      :this.attackUntil>t?'attack':state.moving?'walk':'idle';
    const heroSince=heroAnimation==='death'?t-(this.terminalElapsed??.6)
      :heroAnimation==='hurt'?this.health.hitSince:heroAnimation==='attack'?this.attackUntil-.375:0;
    const props = this.ground(p);
    if(state.upgrades?.collector&&!preview){
      const scan=this.media.matches?0:(t%3)/.9;
      if(scan<1){
        c.save();const [x,y]=this.at(p.x,p.y);c.strokeStyle='#8be6d4';c.globalAlpha=.12*(1-scan);c.lineWidth=Math.max(1,this.dpr);c.setLineDash([4*this.dpr,9*this.dpr]);
        c.beginPath();c.arc(x,y,state.pickupRadius*z*(.65+scan*.35),0,TAU);c.stroke();c.restore();
      }
    }
    for(const zone of state.zones||[]){
      c.globalAlpha=Math.min(.85,zone.life/.4);
      const frame=this.media.matches?0:Math.floor(t*8)%4;
      this.blit('arsenal',(frame+(zone.kind==='thorn'?4:0))*48,96,48,48,zone.x,zone.y,zone.radius*2.4,zone.radius*1.8,.5);
      if(zone.kind==='briar'){c.globalAlpha*=.75;this.blit('arsenal',(frame+4)*48,96,48,48,zone.x,zone.y,zone.radius*2,zone.radius*1.5,.5);}
      c.globalAlpha=1;
    }
    for (const gem of state.gems || []) {
      const tier=crystalTier(gem),point=this.pose(gem,'gems');
      this.blit('combat', (3+tier)*32, 0, 32, 32, point.x, point.y, 32, undefined, .5);
    }
    for(const orbitId of ['orbit','cyclone'])if (state.upgrades?.[orbitId]) {
      const stats=weaponStats(orbitId,state.upgrades[orbitId]),count=stats.count,radius=stats.radius*(1+(state.upgrades.amplifier||0)*.12);
      for (let i = 0; i < count; i++) {
        const angle = state.orbitAngle-(1-this.alpha)*FIXED_STEP*1.9+i/count*TAU;
        this.blit('arsenal', 48, 48, 48, 48, p.x + Math.cos(angle) * radius,
          p.y + Math.sin(angle) * radius, 48, 48, .5);
      }
    }
    const entities = [...props, { kind: 'prop', index: 0, x: 0, y: 0, size: 178 },
      ...(state.chests||[]).map(e=>({...e,kind:'chest'})),...(state.enemies || []), ...this.ghosts.map(e => ({ ...e, kind: 'dead' })), { ...p, kind: 'hero' }]
      .sort((a, b) => a.y - b.y);
    for (const entity of entities) {
      if (Math.abs(entity.x - p.x) > this.width / this.scale * .6 + 180
        || Math.abs(entity.y - p.y) > this.height / this.scale * .6 + 180) continue;
      if (entity.kind === 'prop') {
        c.globalAlpha = sceneryOpacity(entity,p);
        this.blit(MAPS[this.map].props, entity.index * 64, 0, 64, 64, entity.x, entity.y, entity.size);
        c.globalAlpha = 1;
      } else if (entity.kind === 'hero') {
          this.actor(state.character, heroAnimation, p.x, p.y, 96, t, heroSince, state.player.facingX < -.1);
      } else if(entity.kind==='chest'){
        const frame=this.media.matches?0:Math.floor(t*5)%3;
        this.blit('arsenal',frame*48,144,48,48,entity.x,entity.y,78,78,.85);
        this.blit('arsenal',336,144,48,48,entity.x,entity.y-68,28,28,.5);
      } else {
        const view = entity.kind === 'dead' ? entity : this.views.get(entity.id) || entity;
        const key=entity.kind==='dead'?entity.sprite:spriteKey(entity);
        const point=entity.kind==='dead'?entity:this.pose(entity,'enemies');
        this.actor(key, entity.kind === 'dead' ? 'death' : view.animation || 'walk',
          point.x, point.y, entity.kind==='dead'?entity.size:actorSize(entity), t, view.since || 0, view.flip);
      }
      if (!['hero', 'prop', 'dead','chest'].includes(entity.kind) && (entity.kind === 'guardian' || entity.elite || entity.hp < entity.maxHp)) {
        const point=this.pose(entity,'enemies');
        const [x, y] = this.at(point.x, point.y - entity.radius - 23);
        const width = round(entity.radius * 2 * z);
        c.fillStyle = '#111b25'; c.fillRect(x - round(width / 2) - 1, y, width + 2, 3);
        c.fillStyle = entity.kind === 'guardian' ? '#e39b5d' : '#83cda4';
        c.fillRect(x - round(width / 2), y + 1, Math.max(0, round(width * entity.hp / entity.maxHp)), 1);
      }
    }
    for (const shot of state.projectiles || []) {
      const point=this.pose(shot,'shots'),[x, y] = this.at(point.x, point.y);
      c.save(); c.translate(x, y);
      c.rotate(Math.round((['cleaver','chakram','sunrise'].includes(shot.weapon)?t*9:Math.atan2(shot.vy, shot.vx)) / (TAU / 8)) * TAU / 8);
      const size=round((shot.hostile?26:48*(1+(state.upgrades.amplifier||0)*.12))*z),frame=shot.hostile?32:48;
      const index=WEAPONS[shot.weapon]?.index;
      if(['shard','moon_shard'].includes(shot.weapon)){
        c.fillStyle='#111b25';c.beginPath();c.moveTo(size*.7,0);c.lineTo(0,size*.32);c.lineTo(-size*.6,0);c.lineTo(0,-size*.32);c.closePath();c.fill();
        c.fillStyle=shot.weapon==='shard'?'#c19bec':'#82ddf3';c.beginPath();c.moveTo(size*.55,0);c.lineTo(0,size*.2);c.lineTo(-size*.4,0);c.lineTo(0,-size*.2);c.closePath();c.fill();
        c.fillStyle='#f3edff';c.fillRect(-size*.1,-this.dpr,size*.45,2*this.dpr);
      }else if(shot.weapon==='prism'){
        c.fillStyle='#40939e';c.fillRect(-size*.8,-size*.14,size*1.8,size*.28);c.fillStyle='#8de8ee';c.fillRect(-size*.6,-size*.08,size*1.6,size*.16);c.fillStyle='#fff1c9';c.fillRect(-size*.2,-this.dpr,size*1.2,2*this.dpr);
      }else if(index>=8){
        const item=index-8;if(shot.weapon==='spear')c.rotate(Math.PI*.75);
        c.drawImage(this.art.images.expedition,item%5*48,Math.floor(item/5)*48,48,48,-size/2,-size/2,size,size);
      }else c.drawImage(shot.hostile?this.art.images.combat:this.art.images.arsenal,shot.hostile?96:(index||0)*48,shot.hostile?0:48,frame,frame,-size/2,-size/2,size,size);
      c.restore();
    }
    for (const effect of state.effects || []) {
      const fraction = effect.life / (effect.maxLife || .5);
      if(effect.kind==='charge'){
        const [x,y]=this.at(effect.x,effect.y),[tx,ty]=this.at(effect.toX,effect.toY);
        c.save();c.strokeStyle='#f2b9b5';c.globalAlpha=.7;c.lineWidth=2*this.dpr;c.setLineDash([7*this.dpr,6*this.dpr]);c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.stroke();c.setLineDash([]);c.strokeRect(tx-5*this.dpr,ty-5*this.dpr,10*this.dpr,10*this.dpr);c.restore();
      }else if(effect.kind==='shards'||effect.kind==='fusion'){
        const radius=effect.radius*(effect.kind==='shards'||this.media.matches?1:1-.65*fraction),color=effect.kind==='shards'?'#d3a8ed':'#ffe09a';
        c.save();c.globalAlpha=Math.min(.8,fraction+.2);c.fillStyle=color;
        for(let i=0;i<24;i++){const a=i/24*TAU,[x,y]=this.at(effect.x+Math.cos(a)*radius,effect.y+Math.sin(a)*radius);c.fillRect(x-2*this.dpr,y-2*this.dpr,4*this.dpr,4*this.dpr);}c.restore();
      }else if(effect.kind==='arc'){
        c.save();c.globalAlpha=Math.min(1,fraction*2);
        const dx=effect.toX-effect.x,dy=effect.toY-effect.y,steps=Math.min(16,Math.max(1,Math.ceil(Math.hypot(dx,dy)/35)));
        for(let i=0;i<=steps;i++)this.blit('arsenal',240,48,48,48,effect.x+dx*i/steps,effect.y+dy*i/steps,45,45,.5);
        c.restore();
      }else if(effect.kind==='chest'){
        this.blit('arsenal',(3+Math.min(3,Math.floor((1-fraction)*4)))*48,144,48,48,effect.x,effect.y,100,100,.85);
      }else if(effect.kind==='pulse'){
        c.save();c.globalAlpha=Math.min(.85,fraction);
        this.blit('arsenal',96,48,48,48,effect.x,effect.y,effect.radius*2*(1-.65*fraction),undefined,.5);c.restore();
      }else if(effect.kind==='warning'){
        this.ring(effect.x,effect.y,effect.radius,true,Math.min(.9,fraction));
      } else if (!this.media.matches) {
        c.save(); c.globalAlpha = Math.min(.8, fraction);
        this.blit('combat', (effect.kind==='hurt'?3:7)*32, 0, 32, 32, effect.x, effect.y, 45 * (1.4 - fraction), undefined, .5); c.restore();
      }
    }
    // A chest remains findable after the player kites its guardian off screen.
    for(const chest of state.chests||[]){
      const [x,y]=this.at(chest.x,chest.y),margin=34*this.dpr;
      if(x>=margin&&x<=this.canvas.width-margin&&y>=180*this.dpr&&y<=this.canvas.height-120*this.dpr)continue;
      const px=Math.max(margin,Math.min(this.canvas.width-margin,x)),py=Math.max(180*this.dpr,Math.min(this.canvas.height-120*this.dpr,y));
      c.save();c.globalAlpha=.9;c.fillStyle='#17262e';c.fillRect(px-margin*.6,py-margin*.6,margin*1.2,margin*1.2);
      c.drawImage(this.art.images.arsenal,0,144,48,48,Math.round(px-margin*.6),Math.round(py-margin*.6),Math.round(margin*1.2),Math.round(margin*1.2));c.restore();
    }
    if (!this.media.matches) {
      for (let i = 0; i < 12; i++) {
        const x = p.x - this.width / this.scale / 2 + (i * 179 + t * 3) % (this.width / this.scale);
        const y = p.y - this.height / this.scale / 2 + (i * 127 + Math.sin(t + i) * 5) % (this.height / this.scale);
        c.save(); c.globalAlpha = .35;
        this.blit('ui', 15 * 16, 0, 16, 16, x, y, 12, 12, .5); c.restore();
      }
    }
    if(!preview){
      // Keep the essential hit cue and local HP readable even in dense combat.
      if(cue.flash>0){
        c.save();c.globalAlpha=cue.flash*.85;
        this.actor(state.character,heroAnimation,p.x,p.y,96,t,heroSince,state.player.facingX<-.1,
          cue.age<.07?'#fff0dc':'#ff777d');c.restore();
      }
      this.heroHealth(p,cue);
    }
    // Discrete edge shade keeps pixel clusters intact; no blur/filters over art.
    c.fillStyle = '#111b2533';
    c.fillRect(0, 0, this.canvas.width, 4); c.fillRect(0, this.canvas.height - 4, this.canvas.width, 4);
    if (preview) { c.fillStyle = '#111b2540'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); }
  }

  destroy() {
    this.canvas.width = 1; this.canvas.height = 1;
    this.views.clear(); this.ghosts = []; this.art = null;this.floorPatterns={};
    this.hitSheets.clear();
    this.previous.enemies.clear();this.previous.shots.clear();this.previous.gems=new WeakMap();
  }
}
