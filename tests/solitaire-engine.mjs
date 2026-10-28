import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSolitaire, legalSolitaire, actSolitaire, undoSolitaire,
  restoreSolitaire, hintSolitaire,
} from '../webapp/frontend/js/cards/solitaire.mjs';

const ranks = 'A23456789TJQK';
const deck = [...'shdc'].flatMap((suit) => [...ranks].map((rank) => rank + suit));
const copy = (value) => JSON.parse(JSON.stringify(value));
const up = (...cards) => cards.map((card) => ({ card, faceUp: true }));
const move = (from, to) => ({ type: 'move', from, to });
const table = (index, at) => at === undefined ? { pile: 'tableau', index } : { pile: 'tableau', index, at };
const base = (index) => ({ pile: 'foundation', index });
const waste = { pile: 'waste', index: 0 };
const draw = { type: 'draw' };
const cardsOf = (state) => [
  ...state.stock, ...state.waste, ...state.foundations.flat(),
  ...state.tableau.flat().map((entry) => entry.card),
];

function position({ tableau = [], foundations = [], waste: exposed = [] } = {}) {
  const state = createSolitaire({ seed: 43 });
  state.tableau = Array.from({ length: 7 }, (_, index) => copy(tableau[index] || []));
  state.foundations = Array.from({ length: 4 }, (_, index) => [...(foundations[index] || [])]);
  state.waste = [...exposed];
  const placed = new Set([...state.foundations.flat(), ...state.tableau.flat().map((entry) => entry.card), ...state.waste]);
  assert.equal(placed.size, state.foundations.flat().length + state.tableau.flat().length + exposed.length, 'fixture cards must be unique');
  state.stock = deck.filter((card) => !placed.has(card));
  state.history = [];
  state.moves = 0;
  state.redeals = 0;
  return state;
}

