import assert from 'node:assert/strict';
import test from 'node:test';
import { createDurak, legalDurak, actDurak, botDurak, restoreDurak } from '../webapp/frontend/js/cards/durak.mjs';

const ranks = '6789TJQKA';
const suits = 'shdc';
const deck = [...suits].flatMap((suit) => [...ranks].map((rank) => rank + suit));
const clone = (value) => structuredClone(value);
const cardsIn = (state) => [
  ...state.hands.flat(), ...state.stock, ...state.discard,
  ...state.table.flatMap(({ attack, defense }) => defense ? [attack, defense] : [attack]),
];
const assertConserved = (state) => {
  assert.equal(cardsIn(state).length, 36);
  assert.deepEqual([...cardsIn(state)].sort(), [...deck].sort());
  assert.ok(restoreDurak(state), 'every transition must remain restorable');
};
const fixture = ({ hands, table = [], stock = [], attacker = 0, phase = table.length ? 'defend' : 'attack', ...rest }) => {
  const used = [...hands.flat(), ...stock, ...table.flatMap(({ attack, defense }) => defense ? [attack, defense] : [attack])];
  const state = {
    version: 1, game: 'durak', seed: 23, rngState: 23,
    status: 'playing', hands: clone(hands), stock: [...stock], trump: 's', trumpCard: 'As',
    discard: deck.filter((card) => !used.includes(card)), table: clone(table), attacker,
    turn: phase === 'defend' ? 1 - attacker : attacker, phase,
    limit: Math.min(6, hands[1 - attacker].length + table.filter((pair) => pair.defense).length),
    round: 2, message: 'Проверочная партия.', ...rest,
  };
  assertConserved(state);
  return state;
};
const play = (state, action) => {
  assert.equal(actDurak(state, action), true, JSON.stringify(action));
  assertConserved(state);
};

test('seeded deal is reproducible, sorted, conserves the full deck and leaves the open trump last', () => {
  for (const seed of [0, 1, 17, 2 ** 32 - 1]) {
    const state = createDurak({ seed });
    assert.deepEqual(state, createDurak({ seed }));
    assert.equal(state.hands[0].length, 6);
    assert.equal(state.hands[1].length, 6);
    assert.equal(state.stock.length, 24);
    assert.equal(state.trumpCard, state.stock.at(-1));
    assert.equal(state.trump, state.trumpCard[1]);
    const trumps = state.hands.flat().filter((card) => card[1] === state.trump);
    if (trumps.length) {
      const lowest = trumps.sort((a, b) => ranks.indexOf(a[0]) - ranks.indexOf(b[0]))[0];
      assert.ok(state.hands[state.attacker].includes(lowest));
    }
    for (const hand of state.hands) {
      const values = hand.map((card) => (card[1] === state.trump ? 100 : 0) + ranks.indexOf(card[0]) * 4 + suits.indexOf(card[1]));
      assert.deepEqual(values, [...values].sort((a, b) => a - b));
    }
    assertConserved(state);
  }
  assert.notDeepEqual(createDurak({ seed: 1 }).hands, createDurak({ seed: 2 }).hands);
});

test('same-suit higher cards and trumps defend; invalid actions preserve the entire state', () => {
  const state = fixture({ hands: [['7h', '9d', 'Kh'], ['6h', '8h', '6s', 'Ad']], table: [{ attack: '9h', defense: null }] });
  assert.deepEqual(legalDurak(state), [{ type: 'defend', card: '6s', index: 0 }, { type: 'take' }]);
  assert.deepEqual(legalDurak(state, 0), []);
  for (const action of [
    { type: 'defend', card: '8h', index: 0 }, { type: 'defend', card: 'Ad', index: 0 },
    { type: 'defend', card: '6s', index: 1 }, { type: 'attack', card: '7h' },
    { type: 'pass' }, { type: 'defend', card: 'As', index: 0 }, null,
  ]) {
    const before = clone(state);
    assert.equal(actDurak(state, action), false);
    assert.deepEqual(state, before);
  }
  play(state, { type: 'defend', card: '6s', index: 0 });
  assert.equal(state.phase, 'throw');
  assert.equal(state.turn, 0);
  const trump = fixture({ hands: [['6h', '8h'], ['6s', 'Ts', 'Ah']], table: [{ attack: '9s', defense: null }] });
  assert.deepEqual(legalDurak(trump), [{ type: 'defend', card: 'Ts', index: 0 }, { type: 'take' }]);
});

