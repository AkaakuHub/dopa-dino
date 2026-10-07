// Genuine layered-number economy. Values are approximate, not arbitrary-precision integers.
// Vendored break_eternity.js 2.1.3, MIT, official commit:
// https://github.com/Patashu/break_eternity.js/tree/6ccf63b55d5b2c3f148c16e3ff907c6898542b72
// Vendor SHA-256: cb2bf8e51b937a4ff3bcc77cf6dc82cb9ba375616686dfb354664047bb61201c
// Decimal = sign * 10^(10^(...mag)), with `layer` exponentiations.
// Very small addends/factors can round away at extreme magnitudes, as in all
// floating-point incremental-game arithmetic. Graham's number is NOT represented.
import Decimal from './vendor/break_eternity.esm.js';
export { Decimal };
export const ASTRAL_VERSION = 2;
export const ASTRAL_MAX_LEVEL = 1_000_000;
const MAX_LAYER = 1_000_010;
const MAX_NUMBER = Decimal.fromComponents(1, MAX_LAYER, 1e12);
const ZERO = () => new Decimal(0);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const integer = (n, max = ASTRAL_MAX_LEVEL) => finite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
const fraction = n => finite(n) ? Math.max(0, Math.min(1, n)) : 0;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const validDecimal = n => n instanceof Decimal && finite(n.sign) && finite(n.layer) && finite(n.mag) && n.sign >= 0 && n.layer >= 0 && Number.isInteger(n.layer) && n.layer <= MAX_LAYER;

/** Safe public conversion. Invalid, negative, or unsupported values become zero.
 * Only bounded ordinary/scientific/layered strings are parsed, never arbitrary
 * hyperoperation expressions from a save. Use Decimal.tetrate for trusted code.
 */
