/* Original Teramont Klondike rules, with no DOM, network, clock or dependencies.
 * Draw one card; unlimited redeals. The last array entry is the top card.
 * A redeal turns the whole waste face down; the next draw reveals its first card.
 * Local saves are validated entertainment data, not authoritative server results.
 */
const RANKS = 'A23456789TJQK';
const SUITS = 'shdc';
const CARDS = new Set([...SUITS].flatMap((suit) => [...RANKS].map((rank) => rank + suit)));
const CORE_KEYS = ['version', 'game', 'seed', 'rngState', 'status', 'stock', 'waste', 'foundations', 'tableau', 'moves', 'redeals'];
const STATE_KEYS = [...CORE_KEYS, 'history'];
const MAX_HISTORY = 100;
const MAX_MOVES = 1_000_000_000;
const DEFAULT_SEED = 0x51a71a;
const rank = (card) => RANKS.indexOf(card[0]) + 1;
const red = (card) => card[1] === 'h' || card[1] === 'd';
const stacks = (lower, upper) => rank(lower) === rank(upper) + 1 && red(lower) !== red(upper);
const uint32 = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

function exactObject(value, keys) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
  });
}

function denseArray(value, maximum) {
  if (!Array.isArray(value) || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
  }
  return true;
}

function copyCore(state) {
  return {
    version: 1, game: 'solitaire', seed: state.seed, rngState: state.rngState,
    status: state.status, stock: [...state.stock], waste: [...state.waste],
    foundations: state.foundations.map((pile) => [...pile]),
    tableau: state.tableau.map((pile) => pile.map(({ card, faceUp }) => ({ card, faceUp }))),
    moves: state.moves, redeals: state.redeals,
  };
}

function readCore(raw, withHistory = false) {
  if (!exactObject(raw, withHistory ? STATE_KEYS : CORE_KEYS)) return null;
  if (raw.version !== 1 || raw.game !== 'solitaire' || !uint32(raw.seed)
    || !uint32(raw.rngState) || !raw.rngState || !['playing', 'won'].includes(raw.status)
    || !Number.isInteger(raw.moves) || raw.moves < 0 || raw.moves > MAX_MOVES
    || !Number.isInteger(raw.redeals) || raw.redeals < 0 || raw.redeals > raw.moves) return null;
  if (!denseArray(raw.stock, 52) || !denseArray(raw.waste, 52)
    || !denseArray(raw.foundations, 4) || raw.foundations.length !== 4
    || !denseArray(raw.tableau, 7) || raw.tableau.length !== 7
    || (withHistory && !denseArray(raw.history, MAX_HISTORY))) return null;
  const seen = new Set();
  const take = (card) => {
    if (!CARDS.has(card) || seen.has(card)) return false;
    seen.add(card);
    return true;
  };
  for (const card of [...raw.stock, ...raw.waste]) if (!take(card)) return null;
  let foundationCards = 0;
  for (const pile of raw.foundations) {
    if (!denseArray(pile, 13)) return null;
    for (let index = 0; index < pile.length; index += 1) {
      const card = pile[index];
      if (!take(card) || rank(card) !== index + 1 || card[1] !== pile[0][1]) return null;
    }
    foundationCards += pile.length;
  }
  for (const pile of raw.tableau) {
    if (!denseArray(pile, 52)) return null;
    let revealed = false;
    for (let index = 0; index < pile.length; index += 1) {
      const entry = pile[index];
      if (!exactObject(entry, ['card', 'faceUp']) || typeof entry.faceUp !== 'boolean' || !take(entry.card)) return null;
      if (entry.faceUp) {
        if (revealed && !stacks(pile[index - 1].card, entry.card)) return null;
        revealed = true;
      } else if (revealed) return null;
    }
    if (pile.length && !revealed) return null;
  }
  if (seen.size !== 52 || (raw.status === 'won') !== (foundationCards === 52)) return null;
  return copyCore(raw);
}

function random(state) {
  let value = state.rngState;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0;
  return state.rngState / 4294967296;
}

