// Genuine layered-number economy. Values are approximate, not arbitrary-precision integers.
// Vendored break_eternity.js 2.1.3, MIT, official commit:
// https://github.com/Patashu/break_eternity.js/tree/6ccf63b55d5b2c3f148c16e3ff907c6898542b72
// Vendor SHA-256: cb2bf8e51b937a4ff3bcc77cf6dc82cb9ba375616686dfb354664047bb61201c
// Decimal = sign * 10^(10^(...mag)), with `layer` exponentiations.
// Very small addends/factors can round away at extreme magnitudes, as in all
// floating-point incremental-game arithmetic. Graham's number is NOT represented.
import Decimal from './vendor/break_eternity.esm.js';
export { Decimal };
export const ASTRAL_VERSION = 1;
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
export const ASTRAL_NOTATION_HELP = '万〜無量大数 → 指数 → 指数の塔。10↑↑h; x は x に「10の累乗」を h 回重ねた値。階層浮動小数点による近似値です。グラハム数は未到達の数学的な目標で、獲得値ではありません。';
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
  Object.freeze({ id: 'generator', name: '星核ジェネレーター', icon: '✦', description: '累乗の種を増幅。自動生産とDINO得点が永続成長' }),
  Object.freeze({ id: 'exponent', name: '指数加速器', icon: '^', description: '基礎指数を2倍。10の累乗そのものを強化' }),
  Object.freeze({ id: 'tower', name: 'テトレーション炉', icon: '↑↑', description: '指数の塔を1層追加。10^(現在の基礎パワー)' })
]);
const ids = ASTRAL_UPGRADES.map(upgrade => upgrade.id);
const validReceipt = receipt => typeof receipt === 'string' && receipt.length > 0 && receipt.length <= 100;

export function cleanAstralSave(input) {
  const source = plain(input) ? input : {};
  const levels = plain(source.levels) ? source.levels : {};
  return {
    version: ASTRAL_VERSION,
    currency: serializeAstral(source.currency),
    lifetime: serializeAstral(source.lifetime),
    best: serializeAstral(source.best),
    levels: Object.fromEntries(ids.map(id => [id, integer(levels[id])])),
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
  get levels() { return { ...this.state.levels }; }
  get cooldown() { return this.state.cooldown; }
  syncProgress({ totalLevel = 0, clears = 0 } = {}) {
    const next = { totalLevel: integer(totalLevel, 100_000), clears: integer(clears) };
    if (next.totalLevel !== this.progress.totalLevel || next.clears !== this.progress.clears) {
      this.progress = next;
      this._cache = null;
    }
    return this;
  }
  _power(levels = this.state.levels) {
    const { generator: g, exponent: e, tower: t } = levels;
    const seed = g * (g + 3) / 2 + this.progress.totalLevel * .35 + this.progress.clears * .9;
    const exponent = new Decimal(seed).mul(Decimal.pow(2, e));
    const base = Decimal.pow(10, exponent);
    // Integer iteratedexp has a constant-time layer shortcut at large heights.
    return astral(t ? Decimal.iteratedexp(10, t, base, true) : base);
  }
  _metrics() {
    if (!this._cache) {
      const power = this._power();
      this._cache = { power, rate: astral(power.mul(8 * (1 + this.state.levels.generator * .25))) };
    }
    return this._cache;
  }
  get power() { return new Decimal(this._metrics().power); }
  get rate() { return new Decimal(this._metrics().rate); }
  offer(id) {
    const upgrade = ASTRAL_UPGRADES.find(item => item.id === id);
    if (!upgrade) return null;
    const level = this.state.levels[id];
    const unlocked = id === 'generator' || (id === 'exponent' ? this.state.levels.generator >= 2 : this.state.levels.exponent >= 2);
    const maxed = level >= ASTRAL_MAX_LEVEL;
    const costFactor = id === 'generator' ? 24 * (1 + level * .06) : id === 'exponent' ? 64 * (1 + level * .1) : 256 * (1 + level * .15);
    const cost = astral(this.power.mul(costFactor));
    const nextPower = maxed ? this.power : this._power({ ...this.state.levels, [id]: level + 1 });
    const readyIn = this.state.cooldown;
    return {
      ...upgrade, level, cost, nextPower, readyIn, locked: !unlocked, maxed,
      unlockText: id === 'exponent' ? 'ジェネレーター Lv.2 で解放' : id === 'tower' ? '指数加速器 Lv.2 で解放' : '',
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
    this.state.cooldown = 2;
    this._cache = null;
    this.revision++;
    return { id, level: this.state.levels[id], cost: offer.cost, before, currency: this.currency, power: this.power };
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
    const bonus = success ? 80 + Math.min(120, integer(score, 1_000_000) / 10) : fraction(progress) * 12;
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
      cooldown: this.state.cooldown,
      receipts: [...this.state.receipts]
    };
  }
}