export function astral(value = 0) {
  let result;
  try {
    if (value instanceof Decimal) result = new Decimal(value);
    else if (finite(value) && value >= 0) result = new Decimal(value);
    else if (typeof value === 'string' && value.length <= 160 && /^(?:\+?\d+(?:\.\d+)?(?:e[+-]?\d+(?:\.\d+)?)?|e{1,12}[+-]?\d+(?:\.\d+)?|\(e\^\d{1,7}\)[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)$/i.test(value)) result = new Decimal(value);
    else if (plain(value) && own(value, 'sign') && own(value, 'layer') && own(value, 'mag') && [value.sign, value.layer, value.mag].every(finite) && (value.sign === 0 || value.sign === 1) && Number.isInteger(value.layer) && value.layer >= 0 && value.layer <= MAX_LAYER && (value.layer > 0 || value.mag >= 0)) result = Decimal.fromComponents(value.sign, value.layer, value.mag);
    else return ZERO();
    if (!validDecimal(result)) return ZERO();
    return result.gt(MAX_NUMBER) ? new Decimal(MAX_NUMBER) : result;
  } catch { return ZERO(); }
}

/** Every scalar is finite JSON data; never converts a huge number to Number. */
export function serializeAstral(value) {
  const d = astral(value);
  return { sign: d.sign, layer: d.layer, mag: d.mag };
}
export const deserializeAstral = astral;
export const addAstral = (a, b) => astral(astral(a).add(astral(b)));
export const subtractAstral = (a, b) => astral(Decimal.max(0, astral(a).sub(astral(b))));
export const multiplyAstral = (a, b) => astral(astral(a).mul(astral(b)));
export const powerAstral = (a, b) => astral(astral(a).pow(astral(b)));
export const compareAstral = (a, b) => astral(a).cmp(astral(b));

const JAPANESE_UNITS = ['', '万', '億', '兆', '京', '垓', '秭', '穣', '溝', '澗', '正', '載', '極', '恒河沙', '阿僧祇', '那由他', '不可思議', '無量大数'];
const trim = (n, places = 2) => Number(n.toFixed(places)).toString();
const compact = n => Math.abs(n) < 1e6 ? trim(n) : n.toExponential(2).replace(/\.00e/, 'e').replace('e+', 'e');
export const ASTRAL_NOTATION_HELP = '万〜無量大数 → 指数 → 指数の塔。10↑↑h; x は x に「10の累乗」を h 回重ねた値。階層浮動小数点による近似値です。この近似通貨は階層浮動小数点です。別のHYPER到達値はグラハム数を含む厳密な記号式です。';
export function formatAstral(value) {
  const d = astral(value);
  if (!d.sign) return '0';
  if (d.lt(1e4)) return trim(d.toNumber(), d.lt(1) ? 3 : 1);
  if (d.lt('1e72')) {
    const exponent = d.log10().toNumber();
    const group = Math.min(17, Math.floor(exponent / 4));
    const coefficient = d.div(Decimal.pow(10, group * 4)).toNumber();
    return `${trim(coefficient, coefficient >= 100 ? 1 : 2)}${JAPANESE_UNITS[group]}`;
  }
  if (d.layer === 1) {
    const exponent = Math.floor(d.mag);
    return `${trim(Math.pow(10, d.mag - exponent))}×10^${compact(exponent)}`;
  }
  if (d.layer === 2) return `10^(10^${compact(d.mag)})`;
  if (d.layer === 3) return `10^(10^(10^${compact(d.mag)}))`;
  // Explicit payload notation: no claim that an arbitrary tower equals 10↑↑h.
  return `10↑↑${d.layer.toLocaleString('en-US')}; ${compact(d.mag)}`;
}

export const ASTRAL_UPGRADES = Object.freeze([
  Object.freeze({ id: 'generator', name: '星核ジェネレーター', icon: '✦', description: 'このサイクルの生産を強化。最初は小さく、転生で成長枠を解放' }),
  Object.freeze({ id: 'exponent', name: '指数加速器', icon: '^', description: '転生3回 ＋ 指数の発見を研究。基礎指数を2倍に強化' }),
  Object.freeze({ id: 'tower', name: 'テトレーション炉', icon: '↑↑', description: '転生12回 ＋ 累乗の塔を研究。指数の塔を1層追加' })
]);
const ids = ASTRAL_UPGRADES.map(upgrade => upgrade.id);
const validReceipt = receipt => typeof receipt === 'string' && receipt.length > 0 && receipt.length <= 100;

const cleanLevels = levels => Object.fromEntries(ids.map(id => [id, integer(levels?.[id])]));
const cleanCycle = cycle => {
  const rebirths = integer(cycle?.rebirths);
  const multiplier = finite(cycle?.multiplier) && cycle.multiplier >= 1 ? Math.min(1e9, cycle.multiplier) : 1 + 2 * rebirths;
  const source = plain(cycle?.features) ? cycle.features : {};
  const features = {
    legacy: source.legacy === true,
    passive: source.passive === true && (source.legacy === true || rebirths >= 8),
    exponent: source.exponent === true && (source.legacy === true || rebirths >= 3),
    tower: source.tower === true && (source.legacy === true || (rebirths >= 12 && source.exponent === true)),
    productionMultiplier: rebirths === 0 && source.legacy !== true ? 1 : finite(source.productionMultiplier) && source.productionMultiplier >= 1 ? Math.min(100, source.productionMultiplier) : 1
  };
  return { rebirths, multiplier: rebirths === 0 && !features.legacy ? 1 : multiplier, features };
};
export function cleanAstralSave(input) {
  const source = plain(input) ? input : {};
  // Version 1 promised permanent purchases. Preserve them as a separate owned
  // legacy pool; only new version 2 per-cycle purchases are reset by rebirth.
  const migrated = !(finite(source.version) && source.version >= ASTRAL_VERSION);
  const levels = cleanLevels(migrated ? null : source.levels);
  const legacyLevels = cleanLevels(migrated ? source.levels : source.legacyLevels);
  return {
    version: ASTRAL_VERSION,
    currency: serializeAstral(source.currency),
    lifetime: serializeAstral(source.lifetime),
    best: serializeAstral(source.best),
    levels,
    legacyLevels,
    legacyRetained: !!source.legacyRetained || Object.values(legacyLevels).some(n => n > 0),
    cycle: cleanCycle(source.cycle),
    cooldown: finite(source.cooldown) ? Math.min(2, Math.max(0, source.cooldown)) : 0,
    receipts: Array.isArray(source.receipts) ? [...new Set(source.receipts.filter(validReceipt))].slice(-128) : []
  };
}

/** Independent save-field helper. Does not access localStorage or install timers.
 * Caller ticks this during foreground play (including mini-games), persists
 * snapshot(), and calls recordScore(runTotal) for high scores. No offline gain.
 */
export class AstralEconomy {
  constructor(save = null) {
    this.readOnly = finite(save?.version) && save.version > ASTRAL_VERSION;
    this.state = cleanAstralSave(save);
    this._currency = astral(this.state.currency);
    this._lifetime = astral(this.state.lifetime);
    this._best = astral(this.state.best);
    this.progress = { totalLevel: 0, clears: 0 };
    this._cache = null;
    this.revision = 0;
  }
  get currency() { return new Decimal(this._currency); }
  get lifetime() { return new Decimal(this._lifetime); }
  get best() { return new Decimal(this._best); }
  get bestScore() { return this.best; }
  get levels() { return Object.fromEntries(ids.map(id => [id, integer(this.state.levels[id] + this.state.legacyLevels[id])])); }
  get cycleLevels() { return { ...this.state.levels }; }
  get legacyLevels() { return { ...this.state.legacyLevels }; }
  get legacyRetained() { return this.state.legacyRetained; }
  get rebirths() { return this.state.cycle.rebirths; }
  get cycleMultiplier() { return this.state.cycle.multiplier; }
  configureCycle({ rebirths = this.rebirths, multiplier, features = this.state.cycle.features } = {}) {
    if (this.readOnly) return this;
    const next = cleanCycle({ rebirths, multiplier, features });
    if (JSON.stringify(next) !== JSON.stringify(this.state.cycle)) {
      this.state.cycle = next;
      this._cache = null;
      this.revision++;
    }
    return this;
  }
  setCycle(config) { return this.configureCycle(config); }
  /** Call only after an authorized, successful prestige. Legacy purchases,
   * records, total production and settled receipts survive this explicit reset.
   */
  resetCycle(config = {}) {
    if (this.readOnly) return false;
    this._currency = ZERO();
    this.state.levels = cleanLevels(null);
    this.state.cooldown = 0;
    this._cache = null;
    this.configureCycle(config);
    this.revision++;
    return true;
  }
  get growthTier() {
    const features = this.state.cycle.features;
    if (features.legacy) return 2;
    if (this.rebirths >= 12 && features.tower) return 2;
    if (this.rebirths >= 3 && features.exponent) return 1;
    return 0;
  }
  levelCap(id) {
    if (this.growthTier === 0) return id === 'generator' ? 12 + Math.min(12, this.rebirths * 4) : 0;
    if (this.growthTier === 1) return id === 'generator' ? 24 + Math.min(76, this.rebirths * 2) : id === 'exponent' ? 8 + Math.min(24, Math.floor(this.rebirths / 3)) : 0;
    return ASTRAL_MAX_LEVEL;
  }
  get effectiveLevels() { return Object.fromEntries(ids.map(id => [id, Math.min(this.levels[id], this.levelCap(id))])); }
  get cooldown() { return this.state.cooldown; }
  syncProgress({ totalLevel = 0, clears = 0 } = {}) {
    const next = { totalLevel: integer(totalLevel, 100_000), clears: integer(clears) };
    if (next.totalLevel !== this.progress.totalLevel || next.clears !== this.progress.clears) {
      this.progress = next;
      this._cache = null;
    }
    return this;
  }
  _power(levels = this.levels) {
    const g = Math.min(integer(levels.generator), this.levelCap('generator'));
    const e = Math.min(integer(levels.exponent), this.levelCap('exponent'));
    const t = Math.min(integer(levels.tower), this.levelCap('tower'));
    // The first four-stage run is deliberately ordinary arithmetic. Neither
    // action spam, retained material skills, nor old tower saves bypass this.
    const multiplier = this.cycleMultiplier * this.state.cycle.features.productionMultiplier;
    if (this.growthTier === 0) return astral((1 + g * .5 + Math.min(20, this.progress.totalLevel) * .05 + Math.min(20, this.progress.clears) * .025) * multiplier);
    const seed = this.growthTier === 1
      ? g * .2 + Math.min(100, this.progress.totalLevel) * .015 + Math.min(100, this.progress.clears) * .025
      : g * (g + 3) / 2 + this.progress.totalLevel * .35 + this.progress.clears * .9;
    const exponent = new Decimal(seed).mul(Decimal.pow(2, e));
    const base = Decimal.pow(10, exponent).mul(multiplier);
    // Integer iteratedexp has a constant-time layer shortcut at large heights.
    return astral(t ? Decimal.iteratedexp(10, t, base, true) : base);
  }
  _metrics() {
    if (!this._cache) {
      const power = this._power();
      const generator = this.effectiveLevels.generator;
      const rate = !this.state.cycle.features.passive ? ZERO() : this.growthTier === 0 ? astral((2 + generator * .75) * this.cycleMultiplier * this.state.cycle.features.productionMultiplier) : astral(power.mul(8 * (1 + generator * .25)));
      this._cache = { power, rate };
    }
    return this._cache;
  }
  get power() { return new Decimal(this._metrics().power); }
  get rate() { return new Decimal(this._metrics().rate); }
  offer(id) {
    const upgrade = ASTRAL_UPGRADES.find(item => item.id === id);
    if (!upgrade) return null;
    const levels = this.levels;
    const level = levels[id];
    const rebirthGate = id === 'generator' ? 0 : id === 'exponent' ? 3 : 12;
    const features = this.state.cycle.features;
    const operatorUnlocked = id === 'generator' || features.legacy || (this.rebirths >= rebirthGate && features[id] === true);
    const unlocked = operatorUnlocked && (id === 'generator' || (id === 'exponent' ? levels.generator >= 2 : levels.exponent >= 2));
    const cap = this.levelCap(id);
    const maxed = operatorUnlocked && level >= cap;
    const costFactor = id === 'generator' ? 4 * (1 + level * .06) : id === 'exponent' ? 8 * (1 + level * .1) : 12 * (1 + level * .15);
    const cost = this.growthTier === 0 && id === 'generator' ? astral((4 + level * 4 + level * level * 1.5) * this.cycleMultiplier) : astral(this.power.mul(costFactor));
    const nextPower = maxed || !unlocked ? this.power : this._power({ ...levels, [id]: level + 1 });
    const readyIn = this.state.cooldown;
    const unlockText = !operatorUnlocked
      ? `転生 ${rebirthGate}回 ＋ ${id === 'exponent' ? '指数の発見' : '累乗の塔'}を研究`
      : id === 'exponent' ? 'ジェネレーター Lv.2 で解放' : id === 'tower' ? '指数加速器 Lv.2 で解放' : '';
    return {
      ...upgrade, level, cost, nextPower, readyIn, locked: !unlocked, maxed,
      legacyLevel: this.state.legacyLevels[id], cycleLevel: this.state.levels[id], effectiveLevel: this.effectiveLevels[id], cap, rebirthGate,
      unlockText,
      capText: maxed && this.growthTier < 2 ? 'このサイクルの上限・転生で拡張' : '',
      canBuy: !this.readOnly && unlocked && !maxed && readyIn <= 0 && this._currency.gte(cost),
      effect: id === 'tower' ? `指数の塔 +1層 → ${formatAstral(nextPower)}` : `次のDINOパワー ${formatAstral(nextPower)}`
    };
  }
  /** One upgrade, one real layered subtraction. No bulk loops or automatic buys. */
  buy(id) {
    const offer = this.offer(id);
    if (!offer?.canBuy) return null;
    const before = this.currency;
    this._currency = subtractAstral(this._currency, offer.cost);
    this.state.levels[id]++;
    this.state.cooldown = .18;
    this._cache = null;
    this.revision++;
    return { id, level: this.levels[id], cost: offer.cost, before, currency: this.currency, power: this.power };
  }
  _deposit(amount) {
    const safe = astral(amount);
    this._currency = addAstral(this._currency, safe);
    this._lifetime = addAstral(this._lifetime, safe);
    return safe;
  }
  /** dt is seconds. A resumed/hidden frame cannot manufacture offline income. */
  tick(dt, { active = true } = {}) {
    if (this.readOnly || !active || !finite(dt) || dt <= 0) return ZERO();
    const seconds = Math.min(.25, dt);
    this.state.cooldown = Math.max(0, this.state.cooldown - seconds);
    return this._deposit(this.rate.mul(seconds));
  }
  /** Deliberate gameplay/burst actions add real energy, without idle waiting. */
  awardAction(strength=1) {if(this.readOnly||!finite(strength)||strength<=0)return ZERO();return this._deposit(this.power.mul((this.rebirths===0?1:4)*Math.min(4,strength)));}
  /** Pure conversion, never deposits into the wallet. */
  awardScore(basePoints) { return multiplyAstral(this.power, finite(basePoints) && basePoints > 0 ? basePoints : 0); }
  /** Call once with the total astronomical run score, not its numeric source. */
  recordScore(score) {
    if (this.readOnly) return false;
    const value = astral(score);
    if (!value.gt(this._best)) return false;
    this._best = value;
    this.revision++;
    return true;
  }
  recordBest(score) { return this.recordScore(score); }
  /** Skips are not rewards. Caller passes a success boolean only on settlement. */
  awardRound(receipt, { success, progress = 0, score = 0 } = {}) {
    if (this.readOnly || !validReceipt(receipt) || typeof success !== 'boolean' || this.state.receipts.includes(receipt)) return null;
    const bonus = this.rebirths === 0 ? (success ? 8 + Math.min(12, integer(score, 1_000_000) / 10) : fraction(progress) * 2) : (success ? 80 + Math.min(120, integer(score, 1_000_000) / 10) : fraction(progress) * 12);
    const amount = this._deposit(this.power.mul(bonus));
    this.state.receipts.push(receipt);
    this.state.receipts = this.state.receipts.slice(-128);
    this.revision++;
    return { amount, success, currency: this.currency, best: this.best };
  }
  /** A null snapshot means a future save schema was detected: preserve it. */
  snapshot() {
    if (this.readOnly) return null;
    return {
      version: ASTRAL_VERSION,
      currency: serializeAstral(this._currency),
      lifetime: serializeAstral(this._lifetime),
      best: serializeAstral(this._best),
      levels: { ...this.state.levels },
      legacyLevels: { ...this.state.legacyLevels },
      legacyRetained: this.state.legacyRetained,
      cycle: { ...this.state.cycle, features: { ...this.state.cycle.features } },
      cooldown: this.state.cooldown,
      receipts: [...this.state.receipts]
    };
  }
}
