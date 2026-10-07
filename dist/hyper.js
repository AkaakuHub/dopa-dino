// Exact symbolic milestones; this module never evaluates a huge expression.
// Wallet arithmetic is ordinary bounded integer fuel. A milestone is a
// non-consuming mathematical gate, NOT a floating-point or spendable G_n.
// g_0 = 4, g_(n+1) = 3 ↑^(g_n) 3; G = g_64.
// B_0 = g_64, B_(k+1) = g_(B_k) is this game's explicitly defined continuation.
export const HYPER_VERSION = 1;
export const HYPER_MAX_RANK = 1_000_000;
export const HYPER_MAX_AMPLIFIER = 1_000_000;
export const HYPER_MAX_FUEL = 2_000_000_000_000;
export const HYPER_MAX_SEQUENCE = Number.MAX_SAFE_INTEGER - 1;
export const FUKASETSU_EXPONENT = '37218383881977644441306597687849648128';
const SOURCES = ['input', 'runner', 'round'];
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = x => typeof x === 'number' && Number.isFinite(x);
const bounded = (x, max) => finite(x) ? Math.min(max, Math.max(0, Math.floor(x))) : 0;
const safeIndex = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;
const clone = x => JSON.parse(JSON.stringify(x));
const tower = height => Object.freeze({ kind: 'tetration', base: 2, height });
const power10 = exponent => Object.freeze({ kind: 'power', base: 10, exponent });
const graham = index => Object.freeze({ kind: 'graham', index });
const beyond = iterations => Object.freeze({ kind: 'iterate-g', iterations });
const FUKASETSU = power10(FUKASETSU_EXPONENT);
const GOOGOLPLEX = power10(power10('100'));
const PENTATION3 = Object.freeze({ kind: 'arrows', base: 3, arrows: 3, right: 3 });

const entries = [
  ['tower4', '2↑↑4', tower(4), '右結合の指数の塔。2^(2^(2^2)) = 65,536'],
  ['muryo', '無量大数', power10('68'), '一般的な万進法で 10^68'],
  ['googol', 'グーゴル', power10('100'), '正確に 10^100'],
  ['tower5', '2↑↑5', tower(5), '正確に 2^65,536'],
  ['fukasetsu', '不可説不可説転', FUKASETSU, '八十華厳の一般的な解釈：10^(7×2^122)'],
  ['googolplex', 'グーゴルプレックス', GOOGOLPLEX, '正確に 10^(10^100)'],
  ['tower6', '2↑↑6', tower(6), '高さ6の指数の塔'],
  ['tower100', '2↑↑100', tower(100), '高さ100の指数の塔'],
  ['pentation2', '2↑↑↑4', tower(65536), '正確に 2↑↑65,536'],
  ['pentation3', '3↑↑↑3', PENTATION3, '正確に 3↑↑(3↑↑3)'],
  ...[1, 2, 4, 8, 16, 32, 64, 65, 256, 65536].map(n => [
    `graham${n}`, n === 64 ? 'グラハム数' : `g_${n.toLocaleString('en-US')}`, graham(n),
    n === 1 ? 'g_1 = 3↑↑↑↑3' : n === 64 ? '標準的な定義のグラハム数 G = g_64' : 'g_0=4、g_(n+1)=3↑^(g_n)3'
  ]),
  ['beyond1', 'g_(g_64)', beyond(1), 'B_1=g_(g_64)。ここから先はゲーム独自の厳密な再帰定義']
];
export const HYPER_MILESTONES = Object.freeze(entries.map(([id, name, expression, description], rank) =>
  Object.freeze({ id, name, expression, description, rank, formula: formatHyper(expression) })));
export const HYPER_HELP = '↑はクヌースの矢印。2↑↑4=65,536、2↑↑↑4=2↑↑65,536。g_0=4、g_(n+1)=3↑^(g_n)3、グラハム数G=g_64。不可説不可説転は八十華厳の一般的な解釈 10^(7×2^122)。到達値Mは厳密な記号式で、購入時に確認する条件です。消費するのは別の整数燃料。B_0=g_64、B_(k+1)=g_(B_k)はゲーム独自の続きです。';

