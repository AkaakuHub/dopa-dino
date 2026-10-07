import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  Decimal, AstralEconomy, ASTRAL_UPGRADES, ASTRAL_NOTATION_HELP,
  astral, serializeAstral, deserializeAstral, formatAstral, cleanAstralSave,
  addAstral, subtractAstral, multiplyAstral, powerAstral, compareAstral
} from './dist/astral.js';

let assertions = 0;
function check(predicate, message) { assertions++; assert.ok(predicate, message); }
function finiteTree(value) {
  if (typeof value === 'number') check(Number.isFinite(value), 'all JSON scalars finite');
  else if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);
}
function simulateUntilOffer(economy, id, limit = 6000) {
  let ticks = 0;
  while (!economy.offer(id).canBuy && ticks < limit) { economy.tick(.25); ticks++; }
  check(ticks < limit, `${id} purchase reachable in bounded simulation`);
  return ticks / 4;
}

// Official-library capability, preserved all the way through our safe save format.
for (const source of [0, 1, .5, 9999, '1e68', '1e308', '1e1000', 'ee324', 'eee100', '(e^100)20']) {
  const a = new Decimal(source);
  const saved = JSON.parse(JSON.stringify(serializeAstral(a)));
  finiteTree(saved);
  check(deserializeAstral(saved).eq(a), `exact component round-trip ${source}`);
  check(!/NaN|Infinity|undefined/.test(formatAstral(a)), 'finite visible formatting');
}
for (const height of [3, 4, 10, 1000, 1_000_000]) {
  const value = Decimal.tetrate(10, height);
  const restored = deserializeAstral(JSON.parse(JSON.stringify(serializeAstral(value))));
  check(value.eq(restored), `tetration height ${height} preserved`);
  check(restored.gt('1e308'), 'tetration beyond native number range');
}
check(formatAstral('1e68') === '1無量大数', 'correct Japanese magnitude');
check(formatAstral('1e1000') === '1×10^1000', 'readable exponent');
check(formatAstral('ee324') === '10^(10^324)', 'readable nested exponent');
check(formatAstral(Decimal.tetrate(10, 100)).includes('↑↑'), 'tetration notation with payload');
check(ASTRAL_NOTATION_HELP.includes('グラハム数は未到達'), 'no fake Graham claim');

// Plain arithmetic is actual arithmetic, including precise modest differences.
check(addAstral(20, 30).eq(50), 'addition');
check(subtractAstral(40, 7).eq(33), 'purchase subtraction');
check(subtractAstral(7, 40).eq(0), 'nonnegative subtraction');
check(multiplyAstral('1e200', '1e200').eq('1e400'), 'multiply beyond native double');
check(powerAstral('1e200', 3).eq_tolerance('1e600', 1e-12), 'power beyond native double');
check(powerAstral(10, '1e200').eq('ee200'), 'power creates genuine second layer');
check(compareAstral('ee200', 'ee199') > 0, 'layered affordability ordering');
check(compareAstral('eee16', 'ee9999') > 0, 'next-layer ordering');

// Deterministic arithmetic properties across ordinary numbers and giant towers.
let seed = 12345;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }
for (let i = 0; i < 2000; i++) {
  const layer = Math.floor(random() * 1000);
  const a = Decimal.fromComponents(1, layer, 16 + random() * 1000);
  const b = Decimal.fromComponents(1, layer, 16 + random() * 1000);
  check(addAstral(a, b).gte(a) && addAstral(a, b).gte(b), 'sum monotone');
  check(addAstral(a, b).eq(addAstral(b, a)), 'sum commutative');
  check(subtractAstral(a, b).gte(0) && subtractAstral(a, b).lte(a), 'subtract range');
  check(subtractAstral(a, a).eq(0), 'self subtraction exact at every layer');
  check(multiplyAstral(a, 2).gte(a), 'positive multiplier monotone');
  check(compareAstral(a, b) === -compareAstral(b, a), 'comparison antisymmetric');
  check(deserializeAstral(serializeAstral(a)).eq(a), 'property round-trip');
}

