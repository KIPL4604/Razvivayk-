// Pure presentation rules: no simulation writes or device assumptions.
export const FIXED_STEP = 1 / 60;
import {WEAPONS,weaponSummary} from './catalog.mjs';
export {WEAPONS};
export const lerp = (a, b, alpha) => a + (b - a) * alpha;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const cameraScale = (width, height) => .8 * Math.max(.72, Math.min(1.25, Math.min(width / 650, height / 650)));
export function sceneryOpacity(prop, player) {
  if (!prop.index) return 1;
  const front = smooth((prop.y - player.y + 22) / 45);
  const near = smooth((130 - Math.hypot(prop.x - player.x, prop.y - player.y)) / 85);
  return 1 - .55 * front * near;
}
export {crystalTier} from './progression.mjs';
export function upgradeSummary(id, rank = 0) {
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