/** Only the certified families below are comparable. No lexicographic string,
 * expression-size or invented scalar ordering. Unsupported input yields null.
 * A tuple is a proof-backed ordering key, never the value of the huge integer.
 */
function certified(expression) {
  if (!plain(expression)) return null;
  const e = expression;
  if (e.kind === 'integer' && (e.value === 65536 || e.value === '65536')) return { key: [0, 0], expression: tower(4) };
  if (e.kind === 'tetration' && e.base === 2 && safeIndex(e.height, 4, 65536)) {
    const key = e.height === 4 ? [0, 0] : e.height === 5 ? [3, 0] : [6, e.height];
    return { key, expression: tower(e.height) };
  }
  if (e.kind === 'power') {
    if (e.base === 2 && (e.exponent === '65536' || e.exponent === 65536)) return { key: [3, 0], expression: tower(5) };
    if (e.base === 10) {
      if (e.exponent === '68' || e.exponent === 68) return { key: [1, 0], expression: power10('68') };
      if (e.exponent === '100' || e.exponent === 100) return { key: [2, 0], expression: power10('100') };
      if (e.exponent === FUKASETSU_EXPONENT) return { key: [4, 0], expression: FUKASETSU };
      if (plain(e.exponent) && e.exponent.kind === 'power' && e.exponent.base === 10 && (e.exponent.exponent === '100' || e.exponent.exponent === 100)) return { key: [5, 0], expression: GOOGOLPLEX };
    }
  }
  if (e.kind === 'arrows') {
    if (e.base === 2 && e.arrows === 3 && e.right === 3) return { key: [0, 0], expression: tower(4) };
    if (e.base === 2 && e.arrows === 3 && e.right === 4) return { key: [6, 65536], expression: tower(65536) };
    if (e.base === 3 && e.arrows === 3 && e.right === 3) return { key: [7, 0], expression: PENTATION3 };
    if (e.base === 3 && e.arrows === 4 && e.right === 3) return { key: [8, 1], expression: graham(1) };
  }
  if (e.kind === 'graham') {
    if (safeIndex(e.index, 1, HYPER_MAX_RANK)) return { key: [8, e.index], expression: graham(e.index) };
    if (plain(e.index) && e.index.kind === 'graham' && e.index.index === 64) return { key: [9, 1], expression: beyond(1) };
  }
  if (e.kind === 'iterate-g' && safeIndex(e.iterations, 0, HYPER_MAX_RANK)) {
    return e.iterations === 0 ? { key: [8, 64], expression: graham(64) } : { key: [9, e.iterations], expression: beyond(e.iterations) };
  }
  return null;
}

export function normalizeHyper(expression) {
  try { const found = certified(expression); return found ? clone(found.expression) : null; } catch { return null; }
}
export function compareHyper(a, b) {
  try {
    const x = certified(a), y = certified(b);
    if (!x || !y) return null;
    return Math.sign(x.key[0] - y.key[0]) || Math.sign(x.key[1] - y.key[1]);
  } catch { return null; }
}
export function canonicalAt(rank = 0) {
  const n = bounded(rank, HYPER_MAX_RANK);
  return n < HYPER_MILESTONES.length ? clone(HYPER_MILESTONES[n].expression) : { kind: 'iterate-g', iterations: n - 19 };
}
export function formatHyper(expression) {
  let e;
  try { e = certified(expression)?.expression; } catch { return '未対応の式'; }
  if (!e) return '未対応の式';
  if (e.kind === 'tetration') return e.height === 4 ? '2↑↑4 = 65,536' : e.height === 65536 ? '2↑↑↑4 = 2↑↑65,536' : `2↑↑${e.height.toLocaleString('en-US')}`;
  if (e.kind === 'power') {
    if (e.exponent === FUKASETSU_EXPONENT) return '10^(7×2^122)';
    return plain(e.exponent) ? '10^(10^100)' : `10^${e.exponent}`;
  }
  if (e.kind === 'arrows') return '3↑↑↑3';
  if (e.kind === 'graham') return e.index === 1 ? 'g_1 = 3↑↑↑↑3' : e.index === 64 ? 'G = g_64' : `g_${e.index.toLocaleString('en-US')}`;
  return e.iterations === 1 ? 'B_1 = g_(g_64)' : `B_${e.iterations.toLocaleString('en-US')}`;
}

