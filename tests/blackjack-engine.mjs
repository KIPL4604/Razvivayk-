import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBlackjack, total, legalBlackjack, actBlackjack, restoreBlackjack, viewBlackjack,
} from '../webapp/frontend/js/cards/blackjack.mjs';

const deck = () => [...'shdc'].flatMap((suit) => [...'A23456789TJQK'].map((rank) => rank + suit));
const clone = (value) => JSON.parse(JSON.stringify(value));
function fixture(player, dealer, next = []) {
  const used = new Set([...player, ...dealer, ...next]);
  return {
    version: 1, game: 'blackjack', seed: 1, rngState: 1, status: 'playing',
    player: [...player], dealer: [...dealer], stock: [...next, ...deck().filter((card) => !used.has(card))],
    wager: 1, payout: 0, result: '', actions: player.length - 2,
  };
}
function findDeal(predicate) {
  for (let seed = 0; seed < 20000; seed += 1) {
    const state = createBlackjack({ seed });
    if (predicate(state)) return state;
  }
  assert.fail('The deterministic seed range must include the requested deal.');
}
function conserved(state) {
  const cards = [...state.player, ...state.dealer, ...state.stock];
  assert.equal(cards.length, 52);
  assert.equal(new Set(cards).size, 52);
  assert.deepEqual([...cards].sort(), deck().sort());
}

test('aces retain an 11 only when safe; blackjack requires exactly two cards', () => {
  assert.deepEqual(total(['As', 'Kh']), { value: 21, soft: true, blackjack: true, bust: false });
  assert.deepEqual(total(['As', 'Ah', '9s']), { value: 21, soft: true, blackjack: false, bust: false });
  assert.deepEqual(total(['As', 'Ah', '9s', 'Kd']), { value: 21, soft: false, blackjack: false, bust: false });
  assert.deepEqual(total(['As', 'Ah', 'Ac', '8s']), { value: 21, soft: true, blackjack: false, bust: false });
  assert.deepEqual(total(['Ks', 'Qh', '2d']), { value: 22, soft: false, blackjack: false, bust: true });
  assert.deepEqual(total([]), { value: 0, soft: false, blackjack: false, bust: false });
  assert.throws(() => total(['10s']), TypeError);
  assert.throws(() => total(null), TypeError);
});

test('a seeded single deck is reproducible, deals four cards, and supports uint32 edges', () => {
  for (const seed of [0, 1, 932849, 0xffffffff]) {
    const first = createBlackjack({ seed });
    assert.deepEqual(first, createBlackjack({ seed }));
    assert.equal(first.player.length, 2);
    assert.equal(first.dealer.length, 2);
    assert.equal(first.stock.length, 48);
    conserved(first);
  }
  assert.notDeepEqual(createBlackjack({ seed: 1 }).stock, createBlackjack({ seed: 2 }).stock);
});

test('naturals settle on the deal: 3:2, dealer loss, and a push when both have blackjack', () => {
  const won = findDeal((state) => total(state.player).blackjack && !total(state.dealer).blackjack);
  assert.equal(won.status, 'won');
  assert.equal(won.payout, 1.5);
  assert.equal(won.actions, 0);
  assert.deepEqual(legalBlackjack(won), []);
  const lost = findDeal((state) => !total(state.player).blackjack && total(state.dealer).blackjack);
  assert.equal(lost.status, 'lost');
  assert.equal(lost.payout, -1);
  const push = findDeal((state) => total(state.player).blackjack && total(state.dealer).blackjack);
  assert.equal(push.status, 'draw');
  assert.equal(push.payout, 0);
});

test('dealer stands on both hard and soft 17', () => {
  for (const dealer of [['As', '6c'], ['9s', '8c']]) {
    const state = fixture(['9h', '8h'], dealer, ['Kd']);
    const remaining = [...state.stock];
    assert.equal(actBlackjack(state, { type: 'stand' }), true);
    assert.equal(state.status, 'draw');
    assert.equal(state.payout, 0);
    assert.equal(state.dealer.length, 2);
    assert.deepEqual(state.stock, remaining);
  }
});

test('dealer hits below 17 and a drawn player 21 is an ordinary push against dealer 21', () => {
  const state = fixture(['5s', '6h'], ['Td', '6c'], ['Th', '5c']);
  assert.equal(actBlackjack(state, { type: 'hit' }), true);
  assert.equal(state.status, 'draw');
  assert.equal(state.payout, 0);
  assert.equal(total(state.player).blackjack, false);
  assert.equal(total(state.dealer).value, 21);
  assert.equal(state.actions, 1);
  assert.equal(state.player.length, 3);
  assert.equal(state.dealer.length, 3);
});

test('double is available only as the first decision and draws exactly one card', () => {
  const state = fixture(['5s', '6h'], ['9d', '8c'], ['Th', '4s']);
  assert.deepEqual(legalBlackjack(state), [{ type: 'hit' }, { type: 'stand' }, { type: 'double' }]);
  assert.equal(actBlackjack(state, { type: 'double' }), true);
  assert.equal(state.wager, 2);
  assert.equal(state.player.length, 3);
  assert.equal(state.dealer.length, 2);
  assert.equal(state.stock[0], '4s');
  assert.equal(state.status, 'won');
  assert.equal(state.payout, 2);
  assert.equal(state.actions, 1);
  const afterHit = fixture(['2s', '3h'], ['9d', '8c'], ['4h']);
  assert.equal(actBlackjack(afterHit, { type: 'hit' }), true);
  assert.deepEqual(legalBlackjack(afterHit), [{ type: 'hit' }, { type: 'stand' }]);
  const snapshot = clone(afterHit);
  assert.equal(actBlackjack(afterHit, { type: 'double' }), false);
  assert.deepEqual(afterHit, snapshot);
});

