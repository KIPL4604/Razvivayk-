/* Original Teramont solo blackjack. One 52-card deck; dealer stands on all 17.
 * Net scores are virtual units: blackjack +1.5, normal win/loss +/-wager.
 * Double is the first decision only, draws one card, then ends the hand.
 * Split and insurance are deliberately outside this game's rule variant.
 * Standard rules reference: https://bicyclecards.com/how-to-play/blackjack/
 * The model contains the local dealer hole card; render only viewBlackjack().
 */

const RANKS = 'A23456789TJQK';
const SUITS = 'shdc';
const CARD = /^[A2-9TJQK][shdc]$/;
const STATUSES = new Set(['playing', 'won', 'lost', 'draw']);
const PAYOUTS = new Set([-2, -1, 0, 1, 1.5, 2]);
const uint32 = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const validCard = (value) => typeof value === 'string' && CARD.test(value);

function random(state) {
  let value = state.rngState;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0;
  return state.rngState / 0x100000000;
}

/** Evaluate one hand, keeping at most one ace at 11 when that avoids busting. */
export function total(cards) {
  if (!Array.isArray(cards) || !cards.every(validCard)) {
    throw new TypeError('A hand must contain card IDs such as As or Th.');
  }
  let value = 0;
  let aces = 0;
  for (const card of cards) {
    if (card[0] === 'A') {
      aces += 1;
      value += 1;
    } else {
      value += 'TJQK'.includes(card[0]) ? 10 : Number(card[0]);
    }
  }
  const soft = aces > 0 && value + 10 <= 21;
  if (soft) value += 10;
  return { value, soft, blackjack: cards.length === 2 && value === 21, bust: value > 21 };
}

function settle(state, status, payout, result) {
  state.status = status;
  state.payout = payout;
  state.result = result;
}

function checkNaturals(state) {
  const player = total(state.player).blackjack;
  const dealer = total(state.dealer).blackjack;
  if (player && dealer) settle(state, 'draw', 0, 'У обоих блэкджек. Ничья.');
  else if (player) settle(state, 'won', 1.5, 'Блэкджек! Победа 3:2.');
  else if (dealer) settle(state, 'lost', -1, 'У дилера блэкджек.');
}

function finishHand(state) {
  const player = total(state.player);
  if (player.bust) {
    settle(state, 'lost', -state.wager, 'Перебор. Победил дилер.');
    return;
  }
  // Every ace is already valued optimally, so this also stands on soft 17.
  while (total(state.dealer).value < 17) state.dealer.push(state.stock.shift());
  const dealer = total(state.dealer);
  if (dealer.bust) settle(state, 'won', state.wager, 'У дилера перебор. Победа!');
  else if (player.value > dealer.value) settle(state, 'won', state.wager, 'Ваше число больше. Победа!');
  else if (player.value < dealer.value) settle(state, 'lost', -state.wager, 'Число дилера больше.');
  else settle(state, 'draw', 0, 'Одинаковое число. Ничья.');
}

/** Create one hand. Pass a uint32 seed for deterministic tests and saved games. */
export function createBlackjack({ seed = Math.floor(Math.random() * 0x100000000) } = {}) {
  const normalizedSeed = Number.isInteger(seed) ? seed >>> 0 : 0x21ca4d;
  const state = {
    version: 1, game: 'blackjack', seed: normalizedSeed,
    rngState: normalizedSeed || 0x9e3779b9,
    status: 'playing', player: [], dealer: [], stock: [],
    wager: 1, payout: 0, result: '', actions: 0,
  };
  state.stock = [...SUITS].flatMap((suit) => [...RANKS].map((rank) => rank + suit));
  for (let index = state.stock.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random(state) * (index + 1));
    [state.stock[index], state.stock[other]] = [state.stock[other], state.stock[index]];
  }
  // Alternating cards, with the dealer's second card face down in the view.
  for (let round = 0; round < 2; round += 1) {
    state.player.push(state.stock.shift());
    state.dealer.push(state.stock.shift());
  }
  checkNaturals(state);
  return state;
}

/** Actions are fresh value objects; callers can attach labels without mutation. */
export function legalBlackjack(state) {
  if (!state || state.status !== 'playing') return [];
  const actions = [{ type: 'hit' }, { type: 'stand' }];
  if (state.player.length === 2 && state.actions === 0 && state.wager === 1) actions.push({ type: 'double' });
  return actions;
}

/** Apply one legal player decision in place; invalid decisions do not mutate. */
export function actBlackjack(state, action) {
  if (!action || typeof action !== 'object'
    || !legalBlackjack(state).some((legal) => legal.type === action.type)) return false;
  state.actions += 1;
  if (action.type === 'stand') {
    finishHand(state);
    return true;
  }
  if (action.type === 'double') state.wager = 2;
  state.player.push(state.stock.shift());
  const player = total(state.player);
  if (action.type === 'double' || player.value >= 21) finishHand(state);
  return true;
}

/** A display-only snapshot. No stock, seed, hidden total, or hidden card ID. */
export function viewBlackjack(state) {
  const hidden = state.status === 'playing';
  return {
    version: state.version, game: state.game, status: state.status,
    player: [...state.player], dealer: hidden ? [state.dealer[0], null] : [...state.dealer],
    playerTotal: total(state.player), dealerTotal: total(hidden ? [state.dealer[0]] : state.dealer),
    wager: state.wager, payout: state.payout, result: state.result, actions: state.actions,
    legalActions: legalBlackjack(state),
  };
}

/**
 * Restore a validated independent model. A single hand's choices are recoverable
 * from its player card count, final status and wager; no action history is stored.
 * Rebuilding it also rejects corrupt deck order, forged results, and stale scores.
 * This validates a local save, not a proof of fair play or server-side winnings.
 */
export function restoreBlackjack(raw) {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || raw.version !== 1 || raw.game !== 'blackjack'
      || !uint32(raw.seed) || !uint32(raw.rngState) || !STATUSES.has(raw.status)
      || ![1, 2].includes(raw.wager) || !PAYOUTS.has(raw.payout)
      || !Number.isInteger(raw.actions) || raw.actions < 0 || raw.actions > 21
      || typeof raw.result !== 'string' || raw.result.length > 140
      || !Array.isArray(raw.player) || raw.player.length < 2 || raw.player.length > 22
      || !Array.isArray(raw.dealer) || raw.dealer.length < 2 || raw.dealer.length > 18
      || !Array.isArray(raw.stock) || raw.stock.length > 48) return null;
    const cards = [...raw.player, ...raw.dealer, ...raw.stock];
    if (cards.length !== 52 || !cards.every(validCard) || new Set(cards).size !== 52) return null;

    const state = createBlackjack({ seed: raw.seed });
    if (raw.wager === 2) {
      if (!actBlackjack(state, { type: 'double' })) return null;
    } else {
      for (let count = 2; count < raw.player.length; count += 1) {
        if (!actBlackjack(state, { type: 'hit' })) return null;
      }
      if (raw.status !== 'playing' && state.status === 'playing') actBlackjack(state, { type: 'stand' });
    }
    for (const key of ['version', 'game', 'seed', 'rngState', 'status', 'wager', 'payout', 'result', 'actions']) {
      if (state[key] !== raw[key]) return null;
    }
    for (const key of ['player', 'dealer', 'stock']) {
      if (state[key].length !== raw[key].length || state[key].some((card, index) => card !== raw[key][index])) return null;
    }
    return state;
  } catch {
    return null;
  }
}