test('throws can match either attack or defense ranks; a beaten bout changes attacker', () => {
  const state = fixture({ hands: [['6h', '7c', '8d', 'Kh'], ['7h', '8c', '9d', 'Qc']] });
  play(state, { type: 'attack', card: '6h' });
  play(state, { type: 'defend', card: '7h', index: 0 });
  assert.deepEqual(legalDurak(state), [{ type: 'attack', card: '7c' }, { type: 'pass' }]);
  play(state, { type: 'attack', card: '7c' });
  play(state, { type: 'defend', card: '8c', index: 1 });
  assert.deepEqual(legalDurak(state), [{ type: 'attack', card: '8d' }, { type: 'pass' }]);
  play(state, { type: 'pass' });
  assert.equal(state.attacker, 1);
  assert.equal(state.turn, 1);
  assert.equal(state.table.length, 0);
  assert.equal(state.discard.length, 32);
});

test('taking allows extra matching throws, then pickup and attacker-first refilling', () => {
  const state = fixture({
    hands: [['6h', '7h', '8d', 'Kh'], ['7c', '8c', '9d', 'Qc']],
    stock: ['6c', 'Tc', 'As'], table: [{ attack: '6d', defense: null }],
  });
  play(state, { type: 'take' });
  assert.equal(state.phase, 'taking');
  assert.equal(state.turn, 0);
  assert.deepEqual(legalDurak(state), [{ type: 'attack', card: '6h' }, { type: 'pass' }]);
  play(state, { type: 'attack', card: '6h' });
  assert.equal(state.phase, 'taking');
  play(state, { type: 'pass' });
  assert.equal(state.round, 3);
  assert.equal(state.attacker, 0);
  assert.equal(state.phase, 'attack');
  assert.equal(state.stock.length, 0);
  assert.ok(state.hands[0].includes('6c') && state.hands[0].includes('Tc') && state.hands[0].includes('As'));
  assert.ok(state.hands[1].includes('6h') && state.hands[1].includes('6d'));
  assert.equal(state.hands[0].length, 6);
  assert.equal(state.hands[1].length, 6);
});

test('bout limit is the defender starting hand, no more than six; reaching it completes pickup', () => {
  const state = fixture({ hands: [['6h', '6d', '7h', '8h'], ['7c', '8c']] });
  assert.equal(state.limit, 2);
  play(state, { type: 'attack', card: '6h' });
  play(state, { type: 'take' });
  play(state, { type: 'attack', card: '6d' });
  assert.equal(state.phase, 'attack');
  assert.equal(state.round, 3);
  assert.equal(state.hands[1].length, 4);
  assert.equal(state.attacker, 0);
  const capped = fixture({
    hands: [['6h', '7c', '8d', '9c', 'Td', 'Jc', 'Qc', 'Kh'], ['7h', '8c', '9d', 'Tc', 'Jd', 'Kc']],
  });
  assert.equal(capped.limit, 6);
  const pairs = [['6h', '7h'], ['7c', '8c'], ['8d', '9d'], ['9c', 'Tc'], ['Td', 'Jd'], ['Jc', 'Kc']];
  for (const [index, [attack, defense]] of pairs.entries()) {
    play(capped, { type: 'attack', card: attack });
    play(capped, { type: 'defend', card: defense, index });
  }
  assert.deepEqual(legalDurak(capped), [{ type: 'pass' }]);
  const before = clone(capped);
  assert.equal(actDurak(capped, { type: 'attack', card: 'Kh' }), false);
  assert.deepEqual(capped, before);
  play(capped, { type: 'pass' });
  assert.equal(capped.status, 'lost');
});