export function createSolitaire({ seed = DEFAULT_SEED } = {}) {
  const normalizedSeed = Number.isSafeInteger(seed) ? seed >>> 0 : DEFAULT_SEED;
  const state = {
    version: 1, game: 'solitaire', seed: normalizedSeed,
    rngState: normalizedSeed || 0x9e3779b9, status: 'playing',
    stock: [...CARDS], waste: [], foundations: [[], [], [], []],
    tableau: Array.from({ length: 7 }, () => []), moves: 0, redeals: 0, history: [],
  };
  for (let index = state.stock.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random(state) * (index + 1));
    [state.stock[index], state.stock[other]] = [state.stock[other], state.stock[index]];
  }
  for (let row = 0; row < 7; row += 1) {
    for (let column = row; column < 7; column += 1) {
      state.tableau[column].push({ card: state.stock.pop(), faceUp: row === column });
    }
  }
  return state;
}

function legalForCore(state) {
  if (state.status !== 'playing' || state.moves >= MAX_MOVES) return [];
  const actions = [];
  const offer = (from, cards) => {
    const first = cards[0];
    for (let index = 0; index < 7; index += 1) {
      if (from.pile === 'tableau' && from.index === index) continue;
      const destination = state.tableau[index];
      if (destination.length ? stacks(destination.at(-1).card, first) : rank(first) === 13) {
        actions.push({ type: 'move', from: { ...from }, to: { pile: 'tableau', index } });
      }
    }
    if (cards.length !== 1 || from.pile === 'foundation') return;
    for (let index = 0; index < 4; index += 1) {
      const destination = state.foundations[index];
      if (destination.length
        ? destination.at(-1)[1] === first[1] && destination.length + 1 === rank(first)
        : rank(first) === 1) {
        actions.push({ type: 'move', from: { ...from }, to: { pile: 'foundation', index } });
      }
    }
  };
  if (state.waste.length) offer({ pile: 'waste', index: 0 }, [state.waste.at(-1)]);
  for (let index = 0; index < 7; index += 1) {
    const pile = state.tableau[index];
    for (let at = 0; at < pile.length; at += 1) {
      if (pile[at].faceUp) offer({ pile: 'tableau', index, at }, pile.slice(at).map((entry) => entry.card));
    }
  }
  for (let index = 0; index < 4; index += 1) {
    if (state.foundations[index].length) offer({ pile: 'foundation', index }, [state.foundations[index].at(-1)]);
  }
  if (state.stock.length || state.waste.length) actions.push({ type: 'draw' });
  return actions;
}

export function legalSolitaire(state) {
  const core = readCore(state, true);
  return core ? legalForCore(core) : [];
}

function canonicalAction(state, action) {
  if (exactObject(action, ['type']) && action.type === 'draw') return { type: 'draw' };
  if (!exactObject(action, ['type', 'from', 'to']) || action.type !== 'move') return null;
  const { from, to } = action;
  if (!to || !exactObject(to, ['pile', 'index']) || !['tableau', 'foundation'].includes(to.pile)
    || !Number.isInteger(to.index) || to.index < 0 || to.index >= (to.pile === 'tableau' ? 7 : 4)) return null;
  if (!from || !['waste', 'tableau', 'foundation'].includes(from.pile) || !Number.isInteger(from.index)
    || from.index < 0 || from.index >= (from.pile === 'tableau' ? 7 : from.pile === 'foundation' ? 4 : 1)) return null;
  let normalizedFrom;
  if (from.pile === 'tableau') {
    const explicit = Object.prototype.hasOwnProperty.call(from, 'at');
    if (!exactObject(from, explicit ? ['pile', 'index', 'at'] : ['pile', 'index'])) return null;
    const at = explicit ? from.at : state.tableau[from.index].length - 1;
    if (!Number.isInteger(at) || at < 0 || at >= state.tableau[from.index].length) return null;
    normalizedFrom = { pile: 'tableau', index: from.index, at };
  } else {
    if (!exactObject(from, ['pile', 'index'])) return null;
    normalizedFrom = { pile: from.pile, index: from.index };
  }
  return { type: 'move', from: normalizedFrom, to: { pile: to.pile, index: to.index } };
}

