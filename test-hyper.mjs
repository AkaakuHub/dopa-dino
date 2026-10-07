import assert from 'node:assert/strict';
import {
  HyperEconomy, HYPER_VERSION, HYPER_MAX_RANK, HYPER_MAX_FUEL,
  HYPER_MAX_AMPLIFIER, HYPER_MAX_SEQUENCE, HYPER_MILESTONES,
  FUKASETSU_EXPONENT, cleanHyperSave, canonicalAt, compareHyper,
  normalizeHyper, formatHyper
} from './dist/hyper.js';

function finiteJSON(value) {
  if (typeof value === 'number') assert(Number.isFinite(value) && Number.isSafeInteger(value), `unsafe scalar ${value}`);
  else if (Array.isArray(value)) value.forEach(finiteJSON);
  else if (value && typeof value === 'object') Object.values(value).forEach(finiteJSON);
}
const pulse = (economy, sequence, options) => economy.pulse({ source: 'input', sequence }, options);

// Small exact evaluations establish aliases; no giant expression is evaluated.
assert.equal(2n ** (2n ** (2n ** 2n)), 65536n);
assert.equal((7n * 2n ** 122n).toString(), FUKASETSU_EXPONENT);
assert.equal(compareHyper(canonicalAt(0), { kind: 'integer', value: '65536' }), 0);
assert.equal(compareHyper(canonicalAt(0), { kind: 'arrows', base: 2, arrows: 3, right: 3 }), 0, 'more arrows need not increase the value');
assert.equal(compareHyper(canonicalAt(3), { kind: 'power', base: 2, exponent: 65536 }), 0);
assert.equal(compareHyper(canonicalAt(8), { kind: 'arrows', base: 2, arrows: 3, right: 4 }), 0);
assert.equal(compareHyper(canonicalAt(10), { kind: 'arrows', base: 3, arrows: 4, right: 3 }), 0);
assert.equal(compareHyper(canonicalAt(16), { kind: 'iterate-g', iterations: 0 }), 0);
assert.equal(compareHyper(canonicalAt(20), { kind: 'graham', index: { kind: 'graham', index: 64 } }), 0);
assert.equal(formatHyper(canonicalAt(4)), '10^(7×2^122)');
assert.equal(formatHyper(canonicalAt(16)), 'G = g_64');
assert.equal(formatHyper(canonicalAt(21)), 'B_2');
assert.equal(formatHyper(canonicalAt(1_000_000)), 'B_999,981');

// Every comparison is constrained to the certified families. Arbitrary ASTs,
// display names and raw numeric estimates cannot masquerade as huge values.
for (let a = 0; a < 70; a++) for (let b = 0; b < 70; b++) {
  assert.equal(compareHyper(canonicalAt(a), canonicalAt(b)), Math.sign(a - b));
}
assert.equal(compareHyper({ kind: 'tetration', base: 2, height: 7 }, canonicalAt(7)), -1);
assert.equal(compareHyper({ kind: 'graham', index: HYPER_MAX_RANK }, canonicalAt(20)), -1);
for (const unsupported of [null, 1e100, 'G', {}, { rank: 1000 }, { kind: 'graham', index: Infinity }, { kind: 'graham', index: 1.5 }, { kind: 'graham', index: HYPER_MAX_RANK + 1 }, { kind: 'tetration', base: 10, height: 10 }, { kind: 'arrows', base: 2, arrows: 100, right: 2 }, { kind: 'power', base: 10, exponent: 69 }]) {
  assert.equal(compareHyper(unsupported, canonicalAt(16)), null);
  assert.equal(compareHyper(unsupported, unsupported), null);
  assert.equal(normalizeHyper(unsupported), null);
}
const cycle = { kind: 'graham' }; cycle.index = cycle;
assert.equal(compareHyper(cycle, canonicalAt(0)), null);
const throwing = { get kind() { throw new Error('invalid AST'); } };
assert.equal(compareHyper(throwing, canonicalAt(0)), null);
assert.equal(normalizeHyper(throwing), null);
console.log('PASS: exact small aliases, 不可説不可説転 exponent, certified ordering through G64/B_k, unsupported comparisons rejected.');

