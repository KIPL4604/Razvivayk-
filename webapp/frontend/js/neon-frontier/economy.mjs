export const HANGAR_KEY = "teramont.neon-frontier.hangar.v1";
export const LEGACY_RECORD = "teramont.neon-frontier.best.v1";
export const STARTER = "swift";
export const SHIPS = {
  swift: { name: "Стриж", code: "NF–01", role: "Разведчик", color: "#91f2fa", price: 0,
    description: "Лёгкий патрульный истребитель. Хорошо держит курс между залпами.",
    hull: 3, speed: 218, cadence: .13, damage: 1, spread: 0 },
  ion: { name: "Ион", code: "NF–08", role: "Перехватчик", color: "#9cf6ba", price: 350,
    description: "Пара плазменных двигателей помогает уходить из-под прицельного огня.",
    hull: 3, speed: 258, cadence: .117, damage: 1, spread: 0 },
  bastion: { name: "Бастион", code: "NF–22", role: "Броненосец", color: "#ffc184", price: 650,
    description: "Бронированный корпус выдерживает больше попаданий. Тяжёлые болты бьют сильнее.",
    hull: 5, speed: 195, cadence: .138, damage: 1.26, spread: 0 },
  prism: { name: "Призма", code: "NF–47", role: "Штурмовик", color: "#dab1ff", price: 1050,
    description: "Разнесённые орудия расширяют залп. Подходит для зачистки целых звеньев.",
    hull: 4, speed: 230, cadence: .123, damage: 1, spread: 1 },
};

export const PARTS = {
  core: { label: "Корпус", bonus: "Запас прочности", ink: "#a5c5ed", names: ["Каркас «Киль»", "Каркас «Титан»", "Каркас «Атлас»"] },
  cockpit: { label: "Кабина", bonus: "Темп стрельбы", ink: "#96f8c6", names: ["Кабина «Дозор»", "Кабина «Око»", "Кабина «Оракул»"] },
  cannon: { label: "Пушки", bonus: "Урон снарядов", ink: "#ffca87", names: ["Импульсная пушка", "Фотонный резак", "Квазар"] },
  drive: { label: "Двигатели", bonus: "Скорость корабля", ink: "#79e6ff", names: ["Ионный привод", "Плазменный форсаж", "Гипердвигатель"] },
  armor: { label: "Защита", bonus: "Корпус и щит", ink: "#e4eaf2", names: ["Керамический экран", "Барьер «Заслон»", "Эгида"] },
  reactor: { label: "Реактор", bonus: "Больше монет за вылет", ink: "#eda7ff", names: ["Реактор «Искра»", "Реактор «Пульсар»", "Звёздное ядро"] },
};
export const PART_IDS = Object.keys(PARTS);
export const UPGRADE_IDS = ["cannon", "drive", "armor"];
export const UPGRADE_PRICES = [120, 240, 420];
export const RANK_NAMES = ["Стандартный", "Редкий", "Эпический"];
export const CASES = {
  patrol: { name: "Патрульный", code: "01", price: 100, color: "#8ee9ef", odds: [75, 25, 0] },
  orbital: { name: "Орбитальный", code: "02", price: 200, color: "#8db9ff", odds: [35, 55, 10] },
  stellar: { name: "Звёздный", code: "03", price: 500, color: "#e2abff", odds: [0, 40, 60] },
};

const DUPLICATE = [20, 55, 140];
const MAX = 999_999_999;
const whole = (value, fallback, max = MAX) =>
  Number.isSafeInteger(value) && value >= 0 && value <= max ? value : fallback;
const emptyUpgrades = () => ({ cannon: 0, drive: 0, armor: 0 });