// Corrupted old/future saves: no NaN, Infinity, negative currency, unbounded loops.
for (const value of [NaN, Infinity, -Infinity, -1, 'NaN', 'Infinity', '-1e100', '10^^^99999999999999999', 'e'.repeat(10_000), {}, [], null,
  {sign: 1, layer: Infinity, mag: 5}, {sign: 1, layer: 1.5, mag: 100}, {sign: -1, layer: 1, mag: 2}, {sign: 1, layer: 1e300, mag: 1}, {sign: 1, layer: 0, mag: NaN}]) {
  check(astral(value).eq(0), 'corrupt value rejected');
  const state = new AstralEconomy({currency:value, lifetime:value, best:value, levels:{generator:Infinity,exponent:-9,tower:NaN},cooldown:Infinity}).snapshot();
  finiteTree(state);
  check(state.levels.generator === 0 && state.levels.exponent === 0 && state.levels.tower === 0, 'bad upgrade counts rejected');
}
const future = new AstralEconomy({version:100,currency:1000});
check(future.readOnly && future.snapshot() === null, 'future schema not silently rewritten');
check(future.tick(1).eq(0) && future.buy('generator') === null, 'future schema read-only');
check(new AstralEconomy({version:0,currency:100}).currency.eq(100), 'pre-version numeric migration');
check(cleanAstralSave(null).version === 1, 'default schema');

// Foreground production including mini-games; no offline credit, pause or blur income.
const economy = new AstralEconomy();
check(economy.currency.eq(0) && economy.rate.eq(8), 'new-game production');
check(economy.offer('exponent').locked && economy.offer('tower').locked, 'progressive upgrade access');
check(economy.buy('generator') === null, 'unaffordable purchase has no effect');
check(economy.buy('missing') === null, 'invalid purchase has no effect');
check(economy.tick(1000, {active:false}).eq(0), 'hidden/paused frame no payout');
check(economy.tick(Infinity).eq(0) && economy.tick(NaN).eq(0) && economy.tick(-1).eq(0), 'bad delta rejected');
check(economy.tick(1000).eq(2), 'long resumed frame clamped to .25s');
for (let i = 0; i < 11; i++) economy.tick(.25);
check(economy.currency.eq(24), 'first useful purchase in 3 seconds');
const first = economy.buy('generator');
check(first.cost.eq(24) && economy.currency.eq(0) && first.power.eq(100), 'first purchase spends actual wallet and changes production');
check(economy.levels.generator === 1 && economy.rate.eq(1000), 'upgrade permanent rate effect');
check(economy.buy('generator') === null, 'repeated immediate purchase cannot race');
const beforePause = economy.cooldown;
economy.tick(20,{active:false});
check(economy.cooldown === beforePause, 'cooldown also foreground-only');

let activeSeconds = 3;
for (const id of ['generator', 'exponent', 'exponent', 'tower', 'generator', 'tower', 'exponent', 'tower']) {
  activeSeconds += simulateUntilOffer(economy, id);
  const offer = economy.offer(id);
  const before = economy.currency;
  const power = economy.power;
  const result = economy.buy(id);
  check(!!result && economy.currency.eq(subtractAstral(before,offer.cost)), 'exact supported-precision purchase deduction');
  check(economy.power.gt(power), 'every owned upgrade genuinely increases magnitude');
  check(economy.power.eq(offer.nextPower), 'offer nextPower truthful');
  check(economy.cooldown > 0 && !economy.offer(id).canBuy, 'short cooldown survives giant-number rounding');
}
check(economy.power.layer >= 3, 'ordinary play reaches towers with three or more layers');
check(activeSeconds < 120, 'rapid escalation is reachable without debug money');

// Actual affordability around high-layer costs uses numeric comparison, not labels.
// Adjacent stored magnitudes are the nearest distinguishable values at this scale.
for (const levels of [{generator:2,exponent:2,tower:1}, {generator:4,exponent:3,tower:9}, {generator:2,exponent:2,tower:999_999}]) {
  const probe = new AstralEconomy({levels});
  const cost = probe.offer('tower').cost;
  const step = Number.EPSILON * Math.max(1,Math.abs(cost.mag));
  const below = Decimal.fromComponents(1,cost.layer,cost.mag-step);
  const above = Decimal.fromComponents(1,cost.layer,cost.mag+step);
  check(below.lt(cost) && above.gt(cost), 'nearest distinguishable tower price boundary');
  const underfunded = new AstralEconomy({levels,currency:serializeAstral(below)});
  check(!underfunded.offer('tower').canBuy && underfunded.buy('tower') === null, 'below tower price cannot buy');
  check(underfunded.currency.eq(below), 'failed buy leaves huge wallet unchanged');
  const exact = new AstralEconomy({levels,currency:serializeAstral(cost)});
  check(exact.offer('tower').canBuy && !!exact.buy('tower') && exact.currency.eq(0), 'exact tower price is spent to zero');
  const funded = new AstralEconomy({levels,currency:serializeAstral(above)});
  check(funded.offer('tower').canBuy && !!funded.buy('tower') && funded.currency.eq(subtractAstral(above,cost)), 'above tower price deducts using layered arithmetic');
}