const validReceipt = value => typeof value === 'string' && value.length > 0 && value.length <= 100;
export function cleanHyperSave(input) {
  const source = plain(input) ? input : {};
  // Schema 0's provisional names are deliberately supported, without touching
  // or importing the independent approximate Astral currency.
  const legacy = source.version === 0;
  const highWater = plain(source.highWater) ? source.highWater : {};
  return {
    version: HYPER_VERSION,
    rank: bounded(source.rank, HYPER_MAX_RANK),
    fuel: bounded(legacy ? source.charge ?? source.fuel : source.fuel, HYPER_MAX_FUEL),
    amplifier: bounded(legacy ? source.boosts ?? source.amplifier : source.amplifier, HYPER_MAX_AMPLIFIER),
    actions: bounded(source.actions, HYPER_MAX_SEQUENCE),
    highWater: Object.fromEntries(SOURCES.map(id => [id, bounded(highWater[id], HYPER_MAX_SEQUENCE)])),
    receipts: Array.isArray(source.receipts) ? [...new Set(source.receipts.filter(validReceipt))].slice(-128) : []
  };
}

/** Foreground actions only: deliberately no tick(), clocks, idle/offline gain,
 * timers, implicit purchases or conversion of symbolic M to a JS Number.
 * Persist snapshot() alongside the old economy. null means preserve a future
 * schema unchanged. Named-source monotone receipts are permanently idempotent;
 * arbitrary string receipts have a documented bounded 128-receipt window.
 */