// Exact affordable / unaffordable boundary, real deduction and one-step rewrite.
const h = new HyperEconomy();
assert.equal(h.fuel, 0);
assert.equal(h.rank, 0);
assert.equal(h.offer().cost, 4);
assert.equal(h.offer().actionsNeeded, 4);
assert.equal(h.buy(), null);
for (let i = 1; i <= 3; i++) assert.equal(pulse(h, i).amount, 1);
assert.equal(h.offer().canBuy, false);
assert.equal(h.buy(), null);
assert.equal(h.fuel, 3);
pulse(h, 4);
assert.equal(h.offer().canBuy, true);
const first = h.buy();
assert.equal(first.before, 4);
assert.equal(first.cost, 4);
assert.equal(first.fuel, 0);
assert.equal(first.rank, 1);
assert.equal(compareHyper(first.previousPower, first.power), -1);
assert.equal(h.integrationBonus, 3);
assert.equal(h.offer('amplifier').locked, false);
assert.equal(h.buy('bad-id'), null);
assert.equal(h.offer('bad-id'), null);

// The huge gate actually affects purchasing: even ample fuel cannot buy an
// amplifier until the canonical M >= 10^68 gate is satisfied.
const gated = new HyperEconomy({ rank: 0, fuel: HYPER_MAX_FUEL });
assert.equal(gated.offer('amplifier').locked, true);
assert.equal(gated.buy('amplifier'), null);
gated.prestige();
const chargeBefore = gated.chargePerAction;
const walletBefore = gated.fuel;
const boost = gated.buy('amplifier');
assert.equal(boost.cost, 6);
assert.equal(gated.fuel, walletBefore - 6);
assert.equal(gated.chargePerAction, chargeBefore + 1);
assert.equal(gated.integrationBonus, 5);
assert.equal(pulse(gated, 1, { strength: 4 }).amount, 8);
const scorePower = gated.power;
const p = pulse(gated, 2);
assert.equal(compareHyper(p.power, scorePower), 0, 'pulse produces fuel, never invents huge-value arithmetic');
assert.equal(gated.buy('amplifier').id, 'amplifier');
console.log('PASS: exact affordability and fuel deduction, meaningful magnitude unlock gate, rank rewrites, real booster and integration effects.');

// Only active actions count. Invalid / hidden / idle attempts do not consume
// receipt IDs; strength is bounded at four and remains exact integer arithmetic.
const active = new HyperEconomy();
for (const strength of [0, -1, NaN, Infinity, '4', .5]) assert.equal(pulse(active, 1, { strength }), null);
assert.equal(pulse(active, 1, { active: false }), null);
assert.equal(pulse(active, 1, { active: 'true' }), null);
assert.equal(active.fuel, 0);
assert.equal(pulse(active, 1, { strength: 1000 }).amount, 4);
assert.equal(active.fuel, 4);
assert.equal(typeof active.tick, 'undefined', 'there is no timer/idle producer');
assert.equal(pulse(active, 1), null);
assert.equal(pulse(active, 0), null);
assert.equal(active.pulse({ source: 'unknown', sequence: 1 }), null);
assert.equal(active.pulse({ source: 'round', sequence: 1 }, { strength: 4 }).amount, 4, 'independent round lane survives newer input events');
for (let i = 2; i <= 300; i++) pulse(active, i);
assert.equal(pulse(active, 1), null, 'monotonic duplicate protection is permanent, beyond receipt window');
const restored = new HyperEconomy(JSON.parse(JSON.stringify(active.snapshot())));
assert.equal(pulse(restored, 1), null);
assert.equal(pulse(restored, 300), null);
assert.equal(restored.pulse({ source: 'round', sequence: 1 }, { strength: 4 }), null);
assert.equal(pulse(restored, 301).amount, 1);
assert.equal(restored.pulse('clear-once').amount, 1);
assert.equal(restored.pulse('clear-once'), null);
assert.equal(new HyperEconomy(restored.snapshot()).pulse('clear-once'), null);
console.log('PASS: zero idle/hidden/invalid reward, bounded clear bonus, persisted exact-once monotonic receipts and string-window compatibility.');

