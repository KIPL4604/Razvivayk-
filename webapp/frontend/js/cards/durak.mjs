// Original two-player throw-in Durak rules. No DOM, network or external assets.
// Cards use rank + suit (6h, Td, As); stock[0] is drawn first, trumpCard last.
const RANKS = '6789TJQKA';
const SUITS = 'shdc';
const DECK = [...SUITS].flatMap((suit) => [...RANKS].map((rank) => rank + suit));
const CARDS = new Set(DECK);
const PHASES = new Set(['attack', 'defend', 'throw', 'taking']);
const STATUSES = new Set(['playing', 'won', 'lost', 'draw']);
const uint32 = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const value = (card) => RANKS.indexOf(card[0]);
const order = (card, trump) => (card[1] === trump ? 100 : 0) + value(card) * 4 + SUITS.indexOf(card[1]);
const sortHands = (state) => state.hands.forEach((hand) => hand.sort((a, b) => order(a, state.trump) - order(b, state.trump)));
const beats = (defense, attack, trump) => defense[1] === attack[1]
  ? value(defense) > value(attack)
  : defense[1] === trump && attack[1] !== trump;

function setMessage(state, intro = '') {
  let text;
  if (state.status === 'won') text = 'Победа! Вы первым избавились от всех карт.';
  else if (state.status === 'lost') text = 'Соперник вышел. В этот раз карты остались у вас.';
  else if (state.status === 'draw') text = 'Ничья! Последние карты ушли в отбой вместе.';
  else if (state.phase === 'attack') text = state.turn === 0 ? 'Ваш ход: атакуйте любой картой.' : 'Соперник выбирает карту для атаки.';
  else if (state.phase === 'defend') text = state.turn === 0 ? 'Покройте карту старшей той же масти или козырем. Можно взять.' : 'Соперник отбивает вашу карту.';
  else if (state.phase === 'taking') text = state.turn === 0 ? 'Соперник берёт. Можно подкинуть совпадающий ранг или закончить ход.' : 'Вы берёте. Соперник может подкинуть ещё.';
  else text = state.turn === 0 ? 'Все карты покрыты. Подкиньте совпадающий ранг или нажмите «Бито».' : 'Все карты покрыты. Соперник решает, подкинуть ли ещё.';
  state.message = intro + text;
}

/** Create a seeded, local, two-player game; player 0 is the human. */
export function createDurak({ seed = Date.now() >>> 0 } = {}) {
  if (!uint32(seed)) throw new RangeError('Durak seed must be a uint32 integer.');
  let rngState = seed;
  const random = () => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };
  const deck = [...DECK];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  const hands = [[], []];
  for (let index = 0; index < 12; index += 1) hands[index % 2].push(deck.shift());
  const trumpCard = deck.at(-1);
  const trump = trumpCard[1];
  let attacker = 0;
  let lowest = Infinity;
  for (let player = 0; player < 2; player += 1) {
    for (const card of hands[player]) {
      if (card[1] === trump && value(card) < lowest) {
        attacker = player;
        lowest = value(card);
      }
    }
  }
  const state = {
    version: 1, game: 'durak', seed, rngState, status: 'playing',
    hands, stock: deck, trump, trumpCard, discard: [], table: [],
    attacker, turn: attacker, phase: 'attack', limit: 6, round: 1, message: '',
  };
  sortHands(state);
  setMessage(state);
  return state;
}

// Validate persistence before it can affect rules. The visible trump is metadata,
// not a second card: exactly one copy of every card must exist in the four zones.
function validState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)
    || state.version !== 1 || state.game !== 'durak'
    || !uint32(state.seed) || !uint32(state.rngState)
    || !STATUSES.has(state.status) || !PHASES.has(state.phase)
    || !SUITS.includes(state.trump) || state.trump?.length !== 1
    || !CARDS.has(state.trumpCard) || state.trumpCard[1] !== state.trump
    || ![0, 1].includes(state.attacker) || ![0, 1].includes(state.turn)
    || !Number.isSafeInteger(state.round) || state.round < 1
    || !Number.isInteger(state.limit) || state.limit < 1 || state.limit > 6
    || typeof state.message !== 'string' || state.message.length > 500
    || !Array.isArray(state.hands) || state.hands.length !== 2
    || !state.hands.every((hand) => Array.isArray(hand) && hand.length <= 36)
    || !Array.isArray(state.stock) || state.stock.length > 24
    || !Array.isArray(state.discard) || state.discard.length > 36 || state.discard.length % 2 !== 0
    || !Array.isArray(state.table) || state.table.length > state.limit) return false;
  if (state.stock.length && state.stock.at(-1) !== state.trumpCard) return false;
  const cards = [...state.hands.flat(), ...state.stock, ...state.discard];
  const ranks = new Set();
  let defended = 0;
  let unmatched = 0;
  let sawUnmatched = false;
  for (const pair of state.table) {
    if (!pair || typeof pair !== 'object' || !CARDS.has(pair.attack)
      || (pair.defense !== null && !CARDS.has(pair.defense))) return false;
    if (ranks.size && !ranks.has(pair.attack[0])) return false;
    ranks.add(pair.attack[0]);
    cards.push(pair.attack);
    if (pair.defense === null) {
      sawUnmatched = true;
      unmatched += 1;
    } else {
      if (sawUnmatched || !beats(pair.defense, pair.attack, state.trump)) return false;
      ranks.add(pair.defense[0]);
      cards.push(pair.defense);
      defended += 1;
    }
  }
  if (cards.length !== 36 || cards.some((card) => !CARDS.has(card)) || new Set(cards).size !== 36) return false;
  if (state.status !== 'playing') {
    if (state.stock.length || state.table.length || state.phase !== 'attack' || state.turn !== state.attacker) return false;
    const empty0 = state.hands[0].length === 0;
    const empty1 = state.hands[1].length === 0;
    return state.status === (empty0 && empty1 ? 'draw' : empty0 ? 'won' : empty1 ? 'lost' : 'playing');
  }
  const defender = 1 - state.attacker;
  if (state.limit !== Math.min(6, state.hands[defender].length + defended)) return false;
  if (state.phase === 'attack') return state.table.length === 0 && state.turn === state.attacker
    && state.hands.every((hand) => hand.length > 0);
  if (!state.table.length) return false;
  if (state.phase === 'defend') return state.turn === defender && unmatched === 1 && state.table.at(-1).defense === null;
  if (state.turn !== state.attacker) return false;
  if (state.phase === 'throw') return unmatched === 0;
  return unmatched > 0 && state.table.length < state.limit;
}