test('seeded shuffle deals all 52 cards, seven columns and 24 stock cards', () => {
  const state = createSolitaire({ seed: 19 });
  assert.deepEqual(state, createSolitaire({ seed: 19 }));
  assert.notDeepEqual(state.stock, createSolitaire({ seed: 20 }).stock);
  assert.deepEqual(state.tableau.map((pile) => pile.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(state.stock.length, 24);
  assert.equal(new Set(cardsOf(state)).size, 52);
  assert.deepEqual([...cardsOf(state)].sort(), [...deck].sort());
  state.tableau.forEach((pile) => assert.deepEqual(pile.map((entry) => entry.faceUp), pile.map((_, index) => index === pile.length - 1)));
  assert.deepEqual(restoreSolitaire(state), state);
  assert.ok(createSolitaire({ seed: 0 }).rngState > 0);
});

test('draw-one and unlimited recycle preserve the original draw order', () => {
  const state = createSolitaire({ seed: 72 });
  const initialStock = [...state.stock];
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const observed = [];
    for (let index = 0; index < initialStock.length; index += 1) {
      assert.equal(actSolitaire(state, draw), true);
      observed.push(state.waste.at(-1));
    }
    assert.deepEqual(observed, [...initialStock].reverse());
    assert.equal(actSolitaire(state, draw), true);
    assert.deepEqual(state.stock, initialStock);
    assert.deepEqual(state.waste, []);
    assert.equal(state.redeals, cycle + 1);
  }
});

test('foundations start with an ace and continue in the same suit', () => {
  const state = position({ foundations: [['As']], waste: ['2h', '2s'] });
  assert.equal(actSolitaire(state, move(waste, base(1))), false, 'two cannot start an empty foundation');
  assert.equal(actSolitaire(state, move(waste, base(0))), true);
  assert.deepEqual(state.foundations[0], ['As', '2s']);
  assert.equal(actSolitaire(state, move(waste, base(0))), false, 'red two cannot continue spades');
  const ace = position({ waste: ['Ah'] });
  assert.equal(actSolitaire(ace, move(waste, base(3))), true);
  assert.deepEqual(ace.foundations[3], ['Ah']);
});

test('tableau moves descend with alternating colors and only kings fill spaces', () => {
  const state = position({ tableau: [up('7s'), up('7h')], waste: ['Kh', '6c', '6d'] });
  assert.equal(actSolitaire(state, move(waste, table(1))), false, 'same color is illegal');
  assert.equal(actSolitaire(state, move(waste, table(0))), true);
  assert.equal(actSolitaire(state, move(waste, table(2))), false, 'six cannot fill an empty column');
  assert.equal(actSolitaire(state, move(waste, table(1))), true);
  assert.equal(actSolitaire(state, move(waste, table(2))), true);
  assert.deepEqual(state.tableau[2], up('Kh'));
});

test('a whole face-up suffix moves together and exposes a hidden card', () => {
  const state = position({ tableau: [
    [{ card: 'As', faceUp: false }, ...up('7h', '6c', '5d')], up('8s'),
  ] });
  assert.equal(actSolitaire(state, move(table(0, 0), table(1))), false, 'hidden cards are immovable');
  assert.equal(actSolitaire(state, move(table(0, 1), base(0))), false, 'foundation receives one card at a time');
  assert.equal(actSolitaire(state, move(table(0, 1), table(1))), true);
  assert.deepEqual(state.tableau[0], up('As'));
  assert.deepEqual(state.tableau[1], up('8s', '7h', '6c', '5d'));
  assert.equal(actSolitaire(state, move(table(0), base(0))), true);
});

test('a suffix can move without taking the face-up card beneath it', () => {
  const state = position({ tableau: [up('8s', '7h', '6c'), up('7d')] });
  assert.equal(actSolitaire(state, move(table(0, 2), table(1))), true);
  assert.deepEqual(state.tableau[0], up('8s', '7h'));
  assert.deepEqual(state.tableau[1], up('7d', '6c'));
});

test('foundation cards can return to the tableau', () => {
  const state = position({ foundations: [['As', '2s']], tableau: [up('3h')] });
  assert.equal(actSolitaire(state, move(base(0), table(0))), true);
  assert.deepEqual(state.foundations[0], ['As']);
  assert.deepEqual(state.tableau[0], up('3h', '2s'));
});

test('invalid and malformed actions never change state', () => {
  const state = createSolitaire({ seed: 9 });
  const before = copy(state);
  for (const action of [null, {}, { type: 'win' }, { type: 'draw', amount: 52 },
    move({ pile: 'stock', index: 0 }, base(0)), move(table(-1), table(0)),
    move(table(0, 50), table(1)), move(table(0), table(0)),
    move({ ...waste, at: 0 }, table(0)), move(table(0), { ...base(0), at: 0 }),
    move(table(0), table(7)),
  ]) {
    assert.equal(actSolitaire(state, action), false, JSON.stringify(action));
    assert.deepEqual(state, before);
  }
});

test('undo restores draw, recycle and automatically flipped cards exactly', () => {
  const state = createSolitaire({ seed: 42 });
  const initial = copy(state);
  assert.equal(undoSolitaire(state), false);
  assert.equal(actSolitaire(state, draw), true);
  assert.equal(undoSolitaire(state), true);
  assert.deepEqual(state, initial);
  for (let index = 0; index < 24; index += 1) actSolitaire(state, draw);
  const beforeRecycle = copy(state);
  actSolitaire(state, draw);
  assert.equal(undoSolitaire(state), true);
  assert.deepEqual(state, beforeRecycle);
  const flip = position({ tableau: [[{ card: 'As', faceUp: false }, ...up('Ah')]] });
  const beforeFlip = copy(flip);
  assert.equal(actSolitaire(flip, move(table(0), base(0))), true);
  assert.equal(undoSolitaire(flip), true);
  assert.deepEqual(flip, beforeFlip);
});

test('only collecting all 52 cards wins; terminal state can be undone', () => {
  const foundations = [...'shdc'].map((suit) => [...ranks.slice(0, 12)].map((rank) => rank + suit));
  const state = position({ foundations, tableau: [up('Ks'), up('Kh'), up('Kd'), up('Kc')] });
  for (let index = 0; index < 4; index += 1) {
    assert.equal(state.status, 'playing');
    assert.equal(actSolitaire(state, move(table(index), base(index))), true);
  }
  assert.equal(state.status, 'won');
  assert.equal(state.foundations.flat().length, 52);
  assert.deepEqual(legalSolitaire(state), []);
  assert.equal(hintSolitaire(state), null);
  assert.equal(actSolitaire(state, draw), false);
  assert.deepEqual(restoreSolitaire(state), state);
  assert.equal(undoSolitaire(state), true);
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.tableau[3], up('Kc'));
  assert.equal(actSolitaire(state, move(table(3), base(3))), true);
});