function applyCore(state, action) {
  if (action.type === 'draw') {
    if (state.stock.length) state.waste.push(state.stock.pop());
    else {
      state.stock = state.waste.reverse();
      state.waste = [];
      state.redeals += 1;
    }
  } else {
    const { from, to } = action;
    let cards;
    if (from.pile === 'tableau') {
      const source = state.tableau[from.index];
      cards = source.splice(from.at).map((entry) => entry.card);
      if (source.length) source.at(-1).faceUp = true;
    } else if (from.pile === 'waste') cards = [state.waste.pop()];
    else cards = [state.foundations[from.index].pop()];
    if (to.pile === 'tableau') state.tableau[to.index].push(...cards.map((card) => ({ card, faceUp: true })));
    else state.foundations[to.index].push(cards[0]);
  }
  state.moves += 1;
  state.status = state.foundations.every((pile) => pile.length === 13) ? 'won' : 'playing';
}

export function actSolitaire(state, action) {
  const core = readCore(state, true);
  if (!core) return false;
  const normalized = canonicalAction(core, action);
  if (!normalized) return false;
  const key = JSON.stringify(normalized);
  if (!legalForCore(core).some((candidate) => JSON.stringify(candidate) === key)) return false;
  const previous = copyCore(core);
  applyCore(core, normalized);
  state.history.push(previous);
  if (state.history.length > MAX_HISTORY) state.history.shift();
  Object.assign(state, core);
  return true;
}

function follows(previous, next) {
  if (next.moves !== previous.moves + 1 || next.seed !== previous.seed || next.rngState !== previous.rngState) return false;
  const expected = JSON.stringify(next);
  return legalForCore(previous).some((action) => {
    const candidate = copyCore(previous);
    applyCore(candidate, action);
    return JSON.stringify(candidate) === expected;
  });
}

export function restoreSolitaire(raw) {
  try {
    if (typeof raw === 'string') {
      if (raw.length > 750_000) return null;
      raw = JSON.parse(raw);
    }
    const core = readCore(raw, true);
    if (!core || raw.history.length > core.moves) return null;
    const history = [];
    for (const entry of raw.history) {
      const snapshot = readCore(entry);
      if (!snapshot || snapshot.seed !== core.seed || snapshot.rngState !== core.rngState) return null;
      if (history.length && !follows(history.at(-1), snapshot)) return null;
      history.push(snapshot);
    }
    if (history.length && !follows(history.at(-1), core)) return null;
    return { ...core, history };
  } catch {
    return null;
  }
}

export function undoSolitaire(state) {
  const restored = restoreSolitaire(state);
  if (!restored || !restored.history.length) return false;
  const previous = restored.history.pop();
  Object.assign(state, previous, { history: restored.history });
  return true;
}

const layoutKey = (state) => JSON.stringify([state.stock, state.waste, state.foundations, state.tableau]);

export function hintSolitaire(state) {
  const core = readCore(state, true);
  if (!core) return null;
  const actions = legalForCore(core);
  const recent = new Set(state.history.slice(-8).map(layoutKey));
  let best = null;
  let bestScore = 0;
  for (const action of actions) {
    if (action.type !== 'move' || action.from.pile === 'foundation') continue;
    const { from, to } = action;
    let score = to.pile === 'foundation' ? 100 : from.pile === 'waste' ? 70 : 20;
    if (from.pile === 'tableau') {
      if (from.at > 0 && !core.tableau[from.index][from.at - 1].faceUp) score += 110;
      if (to.pile === 'tableau' && !core.tableau[to.index].length && from.at === 0) continue;
    }
    const candidate = copyCore(core);
    applyCore(candidate, action);
    if (recent.has(layoutKey(candidate))) continue;
    if (score > bestScore) { best = action; bestScore = score; }
  }
  return best || actions.find((action) => action.type === 'draw') || null;
}