// Main-run points are immutable per gain; pure scoring cannot inflate the wallet.
const wallet = economy.currency;
const points = economy.awardScore(123);
check(points.eq(economy.power.mul(123)) && economy.currency.eq(wallet), 'score delta exact supported-precision, no wallet deposit');
check(economy.awardScore(0).eq(0) && economy.awardScore(-1).eq(0) && economy.awardScore(Infinity).eq(0), 'zero/invalid score no award');
check(economy.recordBest(points), 'record astronomical best score');
check(economy.bestScore.eq(points) && !economy.recordBest(points.div(10)), 'best never decreases');
const next = new AstralEconomy(JSON.parse(JSON.stringify(economy.snapshot())));
check(next.currency.eq(economy.currency) && next.bestScore.eq(points), 'wallet and high score reload');
assert.deepEqual(next.levels,economy.levels);
const snapshot = next.snapshot(); snapshot.levels.generator = 999; snapshot.currency.mag = -1;
check(next.levels.generator !== 999 && next.currency.gte(0), 'snapshot is independently mutable plain data');
const exposed = next.currency; exposed.mag = -1;
check(next.currency.gte(0), 'exposed Decimal copies do not mutate owned money');

// Clears and skills affect the actual exponent, including after tower ascension.
const p0 = economy.power;
economy.syncProgress({totalLevel:1,clears:0}); const p1=economy.power;
economy.syncProgress({totalLevel:1,clears:1}); const p2=economy.power;
check(p1.gt(p0) && p2.gt(p1), 'skill and clear each increase the real tower payload');
const receipt = 'round:123';
check(economy.awardRound(receipt,{success:true,score:500})?.amount.gt(0), 'settled success pays genuine big currency');
const paid = economy.currency;
check(economy.awardRound(receipt,{success:true,score:500}) === null && economy.currency.eq(paid), 'receipt idempotent');
check(economy.awardRound('skip',{outcome:'skip'}) === null, 'skip cannot award');
check(economy.awardRound('idle-failure',{success:false,progress:0})?.amount.eq(0), 'idle failure earns zero');
check(economy.awardRound('failed',{success:false,progress:.5})?.amount.gt(0), 'failed round receives bounded consolation');
const reloaded = new AstralEconomy(JSON.parse(JSON.stringify(economy.snapshot())));
check(reloaded.awardRound(receipt,{success:true}) === null, 'receipt persists across reload');
for(let i=0;i<1000;i++) reloaded.awardRound(`receipt:${i}`,{success:true});
check(reloaded.snapshot().receipts.length === 128, 'bounded receipt history');

// High-level valid saves and long sessions stay finite, bounded, and fast.
const start=performance.now();
const stress = new AstralEconomy({levels:{generator:1_000_000,exponent:1_000_000,tower:1_000_000}});
stress.syncProgress({totalLevel:100_000,clears:1_000_000});
check(stress.power.layer >= 1_000_000 && stress.power.sign === 1, 'million-layer production survives');
for(let i=0;i<50_000;i++) stress.tick(1/60);
for(const upgrade of ASTRAL_UPGRADES) check(stress.offer(upgrade.id).maxed, 'bounded integer upgrade counter');
finiteTree(stress.snapshot());
check(!JSON.stringify(stress.snapshot()).includes('null'), 'no nonfinite JSON null corruption');
check(performance.now()-start<5000, '50k giant-layer ticks terminate quickly');
console.log(`Astral economy: ${assertions} assertions passed; playable tower escalation in ${activeSeconds.toFixed(1)} seconds; stress ${(performance.now()-start).toFixed(0)}ms`);