test('player bust ends the hand immediately; a doubled bust costs two units', () => {
  for (const type of ['hit', 'double']) {
    const state = fixture(['9s', '8h'], ['6d', '9c'], ['Kc']);
    assert.equal(actBlackjack(state, { type }), true);
    assert.equal(state.status, 'lost');
    assert.equal(state.payout, type === 'double' ? -2 : -1);
    assert.equal(state.dealer.length, 2);
    assert.equal(state.player.length, 3);
    conserved(state);
  }
});

test('dealer bust, ordinary win, ordinary loss, and push pay the correct net units', () => {
  const examples = [
    { player: ['Ts', '8h'], dealer: ['6d', '9c'], next: ['Kc'], status: 'won', payout: 1 },
    { player: ['Ts', '9h'], dealer: ['Td', '8c'], next: [], status: 'won', payout: 1 },
    { player: ['Ts', '7h'], dealer: ['Td', '8c'], next: [], status: 'lost', payout: -1 },
    { player: ['Ts', '8h'], dealer: ['Td', '8c'], next: [], status: 'draw', payout: 0 },
  ];
  for (const example of examples) {
    const state = fixture(example.player, example.dealer, example.next);
    assert.equal(actBlackjack(state, { type: 'stand' }), true);
    assert.equal(state.status, example.status);
    assert.equal(state.payout, example.payout);
    conserved(state);
  }
});

test('invalid actions and actions after settlement leave the state unchanged', () => {
  const state = fixture(['9s', '8h'], ['6d', '9c'], ['Kc']);
  for (const action of [null, 'hit', {}, { type: 'split' }, { type: 'insurance' }]) {
    const before = clone(state);
    assert.equal(actBlackjack(state, action), false);
    assert.deepEqual(state, before);
  }
  actBlackjack(state, { type: 'stand' });
  const settled = clone(state);
  for (const type of ['hit', 'stand', 'double']) assert.equal(actBlackjack(state, { type }), false);
  assert.deepEqual(state, settled);
});

test('the display view never returns a live dealer hole card, deck, or shuffle seed', () => {
  const state = findDeal((candidate) => candidate.status === 'playing');
  const view = viewBlackjack(state);
  assert.deepEqual(view.dealer, [state.dealer[0], null]);
  assert.deepEqual(view.dealerTotal, total([state.dealer[0]]));
  for (const key of ['stock', 'seed', 'rngState']) assert.equal(Object.hasOwn(view, key), false);
  assert.deepEqual(view.playerTotal, total(state.player));
  assert.deepEqual(view.legalActions, legalBlackjack(state));
  view.player[0] = 'not-a-card';
  view.dealer[0] = 'not-a-card';
  assert.notEqual(state.player[0], 'not-a-card');
  assert.notEqual(state.dealer[0], 'not-a-card');
  actBlackjack(state, { type: 'stand' });
  assert.deepEqual(viewBlackjack(state).dealer, state.dealer);
  assert.deepEqual(viewBlackjack(state).dealerTotal, total(state.dealer));
});

test('1000 seeded hands conserve all cards and round-trip across all decisions and outcomes', () => {
  const outcomes = new Set();
  for (let seed = 0; seed < 1000; seed += 1) {
    const state = createBlackjack({ seed });
    let decisions = 0;
    while (state.status === 'playing') {
      conserved(state);
      assert.deepEqual(restoreBlackjack(clone(state)), state);
      const actions = legalBlackjack(state);
      assert.ok(actions.length >= 2);
      let type;
      if (seed % 5 === 0 && decisions === 0) type = 'double';
      else if (seed % 5 === 1) type = 'stand';
      else type = total(state.player).value < (seed % 5 === 2 ? 20 : 17) ? 'hit' : 'stand';
      assert.equal(actBlackjack(state, { type }), true);
      decisions += 1;
      assert.ok(decisions < 22);
    }
    conserved(state);
    assert.deepEqual(restoreBlackjack(clone(state)), state);
    assert.deepEqual(legalBlackjack(state), []);
    assert.ok([-2, -1, 0, 1, 1.5, 2].includes(state.payout));
    outcomes.add(state.status);
  }
  assert.deepEqual([...outcomes].sort(), ['draw', 'lost', 'won']);
});

test('restore returns an independent clone and rejects corrupt or impossible saved states', () => {
  const original = findDeal((state) => state.status === 'playing');
  const restored = restoreBlackjack(original);
  assert.deepEqual(restored, original);
  assert.notEqual(restored, original);
  assert.notEqual(restored.player, original.player);
  const changes = [
    (state) => { state.version = 2; },
    (state) => { state.game = 'poker'; },
    (state) => { state.seed = -1; },
    (state) => { state.rngState = 1.5; },
    (state) => { state.status = 'playing-forever'; },
    (state) => { state.player[0] = '10s'; },
    (state) => { state.player[0] = state.player[1]; },
    (state) => { state.stock.pop(); },
    (state) => { state.dealer.push(state.stock.shift()); },
    (state) => { state.payout = 1.5; },
    (state) => { state.wager = 2; },
    (state) => { state.actions = 1000000; },
    (state) => { state.result = 'forged'; },
    (state) => { state.player.reverse(); },
    (state) => { [state.stock[0], state.stock[1]] = [state.stock[1], state.stock[0]]; },
    (state) => { state.status = 'won'; state.payout = 1; },
  ];
  for (const change of changes) {
    const raw = clone(original);
    change(raw);
    assert.equal(restoreBlackjack(raw), null);
  }
  for (const raw of [null, undefined, [], 'blackjack', {}, { player: new Array(100000) }]) {
    assert.equal(restoreBlackjack(raw), null);
  }
});