test('successful defense refills the original attacker first, then switches attacker', () => {
  const state = fixture({
    hands: [['9h', 'Th', 'Jh'], ['8h', '9c', 'Tc']], stock: ['6c', '7c', 'As'],
    table: [{ attack: '6h', defense: null }],
  });
  play(state, { type: 'defend', card: '8h', index: 0 });
  play(state, { type: 'pass' });
  assert.equal(state.attacker, 1);
  assert.equal(state.turn, 1);
  assert.equal(state.hands[0].length, 6);
  assert.equal(state.hands[1].length, 2);
  assert.deepEqual(state.stock, []);
  assert.ok(state.hands[0].includes('As'));
  assert.ok(state.discard.includes('6h') && state.discard.includes('8h'));
});

test('an empty attacking hand wins only after the bout resolves, and refilling postpones the result', () => {
  const state = fixture({ hands: [['6h'], ['7h', '8d', '9d']] });
  play(state, { type: 'attack', card: '6h' });
  assert.equal(state.status, 'playing');
  play(state, { type: 'take' });
  assert.equal(state.status, 'playing');
  play(state, { type: 'pass' });
  assert.equal(state.status, 'won');
  assert.deepEqual(legalDurak(state), []);
  assert.equal(botDurak(state), null);
  const refill = fixture({ hands: [['6h'], ['7h', '8d']], stock: ['As'] });
  play(refill, { type: 'attack', card: '6h' });
  play(refill, { type: 'take' });
  play(refill, { type: 'pass' });
  assert.equal(refill.status, 'playing');
  assert.deepEqual(refill.hands[0], ['As']);
});

test('both last cards defended is a real draw; the sole empty defender wins', () => {
  const draw = fixture({ hands: [['6h'], ['7h']] });
  play(draw, { type: 'attack', card: '6h' });
  play(draw, { type: 'defend', card: '7h', index: 0 });
  assert.equal(draw.status, 'playing');
  assert.deepEqual(legalDurak(draw), [{ type: 'pass' }]);
  play(draw, { type: 'pass' });
  assert.equal(draw.status, 'draw');
  const lost = fixture({ hands: [['6h', '8d', '9d'], ['7h']] });
  play(lost, { type: 'attack', card: '6h' });
  play(lost, { type: 'defend', card: '7h', index: 0 });
  play(lost, { type: 'pass' });
  assert.equal(lost.status, 'lost');
});

test('restore clones known fields and rejects corrupt, impossible and incomplete snapshots', () => {
  const initial = createDurak({ seed: 31 });
  const restored = restoreDurak(JSON.parse(JSON.stringify(initial)));
  assert.deepEqual(restored, initial);
  restored.hands[0].pop();
  assert.equal(initial.hands[0].length, 6);
  const corruptions = [
    (state) => { state.version = 2; }, (state) => { state.game = 'poker'; },
    (state) => { state.seed = -1; }, (state) => { state.rngState = 0.5; },
    (state) => { state.hands[0][0] = state.hands[0][1]; },
    (state) => { state.hands[0][0] = '2h'; }, (state) => { state.stock.pop(); },
    (state) => { [state.stock[0], state.stock[23]] = [state.stock[23], state.stock[0]]; },
    (state) => { state.trump = 'x'; }, (state) => { state.trumpCard = 'As'; state.trump = 'h'; },
    (state) => { state.turn = 1 - state.attacker; }, (state) => { state.phase = 'defend'; },
    (state) => { state.limit = 7; }, (state) => { state.limit = 5; },
    (state) => { state.round = 0; }, (state) => { state.message = 13; },
    (state) => { state.status = 'won'; }, (state) => { state.table = [{ attack: '6h', defense: '6d' }]; },
  ];
  for (const damage of corruptions) {
    const bad = clone(initial);
    damage(bad);
    assert.equal(restoreDurak(bad), null, damage.toString());
  }
  for (const raw of [null, [], {}, 'not a snapshot']) assert.equal(restoreDurak(raw), null);
});