export class HyperEconomy {
  constructor(save = null) {
    this.readOnly = finite(save?.version) && save.version > HYPER_VERSION;
    this.state = cleanHyperSave(save);
    this.revision = 0;
  }
  get rank() { return this.state.rank; }
  get power() { return canonicalAt(this.rank); }
  get fuel() { return this.state.fuel; }
  get amplifier() { return this.state.amplifier; }
  get chargePerAction() { return this._baseCharge() + this.amplifier; }
  get integrationBonus() { return Math.min(100_000, this.rank * 3 + this.amplifier * 2); }
  get milestone() {
    if (this.rank < HYPER_MILESTONES.length) return { ...HYPER_MILESTONES[this.rank], expression: this.power };
    return { id: `beyond${this.rank - 19}`, rank: this.rank, name: `B_${(this.rank - 19).toLocaleString('en-US')}`, expression: this.power, formula: this.format(), description: 'B_0=g_64、B_(k+1)=g_(B_k)。ゲーム独自の厳密な再帰定義' };
  }
  format(expression = this.power) { return formatHyper(expression); }
  _baseCharge(rank = this.rank) { return 1 + Math.floor(rank / 2); }
  _requirementMet(requirement) { const order = compareHyper(this.power, requirement); return order !== null && order >= 0; }
  offer(id = 'advance') {
    if (id !== 'advance' && id !== 'amplifier') return null;
    const advancing = id === 'advance';
    const maxed = advancing ? this.rank >= HYPER_MAX_RANK : this.amplifier >= HYPER_MAX_AMPLIFIER;
    const requirement = advancing ? this.power : canonicalAt(1);
    const cost = advancing ? (4 + this.rank % 3) * this._baseCharge() : (6 + this.amplifier * 2) * this._baseCharge();
    const nextPower = advancing && !maxed ? canonicalAt(this.rank + 1) : this.power;
    const locked = !this._requirementMet(requirement);
    return {
      id, name: advancing ? '次の巨大数へ' : '能動チャージ増幅', icon: advancing ? '↑' : '⚡',
      level: advancing ? this.rank : this.amplifier, cost, requirement, nextPower,
      nextName: advancing && !maxed ? (HYPER_MILESTONES[this.rank + 1]?.name ?? `B_${(this.rank - 18).toLocaleString('en-US')}`) : this.milestone.name,
      locked, maxed, canBuy: !this.readOnly && !locked && !maxed && this.fuel >= cost,
      actionsNeeded: Math.ceil(Math.max(0, cost - this.fuel) / this.chargePerAction),
      unlockText: advancing ? '現在の到達値Mを条件として確認' : '無量大数 10^68 で解放',
      effect: advancing ? `M ← ${formatHyper(nextPower)} · 次の能動燃料 +${this._baseCharge(Math.min(HYPER_MAX_RANK, this.rank + 1)) + this.amplifier}/回` : `能動燃料 +${this.chargePerAction + 1}/回`
    };
  }
  /** Every successful purchase performs one exact small-integer subtraction.
   * Rewriting M is a rank-up reward, not the result of subtracting huge values.
   */
  buy(id = 'advance') {
    const offer = this.offer(id);
    if (!offer?.canBuy) return null;
    const before = this.fuel, previousPower = this.power;
    this.state.fuel -= offer.cost;
    if (id === 'advance') this.state.rank++;
    else this.state.amplifier++;
    this.revision = Math.min(HYPER_MAX_SEQUENCE, this.revision + 1);
    return { id, cost: offer.cost, before, fuel: this.fuel, rank: this.rank, amplifier: this.amplifier, previousPower, power: this.power, integrationBonus: this.integrationBonus };
  }
  prestige() { return this.buy('advance'); }
  /** strength is 1..4 successful action units, not elapsed time. A round clear
   * can pass 4; an idle/failure result must pass 0 and receives nothing.
   * Use {source:'input'|'runner'|'round',sequence:positiveSafeInteger} for
   * persistent exact-once rewards, including duplicates older than 128 events.
   */
  pulse(receipt, { active = true, strength = 1 } = {}) {
    if (this.readOnly || active !== true || !finite(strength) || strength < 1) return null;
    const count = Math.min(4, Math.floor(strength));
    let monotone = false;
    if (plain(receipt)) {
      if (!SOURCES.includes(receipt.source) || !safeIndex(receipt.sequence, 1, HYPER_MAX_SEQUENCE) || receipt.sequence <= this.state.highWater[receipt.source]) return null;
      monotone = true;
    } else if (!validReceipt(receipt) || this.state.receipts.includes(receipt)) return null;
    const amount = Math.min(HYPER_MAX_FUEL - this.fuel, this.chargePerAction * count);
    this.state.fuel += amount;
    this.state.actions = Math.min(HYPER_MAX_SEQUENCE, this.state.actions + count);
    if (monotone) this.state.highWater[receipt.source] = receipt.sequence;
    else {
      this.state.receipts.push(receipt);
      this.state.receipts = this.state.receipts.slice(-128);
    }
    this.revision = Math.min(HYPER_MAX_SEQUENCE, this.revision + 1);
    return { amount, fuel: this.fuel, power: this.power, rank: this.rank, count, chargePerAction: this.chargePerAction };
  }
  snapshot() { return this.readOnly ? null : cleanHyperSave(this.state); }
}

// Ordering certificate for the supported ladder (no runtime giant arithmetic):
// 65536 < 10^68 < 10^100 < 2^65536.
// log10(2↑↑5) < 65536 < 7×2^122 < 10^38 < 10^100.
// log10(2↑↑6) = 2^65536 log10(2) > 10^100.
// Fixed-base towers strictly increase in height. 3↑↑↑3 = 3↑↑(3^27),
// and 3^27 > 65536, so it exceeds 2↑↑65536.
// Increasing arrows at base/right 3 yields g1 > 3↑↑↑3; g_n is strictly
// increasing with g_n > n. Also g64 > 10^6, so B1 exceeds every supported
// finite-index g_n. Iterating the strictly increasing g gives B_(k+1)>B_k.