test('legal moves are executable and preserve conservation across seeded play', () => {
  for (let seed = 0; seed < 12; seed += 1) {
    const state = createSolitaire({ seed });
    for (let turn = 0; turn < 70; turn += 1) {
      const actions = legalSolitaire(state);
      assert.ok(actions.length);
      const action = turn % 4 === 0 ? actions[(seed + turn) % actions.length] : hintSolitaire(state);
      if (!action) break;
      assert.ok(actions.some((candidate) => JSON.stringify(candidate) === JSON.stringify(action)));
      assert.equal(actSolitaire(state, action), true);
      assert.equal(cardsOf(state).length, 52);
      assert.equal(new Set(cardsOf(state)).size, 52);
      if (state.status === 'won') break;
    }
    assert.deepEqual(restoreSolitaire(state), state);
  }
});

test('hints expose hidden cards or develop the layout and fall back to draw', () => {
  const state = position({ tableau: [[{ card: 'As', faceUp: false }, ...up('7h')], up('8s')] });
  assert.deepEqual(hintSolitaire(state), move(table(0, 1), table(1)));
  const justDraw = position({ tableau: [up('Ks')], waste: ['5h'] });
  assert.deepEqual(hintSolitaire(justDraw), draw, 'do not move a king from one empty column to another');
  const ace = position({ waste: ['As'] });
  assert.equal(hintSolitaire(ace).to.pile, 'foundation');
});

test('history is capped at 100 snapshots and remains usable after restore', () => {
  const state = createSolitaire({ seed: 100 });
  for (let index = 0; index < 130; index += 1) assert.equal(actSolitaire(state, draw), true);
  assert.equal(state.history.length, 100);
  const restored = restoreSolitaire(JSON.stringify(state));
  assert.deepEqual(restored, state);
  for (let index = 0; index < 100; index += 1) assert.equal(undoSolitaire(restored), true);
  assert.equal(restored.moves, 30);
  assert.equal(undoSolitaire(restored), false);
});

test('restore returns an independent clone and rejects corrupt snapshots', () => {
  const state = createSolitaire({ seed: 33 });
  actSolitaire(state, draw);
  const restored = restoreSolitaire(state);
  restored.stock.pop();
  assert.notDeepEqual(restored, state);
  const corruptions = [
    (bad) => { bad.stock[0] = bad.stock[1]; },
    (bad) => { bad.stock.pop(); },
    (bad) => { bad.stock[0] = '<script>'; },
    (bad) => { bad.status = 'won'; },
    (bad) => { bad.version = 2; },
    (bad) => { bad.moves = -1; },
    (bad) => { bad.redeals = bad.moves + 1; },
    (bad) => { bad.seed = Infinity; },
    (bad) => { bad.rngState = 0; },
    (bad) => { bad.extra = true; },
    (bad) => { bad.tableau[0][0].extra = true; },
    (bad) => { bad.tableau[1][1].faceUp = false; },
    (bad) => { bad.history[0].stock[0] = bad.history[0].stock[1]; },
    (bad) => { bad.history[0].history = []; },
    (bad) => { bad.history[0].moves = 400; },
    (bad) => { bad.history = Array(101).fill(bad.history[0]); },
    (bad) => { [bad.history[0].stock[0], bad.history[0].stock[1]] = [bad.history[0].stock[1], bad.history[0].stock[0]]; },
  ];
  for (const corrupt of corruptions) {
    const bad = copy(state);
    corrupt(bad);
    assert.equal(restoreSolitaire(bad), null, corrupt.toString());
  }
  assert.equal(restoreSolitaire('{'), null);
  assert.equal(restoreSolitaire(null), null);
  assert.equal(restoreSolitaire('x'.repeat(800_000)), null);
});

test('restore enforces alternating descending face-up sequences and foundation suit order', () => {
  const wrongColor = position({ tableau: [up('8h', '7d')] });
  const wrongRank = position({ tableau: [up('8h', '6c')] });
  const wrongBoundary = position({ tableau: [[...up('8h'), { card: '7c', faceUp: false }]] });
  const wrongBase = position({ foundations: [['As', '2h']] });
  const wrongAce = position({ foundations: [['2s']] });
  const duplicateSuit = position({ foundations: [['As'], ['Ah']] });
  duplicateSuit.foundations[1] = ['As'];
  for (const bad of [wrongColor, wrongRank, wrongBoundary, wrongBase, wrongAce, duplicateSuit]) {
    assert.equal(restoreSolitaire(bad), null);
  }
});