export function restoreHangar(raw, legacyBest = 0) {
  const saved = raw?.version === 1 ? raw : null;
  const ships = { [STARTER]: emptyUpgrades() };
  for (const id of Object.keys(SHIPS)) {
    if (!saved?.ships?.[id] || typeof saved.ships[id] !== "object") continue;
    ships[id] = Object.fromEntries(UPGRADE_IDS.map(part => [part, whole(saved.ships[id][part], 0, 3)]));
  }
  const modules = Object.fromEntries(PART_IDS.map(part => [part, whole(saved?.modules?.[part], 0, 3)]));
  const fits = Object.fromEntries(Object.keys(ships).map(id => [id, Object.fromEntries(
    PART_IDS.map(part => [part, whole(saved?.fits?.[id]?.[part], 0, modules[part])]),
  )]));
  const opened = whole(saved?.opened, 0);
  const receipt = saved?.pending;
  const pending = receipt && opened > 0 && receipt.id === opened &&
    Object.hasOwn(CASES, receipt.caseId) && Object.hasOwn(PARTS, receipt.part) &&
    Number.isInteger(receipt.rank) && receipt.rank >= 1 && receipt.rank <= modules[receipt.part] &&
    [0, DUPLICATE[receipt.rank - 1]].includes(receipt.refund) ?
    { id: opened, caseId: receipt.caseId, part: receipt.part, rank: receipt.rank, refund: receipt.refund } : null;
  return {
    version: 1, coins: whole(saved?.coins, 120), best: Math.max(whole(saved?.best, 0), whole(legacyBest, 0)),
    ships, modules, fits, opened, pending,
    active: Object.hasOwn(ships, saved?.active) ? saved.active : STARTER,
  };
}

export function shipStats(profile, id = profile.active) {
  const frame = SHIPS[id];
  const up = profile.ships[id] || emptyUpgrades();
  const mod = Object.fromEntries(PART_IDS.map(part => [part, profile.fits[id]?.[part] ?? 0]));
  const core = mod.core ? (mod.core === 3 ? 2 : 1) : 0;
  return {
    id, parts: mod, hull: frame.hull + core + (mod.armor ? (mod.armor === 3 ? 2 : 1) : 0),
    speed: frame.speed + up.drive * 9 + mod.drive * 13,
    damage: frame.damage + up.cannon * .09 + mod.cannon * .12,
    guard: 1.65 + up.armor * .2 + mod.armor * .11 + mod.core * .08,
    cadence: frame.cadence * (1 - mod.cockpit * .06), spread: frame.spread, salvage: 1 + mod.reactor * .12,
  };
}

export const DEFAULT_BUILD = shipStats(restoreHangar(null));

export function selectShip(profile, id) {
  if (!Object.hasOwn(SHIPS, id)) return "Корабль недоступен.";
  if (!Object.hasOwn(profile.ships, id)) {
    const price = SHIPS[id].price;
    if (profile.coins < price) return "Не хватает монет на корабль.";
    profile.coins -= price;
    profile.ships[id] = emptyUpgrades();
  }
  profile.active = id;
}

export function upgradeShip(profile, id, part, level) {
  if (!Object.hasOwn(profile.ships, id) || !UPGRADE_IDS.includes(part)) return "Сначала купи корабль.";
  const current = profile.ships[id][part];
  if (current === UPGRADE_PRICES.length) return "Достигнут максимум.";
  if (current !== level) return "Уровень уже изменился. Проверь новую цену.";
  const price = UPGRADE_PRICES[current];
  if (profile.coins < price) return "Не хватает монет на улучшение.";
  profile.coins -= price;
  profile.ships[id][part]++;
}

export function fitModule(profile, id, part, rank) {
  if (!Object.hasOwn(profile.ships, id)) return "Сначала купи корабль.";
  if (!Object.hasOwn(PARTS, part) || whole(rank, -1, profile.modules[part]) === -1) return "Модуль ещё не открыт.";
  (profile.fits[id] ??= {})[part] = rank;
}

export function openCase(profile, id, random = Math.random) {
  if (!Object.hasOwn(CASES, id)) return "Кейс недоступен.";
  if (profile.pending) return "Сначала посмотри предыдущий выигрыш.";
  const tier = CASES[id];
  if (profile.coins < tier.price) return "Не хватает монет на кейс.";
  const roll = random() * 100;
  const rank = roll < tier.odds[0] ? 1 : roll < tier.odds[0] + tier.odds[1] ? 2 : 3;
  const part = PART_IDS[Math.floor(random() * PART_IDS.length)];
  const refund = profile.modules[part] >= rank ? DUPLICATE[rank - 1] : 0;
  profile.modules[part] = Math.max(profile.modules[part], rank);
  profile.coins -= tier.price - refund;
  profile.pending = { id: ++profile.opened, caseId: id, part, rank, refund };
}

export function acknowledgeCase(profile, id) {
  if (profile.pending?.id === id) profile.pending = null;
}

export function rewardFor(run) {
  const bounty = Math.floor(run.score / 28) + (run.phase === "won" ? 120 : 0);
  return Math.floor(bounty * (run.build?.salvage ?? 1));
}

export function completeFlight(profile, score, reward) {
  profile.best = Math.max(profile.best, score);
  profile.coins = Math.min(MAX, profile.coins + reward);
}