// Save validation, provisional migration, finite serialization, independent
// state copies and future-version preservation rather than destructive writes.
assert.equal(cleanHyperSave(null).version, HYPER_VERSION);
const invalid = cleanHyperSave({ rank: Infinity, fuel: NaN, amplifier: -10, actions: '10', highWater: { input: Infinity, runner: -4 }, receipts: ['', 5, 'ok', 'ok', 'x'.repeat(101)] });
assert.deepEqual(invalid, { version: 1, rank: 0, fuel: 0, amplifier: 0, actions: 0, highWater: { input: 0, runner: 0, round: 0 }, receipts: ['ok'] });
const capped = cleanHyperSave({ rank: 1e100, fuel: 1e100, amplifier: 1e100, actions: 1e100, highWater: { input: 1e100 } });
assert.equal(capped.rank, HYPER_MAX_RANK);
assert.equal(capped.fuel, HYPER_MAX_FUEL);
assert.equal(capped.amplifier, HYPER_MAX_AMPLIFIER);
assert.equal(capped.actions, HYPER_MAX_SEQUENCE);
assert.equal(capped.highWater.input, HYPER_MAX_SEQUENCE);
finiteJSON(capped);
const migrated = new HyperEconomy({ version: 0, rank: 4, charge: 17, boosts: 3 });
assert.equal(migrated.fuel, 17);
assert.equal(migrated.amplifier, 3);
assert.equal(migrated.rank, 4);
assert.equal(migrated.snapshot().version, 1);
assert.equal(new HyperEconomy({ astral: { currency: { layer: 100, mag: 100 } } }).fuel, 0, 'legacy approximate currency cannot create symbolic progress');
const futurePayload = { version: 999, rank: 16, fuel: 999, unknown: { keep: 'unchanged' } };
const futureBefore = JSON.stringify(futurePayload);
const future = new HyperEconomy(futurePayload);
assert.equal(future.readOnly, true);
assert.equal(future.snapshot(), null);
assert.equal(future.buy(), null);
assert.equal(future.pulse('future'), null);
assert.equal(JSON.stringify(futurePayload), futureBefore);
const snapshot = h.snapshot();
snapshot.rank = 99;
snapshot.highWater.input = 99;
assert.equal(h.rank, 1);
assert.equal(h.snapshot().highWater.input, 4);
const expressionCopy = h.power; expressionCopy.exponent = '999';
assert.equal(h.format(), '10^68');
const info = h.milestone; info.expression.exponent = '999';
assert.equal(h.format(), '10^68');
assert.equal(HYPER_MILESTONES[1].expression.exponent, '68');
console.log('PASS: schema migration, strict validation/caps, independent expression copies, no approximate import, future payload preserved.');

// Fast active pacing: at an unboosted stage, every advance is earned with
// 4–6 deliberate pulses, about 0.88–1.32 s in the UI's 220 ms held burst.
// Reaching G64 is 17 explicit milestones, not a single hidden rename.
const pace = new HyperEconomy();
let sequence = 0;
for (let rank = 0; rank < 80; rank++) {
  assert.equal(pace.rank, rank);
  const offer = pace.offer();
  let taps = 0;
  while (!pace.offer().canBuy) { pulse(pace, ++sequence); taps++; assert(taps <= 6); }
  assert(taps >= 4);
  assert(taps * .22 <= 1.32);
  const beforePower = pace.power;
  const result = pace.prestige();
  assert.equal(compareHyper(beforePower, result.power), -1);
  assert.equal(result.before - result.cost, result.fuel);
  assert.equal(result.cost, offer.cost);
}
for (const rank of [0, 1, 4, 16, 100, 65536, HYPER_MAX_RANK - 1]) {
  const economy = new HyperEconomy({ rank });
  assert(economy.offer().actionsNeeded >= 4 && economy.offer().actionsNeeded <= 6);
}

// Bounded stress near both ends: expensive mathematical values have O(1)
// serialization and arithmetic; no loop expands a tower or the Graham chain.
const stress = new HyperEconomy();
for (let i = 1; i <= 50_000; i++) {
  pulse(stress, i, { strength: 4 });
  if (stress.offer().canBuy) stress.buy();
  if (i % 1000 === 0) {
    const saved = stress.snapshot(); finiteJSON(saved);
    assert(JSON.stringify(saved).length < 500);
    assert.equal(compareHyper(new HyperEconomy(saved).power, stress.power), 0);
  }
}
const maximum = new HyperEconomy({ rank: HYPER_MAX_RANK, amplifier: HYPER_MAX_AMPLIFIER, fuel: HYPER_MAX_FUEL - 1 });
assert.equal(pulse(maximum, 1, { strength: 4 }).amount, 1);
assert.equal(maximum.fuel, HYPER_MAX_FUEL);
assert.equal(pulse(maximum, 2, { strength: 4 }).amount, 0);
assert.equal(maximum.offer().maxed, true);
assert.equal(maximum.offer('amplifier').maxed, true);
assert.equal(maximum.buy(), null);
assert.equal(maximum.buy('amplifier'), null);
finiteJSON(maximum.snapshot());
finiteJSON(maximum.offer());
finiteJSON(maximum.offer('amplifier'));
assert(JSON.stringify(maximum.snapshot()).length < 500);
const strings = new HyperEconomy();
for (let i = 0; i < 1000; i++) strings.pulse(`event-${i}`);
assert.equal(strings.snapshot().receipts.length, 128);
assert(JSON.stringify(strings.snapshot()).length < 2000);
console.log('PASS: 4–6-pulse active pacing, 50,000-action stress, bounded million-rank tail, fuel/cost/serialization safety and cap behavior.');