test('restore rejects invalid defenses, new throw ranks and phase corruption even with all 36 unique cards', () => {
  const defended = fixture({
    hands: [['8d', 'Kh'], ['Th', 'Jh']],
    table: [{ attack: '6h', defense: '7h' }], phase: 'throw',
  });
  const wrongSuit = clone(defended);
  [wrongSuit.table[0].defense, wrongSuit.hands[0][0]] = [wrongSuit.hands[0][0], wrongSuit.table[0].defense];
  assert.equal(new Set(cardsIn(wrongSuit)).size, 36);
  assert.equal(restoreDurak(wrongSuit), null);
  for (const phase of ['defend', 'taking', 'attack']) assert.equal(restoreDurak({ ...defended, phase }), null);
  const thrown = fixture({
    hands: [['8c', 'Kh'], ['Th', 'Jh']],
    table: [{ attack: '6h', defense: '7h' }, { attack: '7c', defense: '9c' }], phase: 'throw',
  });
  [thrown.table[1].attack, thrown.hands[0][0]] = [thrown.hands[0][0], thrown.table[1].attack];
  assert.equal(new Set(cardsIn(thrown)).size, 36);
  assert.equal(restoreDurak(thrown), null);
});

test('bot uses only its cards and public information, regardless of hidden card identities', () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const state = createDurak({ seed });
    state.attacker = 1;
    state.turn = 1;
    state.limit = 6;
    const changed = clone(state);
    [changed.hands[0][0], changed.stock[0]] = [changed.stock[0], changed.hands[0][0]];
    changed.stock.splice(0, changed.stock.length - 1, ...changed.stock.slice(0, -1).reverse());
    assertConserved(changed);
    assert.deepEqual(botDurak(changed), botDurak(state));
    assert.ok(legalDurak(state).some((action) => JSON.stringify(action) === JSON.stringify(botDurak(state))));
  }
  const phases = new Set();
  for (let seed = 0; seed < 8; seed += 1) {
    const state = createDurak({ seed });
    for (let move = 0; state.status === 'playing'; move += 1) {
      assert.ok(move < 1500);
      if (state.turn === 1 && state.stock.length > 1 && state.hands[0].length) {
        const changed = clone(state);
        [changed.hands[0][0], changed.stock[0]] = [changed.stock[0], changed.hands[0][0]];
        assertConserved(changed);
        assert.deepEqual(botDurak(changed), botDurak(state), state.phase);
        phases.add(state.phase);
      }
      const legal = legalDurak(state);
      const action = state.turn === 1 ? botDurak(state)
        : state.phase === 'defend' && move % 3 === 0 ? { type: 'take' } : legal[0];
      play(state, action);
    }
  }
  assert.deepEqual([...phases].sort(), ['attack', 'defend', 'taking', 'throw']);
});

test('seeded complete matches conserve 36 cards, restore every turn and finish without an artificial draw', () => {
  let played = 0;
  for (let seed = 0; seed < 160; seed += 1) {
    const state = createDurak({ seed });
    for (let move = 0; state.status === 'playing'; move += 1) {
      assert.ok(move < 1500, `seed ${seed} did not finish`);
      const legal = legalDurak(state);
      assert.ok(legal.length, `seed ${seed}, phase ${state.phase} has no action`);
      let action;
      if (state.turn === 1) action = botDurak(state);
      else {
        // A deterministic, legal human policy with occasional voluntary pickups.
        action = state.phase === 'defend' && (move + seed) % 11 === 0
          ? legal.find((candidate) => candidate.type === 'take') : legal[0];
      }
      assert.ok(action);
      play(state, action);
      played += 1;
    }
    assert.equal(state.stock.length, 0);
    assert.equal(state.table.length, 0);
    if (state.status === 'draw') assert.deepEqual(state.hands, [[], []]);
    else assert.equal(state.hands[state.status === 'won' ? 0 : 1].length, 0);
  }
  assert.ok(played > 5000);
});
