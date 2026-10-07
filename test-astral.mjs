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
check(ASTRAL_NOTATION_HELP.includes('近似通貨') && ASTRAL_NOTATION_HELP.includes('記号式'), 'no fake Graham claim');

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
check(cleanAstralSave(null).version === 2, 'default schema with permanent legacy / cycle split');

// Fresh progression is action-driven, bounded ordinary arithmetic. Idle
// production is a researched automation skill, not an opening timer wall.
const economy = new AstralEconomy();
check(economy.currency.eq(0) && economy.power.eq(1) && economy.rate.eq(0), 'fresh game starts at one with passive automation locked');
check(economy.offer('exponent').locked && economy.offer('tower').locked, 'late operators start locked');
check(economy.buy('generator') === null && economy.buy('missing') === null, 'unaffordable and invalid purchases no-op');
check(economy.tick(1000,{active:false}).eq(0) && economy.tick(1000).eq(0), 'no hidden or unresearched idle production');
check(economy.tick(Infinity).eq(0) && economy.tick(NaN).eq(0) && economy.tick(-1).eq(0), 'invalid deltas rejected');
for(let i=0;i<4;i++) check(economy.awardAction().eq(1),'small active action earns one initial star');
const first=economy.buy('generator');
check(first.cost.eq(4) && economy.currency.eq(0) && first.power.eq(1.5),'first purchase is small additive growth and exact spend');
check(economy.buy('generator')===null,'immediate repeated purchase cannot race');
const beforePause=economy.cooldown;economy.tick(20,{active:false});
check(economy.cooldown===beforePause,'paused cooldown does not advance');
for(let i=0;i<20_000;i++) {economy.awardAction(4);economy.tick(.2);economy.buy('generator');economy.buy('exponent');economy.buy('tower');}
check(economy.levels.generator===12 && economy.power.eq(7), 'even sustained input reaches only bounded first-cycle generator levels');
check(economy.levels.exponent===0 && economy.levels.tower===0 && economy.offer('exponent').locked && economy.offer('tower').locked,'click spam cannot bypass real cycle and tree gates');
economy.syncProgress({totalLevel:100_000,clears:1_000_000});
check(economy.power.eq(8.5) && economy.power.layer===0,'retained skills/clears cannot explode first-cycle power');
check(economy.offer('generator').maxed && economy.offer('generator').cap===12,'first-cycle cap is explicit');

// Rebirths accelerate production, but do not automatically buy research.
const small = new AstralEconomy();
small.configureCycle({rebirths:1,multiplier:3});
check(small.power.eq(3) && small.rate.eq(0) && small.awardAction().eq(12),'next cycle has a meaningful action-growth boost');
check(small.offer('exponent').locked && small.offer('tower').locked,'first rebirth alone unlocks no operator');
small.configureCycle({rebirths:100,multiplier:201});
check(small.offer('exponent').locked && small.offer('tower').locked && small.rate.eq(0),'even many cycles require explicit skill-tree research');
for(const rebirths of [0,1,2]) {
  const early=new AstralEconomy({version:2,currency:'1e1000',levels:{generator:999,exponent:999,tower:999}});
  early.configureCycle({rebirths,multiplier:1+2*rebirths,features:{exponent:true,tower:true,passive:true,productionMultiplier:100}});
  check(early.offer('exponent').locked&&early.offer('tower').locked&&early.rate.eq(0),'feature claims without minimum cycle floors are rejected');
  check(early.power.layer===0&&early.growthTier===0,'unearned old operators never affect early fresh cycles');
}
const secondTier=new AstralEconomy({version:2,currency:1e6,levels:{generator:2}});
secondTier.configureCycle({rebirths:3,multiplier:7,features:{exponent:true}});
check(!secondTier.offer('exponent').locked&&secondTier.offer('tower').locked,'researched exponent unlocks from third rebirth');
const beforeExponent=secondTier.power;
check(!!secondTier.buy('exponent')&&secondTier.power.gt(beforeExponent),'unlocked exponent genuinely changes arithmetic');
secondTier.configureCycle({rebirths:11,multiplier:23,features:{exponent:true,tower:true,passive:true}});
check(secondTier.offer('tower').locked&&secondTier.rate.gt(0),'tower still requires twelve cycles while researched automation works');

