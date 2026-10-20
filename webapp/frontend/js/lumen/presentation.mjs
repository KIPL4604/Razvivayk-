// Pure presentation rules: no simulation writes or device assumptions.
export const FIXED_STEP = 1 / 60;
import {WEAPONS,weaponSummary,ARTIFACTS} from './catalog.mjs';
export {WEAPONS};
export const lerp = (a, b, alpha) => a + (b - a) * alpha;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** Local presentation history; never stored in a run or written into simulation. */
export class HealthFeedback {
  update(state) {
    const {hp,maxHp,invulnerable}=state.player, time=state.time;
    if(this.runId!==state.runId||this.time===undefined||time<this.time){
      this.hitSince=-Infinity;this.before=hp;
    }else if(hp<this.hp||invulnerable>this.invulnerable+.001){
      this.hitSince=time;this.before=Math.max(hp,this.hp);
    }
    this.runId=state.runId;this.time=time;this.hp=hp;
    this.maxHp=maxHp;this.invulnerable=invulnerable;
  }

  sample(time) {
    const age=Math.max(0,time-this.hitSince),ratio=clamp(this.hp/this.maxHp);
    const trail=clamp(lerp(this.before,this.hp,smooth((age-.18)/.38))/this.maxHp);
    return {age,ratio,trail:Math.max(ratio,trail),hurt:age<.375,
      flash:Math.max(0,1-age/.28)};
  }
}

export const cameraScale = (width, height) => .8 * Math.max(.72, Math.min(1.25, Math.min(width / 650, height / 650)));
export function sceneryOpacity(prop, player) {
  if (!prop.index) return 1;
  const front = smooth((prop.y - player.y + 22) / 45);
  const near = smooth((130 - Math.hypot(prop.x - player.x, prop.y - player.y)) / 85);
  return 1 - .55 * front * near;
}
export {crystalTier} from './progression.mjs';
export function upgradeSummary(id, rank = 0) {
  if(ARTIFACTS[id])return ARTIFACTS[id].description;
  if(WEAPONS[id])return weaponSummary(id,rank);
  const summaries = {
    focus: 'Всему оружию +20% урона',
    haste: 'Всё оружие срабатывает чаще',
    stride: 'Движение быстрее на 10%',
    magnet: 'Притягивает опыт издалека',
    vitality: '+20 к максимуму · лечит 30',
    repair: 'Сразу восстанавливает 45 здоровья',
  };
  return summaries[id] || '';
}