/** Exact actions for the current turn; asking for the other player returns []. */
export function legalDurak(state, player = state?.turn) {
  if (!validState(state) || state.status !== 'playing' || player !== state.turn) return [];
  const hand = state.hands[player];
  if (state.phase === 'attack') return hand.map((card) => ({ type: 'attack', card }));
  if (state.phase === 'defend') {
    const index = state.table.findIndex((pair) => pair.defense === null);
    return [
      ...hand.filter((card) => beats(card, state.table[index].attack, state.trump))
        .map((card) => ({ type: 'defend', card, index })),
      { type: 'take' },
    ];
  }
  const ranks = new Set(state.table.flatMap(({ attack, defense }) => defense ? [attack[0], defense[0]] : [attack[0]]));
  const attacks = state.table.length < state.limit
    ? hand.filter((card) => ranks.has(card[0])).map((card) => ({ type: 'attack', card })) : [];
  return [...attacks, { type: 'pass' }];
}

function finishBout(state, taking) {
  const attacker = state.attacker;
  const defender = 1 - attacker;
  const tableCards = state.table.flatMap(({ attack, defense }) => defense ? [attack, defense] : [attack]);
  (taking ? state.hands[defender] : state.discard).push(...tableCards);
  state.table = [];
  // The original attacker always draws first, even after a successful defense.
  for (const player of [attacker, defender]) {
    while (state.hands[player].length < 6 && state.stock.length) state.hands[player].push(state.stock.shift());
  }
  sortHands(state);
  state.round += 1;
  state.attacker = taking ? attacker : defender;
  state.turn = state.attacker;
  state.phase = 'attack';
  state.limit = Math.max(1, Math.min(6, state.hands[1 - state.attacker].length));
  if (state.stock.length === 0) {
    const empty0 = state.hands[0].length === 0;
    const empty1 = state.hands[1].length === 0;
    state.status = empty0 && empty1 ? 'draw' : empty0 ? 'won' : empty1 ? 'lost' : 'playing';
  }
  const intro = taking ? (defender === 0 ? 'Вы забрали карты. ' : 'Соперник забрал карты. ') : 'Бито. ';
  setMessage(state, state.status === 'playing' ? intro : '');
}

/** Apply an exact legal action in place. Illegal actions return false unchanged. */
export function actDurak(state, action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return false;
  const legal = legalDurak(state);
  if (!legal.some((candidate) => candidate.type === action.type && candidate.card === action.card && candidate.index === action.index)) return false;
  if (action.type === 'attack') {
    state.hands[state.turn].splice(state.hands[state.turn].indexOf(action.card), 1);
    state.table.push({ attack: action.card, defense: null });
    if (state.phase === 'taking') {
      if (state.table.length >= state.limit) finishBout(state, true);
      else setMessage(state);
    } else {
      state.phase = 'defend';
      state.turn = 1 - state.attacker;
      setMessage(state);
    }
  } else if (action.type === 'defend') {
    state.hands[state.turn].splice(state.hands[state.turn].indexOf(action.card), 1);
    state.table[action.index].defense = action.card;
    state.phase = 'throw';
    state.turn = state.attacker;
    setMessage(state);
  } else if (action.type === 'take') {
    state.phase = 'taking';
    state.turn = state.attacker;
    if (state.table.length >= state.limit) finishBout(state, true);
    else setMessage(state);
  } else finishBout(state, state.phase === 'taking');
  sortHands(state);
  return true;
}

/** A deterministic opponent using its own cards and public table/trump only. */
export function botDurak(state) {
  if (state?.turn !== 1) return null;
  const actions = legalDurak(state, 1);
  if (!actions.length) return null;
  const cards = actions.filter((action) => action.card)
    .sort((a, b) => order(a.card, state.trump) - order(b.card, state.trump));
  return cards[0] || actions[0];
}

/** Validate the whole snapshot, discard extra fields, and return an owned clone. */
export function restoreDurak(raw) {
  try {
    if (!validState(raw)) return null;
    const state = {
      version: 1, game: 'durak', seed: raw.seed, rngState: raw.rngState, status: raw.status,
      hands: raw.hands.map((hand) => [...hand]), stock: [...raw.stock], trump: raw.trump,
      trumpCard: raw.trumpCard, discard: [...raw.discard],
      table: raw.table.map(({ attack, defense }) => ({ attack, defense })),
      attacker: raw.attacker, turn: raw.turn, phase: raw.phase, limit: raw.limit,
      round: raw.round, message: raw.message,
    };
    sortHands(state);
    return state;
  } catch {
    return null;
  }
}