// At the appropriate research tier the actual layered arithmetic remains fast
// and genuine. No labels, native-number saturation, or simulated huge totals.
const towerEconomy = new AstralEconomy();
towerEconomy.configureCycle({rebirths:12,multiplier:25,features:{exponent:true,tower:true,passive:true}});
let activeSeconds=0;
for(const id of ['generator','generator','exponent','exponent','tower','generator','tower','exponent','tower']) {
  activeSeconds += simulateUntilOffer(towerEconomy,id);
  const offer=towerEconomy.offer(id),before=towerEconomy.currency,power=towerEconomy.power;
  const result=towerEconomy.buy(id);
  check(!!result&&towerEconomy.currency.eq(subtractAstral(before,offer.cost)),'exact supported-precision purchase subtraction');
  check(towerEconomy.power.gt(power),'each real later-tier purchase increases magnitude');
  check(towerEconomy.power.eq(offer.nextPower),'next power preview is truthful');
  check(towerEconomy.cooldown>0&&!towerEconomy.offer(id).canBuy,'tiny cooldown blocks repeat purchase at giant rounding scales');
}
check(towerEconomy.power.layer>=3,'researched late play reaches genuine multi-layer towers');
check(activeSeconds<120,'micro progression stays quick after the many-cycle gate');
const rate=towerEconomy.rate;
check(towerEconomy.tick(1000).eq(rate.mul(.25)),'long resumed frame clamps to a quarter second');
check(towerEconomy.tick(1000,{active:false}).eq(0),'hidden foreground still cannot earn');

const lateConfig={rebirths:12,multiplier:25,features:{exponent:true,tower:true,passive:true}};
for(const levels of [{generator:2,exponent:2,tower:1},{generator:4,exponent:3,tower:9},{generator:2,exponent:2,tower:999_999}]) {
  const probe=new AstralEconomy({version:2,levels,cycle:lateConfig});
  const cost=probe.offer('tower').cost;
  const step=Number.EPSILON*Math.max(1,Math.abs(cost.mag));
  const below=Decimal.fromComponents(1,cost.layer,cost.mag-step),above=Decimal.fromComponents(1,cost.layer,cost.mag+step);
  check(below.lt(cost)&&above.gt(cost),'nearest representable tower price boundary');
  const under=new AstralEconomy({version:2,levels,cycle:lateConfig,currency:serializeAstral(below)});
  check(!under.offer('tower').canBuy&&under.buy('tower')===null&&under.currency.eq(below),'underfunded huge wallet stays unchanged');
  const exact=new AstralEconomy({version:2,levels,cycle:lateConfig,currency:serializeAstral(cost)});
  check(exact.offer('tower').canBuy&&!!exact.buy('tower')&&exact.currency.eq(0),'exact tower cost is spent to zero');
  const funded=new AstralEconomy({version:2,levels,cycle:lateConfig,currency:serializeAstral(above)});
  check(funded.offer('tower').canBuy&&!!funded.buy('tower')&&funded.currency.eq(subtractAstral(above,cost)),'above-cost real layered subtraction');
}

const wallet=towerEconomy.currency,points=towerEconomy.awardScore(123);
check(points.eq(towerEconomy.power.mul(123))&&towerEconomy.currency.eq(wallet),'score conversion pure and supported precision');
check(towerEconomy.awardScore(0).eq(0)&&towerEconomy.awardScore(-1).eq(0)&&towerEconomy.awardScore(Infinity).eq(0),'invalid score never pays');
check(towerEconomy.recordBest(points)&&!towerEconomy.recordBest(points.div(10))&&towerEconomy.bestScore.eq(points),'astronomical high score only improves');
const reloaded=new AstralEconomy(JSON.parse(JSON.stringify(towerEconomy.snapshot())));
check(reloaded.currency.eq(towerEconomy.currency)&&reloaded.bestScore.eq(points),'wallet and high score reload');
assert.deepEqual(reloaded.levels,towerEconomy.levels);
const saved=reloaded.snapshot();saved.levels.generator=999;saved.currency.mag=-1;saved.cycle.features.tower=false;
check(reloaded.levels.generator!==999&&reloaded.currency.gte(0)&&!reloaded.offer('tower').locked,'snapshot has independent nested state');
const exposed=reloaded.currency;exposed.mag=-1;
check(reloaded.currency.gte(0),'Decimal getters do not expose owned balances');
const p0=towerEconomy.power;towerEconomy.syncProgress({totalLevel:1,clears:0});const p1=towerEconomy.power;towerEconomy.syncProgress({totalLevel:1,clears:1});const p2=towerEconomy.power;
check(p1.gt(p0)&&p2.gt(p1),'late skills and clears change real tower payload');
check(towerEconomy.awardRound('round:123',{success:true,score:500})?.amount.gt(0),'successful settlement pays');
const paid=towerEconomy.currency;
check(towerEconomy.awardRound('round:123',{success:true,score:500})===null&&towerEconomy.currency.eq(paid),'settlement idempotent');
check(towerEconomy.awardRound('skip',{outcome:'skip'})===null,'skip cannot pay');
check(towerEconomy.awardRound('idle-failure',{success:false,progress:0})?.amount.eq(0),'idle failure zero');
check(towerEconomy.awardRound('partial',{success:false,progress:.5})?.amount.gt(0),'bounded failure consolation');
const restored=new AstralEconomy(JSON.parse(JSON.stringify(towerEconomy.snapshot())));
check(restored.awardRound('round:123',{success:true})===null,'receipt persists');
for(let i=0;i<1000;i++)restored.awardRound(`receipt:${i}`,{success:true});
check(restored.snapshot().receipts.length===128,'bounded receipt history');

