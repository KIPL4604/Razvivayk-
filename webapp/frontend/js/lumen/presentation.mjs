// Pure presentation rules: no simulation writes or device assumptions.
export const FIXED_STEP = 1 / 60;
export const WEAPONS = Object.freeze({
  spark: { index: 0, short: 'Разряд', verb: 'Бьёт ближайшего', color: '#efbe7c', className: 'amber' },
  orbit: { index: 1, short: 'Орбита', verb: 'Режет вокруг тебя', color: '#8dc9ee', className: 'blue' },
  pulse: { index: 2, short: 'Волна', verb: 'Бьёт кругом и отталкивает', color: '#c1a4eb', className: 'violet' },
});
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
export const crystalTier = crystal => crystal.tier || (crystal.value >= 40 ? 3 : crystal.value >= 12 ? 2 : 1);
export function upgradeSummary(id, rank = 0) {
  const summaries = {
    spark: `${WEAPONS.spark.verb} · +7 урона${[1, 3].includes(rank) ? ' · +1 луч' : ''}`,
    orbit: rank ? '+1 клинок вокруг тебя' : 'Два клинка бьют вокруг тебя',
    pulse: rank ? 'Больше урон и радиус волны' : 'Бьёт кругом и отталкивает',
    focus: 'Всем трём устройствам +20% урона',
    haste: 'Разряд и волна срабатывают чаще',
    stride: 'Движение быстрее на 10%',
    magnet: 'Притягивает опыт издалека',
    vitality: '+20 к максимуму · лечит 30',
    repair: 'Сразу восстанавливает 45 здоровья',
  };
  return summaries[id] || '';
}