// Version 1 purchases were sold as permanent. Keep them permanent while v2
// explicitly marks new purchases as resettable cycle upgrades.
const oldLevels={generator:7,exponent:4,tower:3};
const legacy=new AstralEconomy({version:1,currency:'eee100',lifetime:'eee101',best:'eee102',levels:oldLevels,receipts:['old:settlement']});
assert.deepEqual(legacy.levels,oldLevels);assert.deepEqual(legacy.legacyLevels,oldLevels);assert.deepEqual(legacy.cycleLevels,{generator:0,exponent:0,tower:0});
check(legacy.currency.eq('eee100')&&legacy.best.eq('eee102')&&legacy.lifetime.eq('eee101'),'all old wealth and records preserved during migration');
check(legacy.legacyRetained&&legacy.power.layer===0&&legacy.offer('tower').locked,'migration alone does not grant fresh cycle completion or operator features');
legacy.configureCycle({rebirths:0,multiplier:1,features:{legacy:true,passive:true,exponent:true,tower:true}});
check(legacy.power.layer>=3&&!legacy.offer('tower').locked,'explicit parent grandfather flag restores old earned capabilities');
legacy.awardAction(4);legacy.tick(.25);
const oldLegacy=legacy.legacyLevels;
check(!!legacy.buy('generator')&&legacy.cycleLevels.generator===1,'new purchase is a separate cycle-owned level');
const bestBefore=legacy.best,lifetimeBefore=legacy.lifetime;
check(legacy.resetCycle({rebirths:1,multiplier:3,features:{legacy:true,passive:true,exponent:true,tower:true}}),'explicit voluntary reset succeeds');
check(legacy.currency.eq(0)&&legacy.cooldown===0&&legacy.cycleLevels.generator===0,'rebirth resets only live wallet and new cycle purchases');
assert.deepEqual(legacy.levels,oldLegacy);assert.deepEqual(legacy.legacyLevels,oldLegacy);
check(legacy.best.eq(bestBefore)&&legacy.lifetime.eq(lifetimeBefore)&&legacy.snapshot().receipts.includes('old:settlement'),'records, lifetime, permanent old purchases and receipts survive');
const legacyReload=new AstralEconomy(JSON.parse(JSON.stringify(legacy.snapshot())));
assert.deepEqual(legacyReload.legacyLevels,oldLegacy);
check(legacyReload.rebirths===1&&!legacyReload.offer('tower').locked,'v2 migration and grandfather context persist without duplication');
const ordinaryReset=new AstralEconomy({version:2,currency:1000,levels:{generator:5},best:1234,lifetime:5678,cycle:lateConfig});
ordinaryReset.resetCycle({rebirths:13,multiplier:27,features:{exponent:true,tower:true,passive:true}});
check(ordinaryReset.levels.generator===0&&ordinaryReset.best.eq(1234)&&ordinaryReset.lifetime.eq(5678),'new v2 player resets upgrades, retains records');

// Fuzzed configurations and deepest vetted arithmetic remain finite and fast.
for(const config of [{rebirths:NaN,multiplier:Infinity,features:{}},{rebirths:-1,multiplier:-2},{rebirths:Infinity,multiplier:'bad'}, {rebirths:1e100,multiplier:1e100,features:{exponent:true,tower:true,passive:true,productionMultiplier:1e100}}]) {
  const fuzz=new AstralEconomy({version:2,levels:{generator:1e100,exponent:1e100,tower:1e100}});fuzz.configureCycle(config);fuzz.tick(.25);finiteTree(fuzz.snapshot());check(!/NaN|Infinity/.test(formatAstral(fuzz.power)),'bad config never corrupts numbers');
}
const start=performance.now();
const stress=new AstralEconomy({version:2,levels:{generator:1_000_000,exponent:1_000_000,tower:1_000_000},cycle:lateConfig});
stress.syncProgress({totalLevel:100_000,clears:1_000_000});
check(stress.power.layer>=1_000_000&&stress.power.sign===1,'million-layer production still survives');
for(let i=0;i<50_000;i++)stress.tick(1/60);
for(const upgrade of ASTRAL_UPGRADES)check(stress.offer(upgrade.id).maxed,'bounded purchase counters');
finiteTree(stress.snapshot());check(!JSON.stringify(stress.snapshot()).includes('null'),'no nonfinite JSON null');
check(performance.now()-start<5000,'50k giant ticks terminate quickly');
console.log(`Astral: ${assertions} assertions passed; initial power capped at 8.5; researched tower burst ${activeSeconds.toFixed(1)}sec; stress ${(performance.now()-start).toFixed(0)}ms`);
