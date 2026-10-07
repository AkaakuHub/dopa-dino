// One prestige cycle is the four actual Runner stages, not an economy threshold.
// This module is pure: the caller owns Runner events, persistence, and confirmation UI.
export const PRESTIGE_VERSION = 1;
export const CYCLE_STAGES = Object.freeze(['city', 'desert', 'space', 'aurora']);
export const STAGE_DISTANCE = 600;
export const CYCLE_DISTANCE = STAGE_DISTANCE * CYCLE_STAGES.length;
const MAX_REBIRTHS = 1_000_000;
const MAX_COUNT = Number.MAX_SAFE_INTEGER - 1;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const integer = (value, max = MAX_COUNT) => finite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
const validEpoch = value => typeof value === 'string' && value.length > 0 && value.length <= 100;
const GAMES = Object.freeze(['snow', 'hole', 'helix', 'gates', 'stack', 'golf', 'breaker', 'range', 'pins', 'merge']);
const tree = (id, branch, name, icon, description, baseCost, floors, parent = null, parentRank = 1) => Object.freeze({
  id, branch, name, icon, description, baseCost, floors: Object.freeze(floors), minRebirths: floors[0], maxRank: 5,
  requires: Object.freeze(parent ? [Object.freeze({ id: parent, rank: parentRank })] : [])
});
export const TREE_NODES = Object.freeze([
  tree('runner_charge', 'runner', 'チャージ血統', '⚡', 'ブースト充電 +20% / rank、移動の成長 +3%', 1, [1, 5, 15, 35, 70]),
  tree('runner_jump', 'runner', '跳躍進化', '↟', '追加ジャンプ +1（rank 1 / 3 / 5）、移動の成長 +3%', 3, [4, 9, 20, 45, 85], 'runner_charge'),
  tree('runner_shield', 'runner', '復活の殻', '⬡', '復活バリア +0.5秒 / rank、移動の成長 +3%', 6, [10, 18, 35, 65, 110], 'runner_jump'),
  tree('runner_blaster', 'runner', '自動ブラスター', '⌖', '恐竜の自動射撃を解放・強化、移動の成長 +3%', 12, [20, 35, 60, 100, 160], 'runner_shield'),
  tree('automation_arcade', 'automation', 'アーケード拡張', '◈', 'ゲート・積み上げ・ゴルフを解放。上位rankでサイクル収益UP', 1, [1, 6, 18, 40, 80]),
  tree('automation_arcade2', 'automation', 'アーケード深層', '✦', 'ブレイカー・射撃・ピン・合成を解放。上位rankで収益UP', 3, [3, 10, 25, 55, 100], 'automation_arcade'),
  tree('automation_reactor', 'automation', '自動リアクター', '⚙', 'プレイ中の自動生産を解放。上位rankで収益UP', 8, [8, 20, 45, 80, 130], 'automation_arcade2'),
  tree('automation_burst', 'automation', 'ホールド駆動', '≫', '長押しチャージを解放。上位rankで収益UP', 15, [18, 35, 65, 110, 180], 'automation_reactor'),
  tree('math_exponent', 'math', '指数の発見', '^', '指数加速器を解放。上位rankで成長倍率UP', 4, [3, 8, 20, 50, 100]),
  tree('math_tower', 'math', '累乗の塔', '↑↑', 'テトレーション炉を解放。上位rankで成長倍率UP', 24, [12, 25, 50, 90, 140], 'math_exponent', 2),
  tree('math_hyper', 'math', '巨大数探査', '↑↑↑', '厳密な記号数の研究を解放。上位rankで到達上限を拡張', 60, [30, 55, 85, 120, 170], 'math_tower', 2),
  tree('math_graham', 'math', 'グラハムの地平', 'G', 'グラハム数への道。rank 2からその先の再帰を解放', 150, [75, 150, 225, 300, 400], 'math_hyper', 2)
]);
const cleanRanks = ranks => Object.fromEntries(TREE_NODES.map(node => [node.id, integer(ranks?.[node.id], node.maxRank)]));
const ACHIEVEMENTS = ['four-stages', 'first-rebirth', 'exponent-era', 'tower-era', 'hyper-era', 'graham-era', 'ten-rebirths', 'hundred-rebirths'];
const validPosition = (stageIndex, distance) => Number.isSafeInteger(stageIndex) && stageIndex >= 0 && stageIndex <= 1_000_000_000 && finite(distance) && distance >= 0 && distance <= MAX_COUNT && Math.floor(distance / STAGE_DISTANCE) === stageIndex;
export const rebirthMultiplier = count => 1 + 2 * integer(count, MAX_REBIRTHS);

export function cleanPrestigeSave(input) {
  const source = plain(input) ? input : {};
  const rebirthCount = integer(source.rebirthCount, MAX_REBIRTHS);
  const hasPosition = source.version === PRESTIGE_VERSION && validEpoch(source.epoch) && validPosition(source.stageIndex, source.distance);
  const stageIndex = hasPosition ? source.stageIndex : 0;
  const distance = hasPosition ? source.distance : 0;
  const completed = hasPosition && source.completed === true && stageIndex >= CYCLE_STAGES.length && distance >= CYCLE_DISTANCE;
  const achievements = Array.isArray(source.achievements) ? [...new Set(source.achievements.filter(id => ACHIEVEMENTS.includes(id)))] : [];
  return {
    version: PRESTIGE_VERSION,
    rebirthCount,
    currency: integer(source.currency),
    cycle: rebirthCount + 1,
    epoch: hasPosition ? source.epoch : null,
    stageIndex,
    distance,
    clearedStages: Math.min(CYCLE_STAGES.length, stageIndex),
    completed,
    serial: integer(source.serial),
    achievements,
    legacy: source.legacy === true,
    ranks: cleanRanks(source.ranks),
    treeSerial: integer(source.treeSerial),
    retiredEpochs: Array.isArray(source.retiredEpochs) ? [...new Set(source.retiredEpochs.filter(validEpoch))].slice(-128) : []
  };
}

export class Prestige {
  constructor(save = null, { legacy = false } = {}) {
    this.readOnly = finite(save?.version) && save.version > PRESTIGE_VERSION;
    this.state = cleanPrestigeSave(save);
    this.state.legacy = this.state.legacy || legacy === true;
    this.revision = 0;
  }
  get rebirthCount() { return this.state.rebirthCount; }
  get currency() { return this.state.currency; }
  get points() { return this.currency; }
  get nodes() { return TREE_NODES; }
  get ranks() { return { ...this.state.ranks }; }
  get legacy() { return this.state.legacy; }
  _activeRank(id) {
    const node = TREE_NODES.find(item => item.id === id);
    if (!node) return 0;
    let rank = Math.min(this.state.ranks[id], node.floors.filter(floor => this.rebirthCount >= floor).length);
    for (const req of node.requires) {
      const parentRank = this._activeRank(req.id);
      if (parentRank < req.rank) return 0;
      rank = Math.min(rank, parentRank);
    }
    return rank;
  }
  get features() {
    const rank = id => this._activeRank(id);
    const legacy = this.legacy;
    const arcade = rank('automation_arcade'), arcade2 = rank('automation_arcade2');
    const reactor = rank('automation_reactor'), burst = rank('automation_burst');
    const exponent = rank('math_exponent'), tower = rank('math_tower'), hyper = rank('math_hyper'), graham = rank('math_graham');
    const charge = rank('runner_charge'), jump = rank('runner_jump'), shield = rank('runner_shield'), blaster = rank('runner_blaster');
    const games = legacy ? [...GAMES] : GAMES.slice(0, arcade2 ? 10 : arcade ? 6 : 3);
    return {
      legacy, games, passive: legacy || reactor > 0, burst: legacy || burst > 0, holdBurst: legacy || burst > 0,
      exponent: legacy || exponent > 0, tower: legacy || tower > 0, hyper: legacy || hyper > 0, graham: legacy || graham > 0,
      maxHyperRank: legacy ? 1_000_000 : !hyper ? 0 : graham ? [0, 16, 20, 99, 999, 1_000_000][graham] : Math.min(9, 6 + hyper),
      extraJumps: jump ? Math.ceil(jump / 2) : 0, reviveBonus: shield * .5, rechargeBonus: charge * .2,
      autoBlaster: legacy || blaster > 0, blasterRank: blaster,
      progressRate: Math.min(2, 1 + Math.min(.5, this.rebirthCount * .08) + (charge + jump + shield + blaster) * .03),
      productionMultiplier: 1 + (arcade + arcade2 + reactor + burst) * .15 + (exponent + tower + hyper + graham) * .25
    };
  }
  offerNode(id) {
    const node = TREE_NODES.find(item => item.id === id);
    if (!node) return null;
    const rank = this.state.ranks[id], nextRank = Math.min(node.maxRank, rank + 1);
    const maxed = rank >= node.maxRank;
    const minRebirths = node.floors[nextRank - 1];
    const requires = node.requires.map(req => ({ id: req.id, rank: Math.max(req.rank, nextRank) }));
    const missing = requires.filter(req => this._activeRank(req.id) < req.rank);
    const locked = this.rebirthCount < minRebirths || missing.length > 0;
    const cost = node.baseCost * nextRank * nextRank;
    const unlockText = this.rebirthCount < minRebirths ? `転生 ${minRebirths}回で研究可能` : missing.length ? missing.map(req => `${TREE_NODES.find(item => item.id === req.id).name} rank ${req.rank}`).join('・') + ' が必要' : '';
    const token = `node:${id}:rank:${rank}:serial:${this.state.treeSerial}`;
    return { ...node, rank, level: rank, nextRank, maxed, cost, minRebirths, requires, locked, unlockText, token,
      effect: node.description, nextEffect: node.description,
      canBuy: !this.readOnly && !maxed && !locked && this.currency >= cost && this.state.treeSerial < MAX_COUNT };
  }
  buyNode(id, token = this.offerNode(id)?.token) {
    const offer = this.offerNode(id);
    if (!offer?.canBuy || token !== offer.token) return null;
    const before = this.currency;
    this.state.currency -= offer.cost;
    this.state.ranks[id]++;
    this.state.treeSerial++;
    if (this.features.exponent) this._achieve('exponent-era');
    if (this.features.tower) this._achieve('tower-era');
    if (this.features.hyper) this._achieve('hyper-era');
    if (this.features.graham) this._achieve('graham-era');
    this.revision++;
    return { id, rank: this.state.ranks[id], cost: offer.cost, before, currency: this.currency, features: this.features, token };
  }
  get cycle() { return this.state.cycle; }
  get epoch() { return this.state.epoch; }
  get clearedStages() { return this.state.clearedStages; }
  get distance() { return this.state.distance; }
  get achievements() { return [...this.state.achievements]; }
  get multiplier() { return rebirthMultiplier(this.rebirthCount); }
  get canRebirth() { return !this.readOnly && this.state.completed && this.rebirthCount < MAX_REBIRTHS && this.state.serial < MAX_COUNT; }
  get reward() { return this.rebirthCount + 1; }
  get token() { return this.canRebirth ? `cycle:${this.cycle}:run:${this.epoch}:serial:${this.state.serial}` : null; }
  get progress() { return Math.min(1, this.state.distance / CYCLE_DISTANCE); }
  get stageProgress() { return this.state.completed ? 1 : (this.state.distance % STAGE_DISTANCE) / STAGE_DISTANCE; }
  get stageNames() { return [...CYCLE_STAGES]; }
  /** A fresh run resets unfinished travel. Death/revive must not call this.
   * An earned full-cycle completion is irreversible until voluntary rebirth.
   */
  beginRun(epoch) {
    if (this.readOnly || !validEpoch(epoch) || this.state.retiredEpochs.includes(epoch)) return false;
    if (this.state.completed) return true;
    if (epoch === this.state.epoch) return false;
    if (this.state.epoch) this._retireEpoch(this.state.epoch);
    this.state.epoch = epoch;
    this.state.stageIndex = 0;
    this.state.distance = 0;
    this.state.clearedStages = 0;
    this.revision++;
    return true;
  }
  /** A Runner observation, never a mini-game or wallet event. Both the real
   * cumulative stage index and distance must agree, in the current run epoch.
   */
  observe({ stageIndex, distance, epoch } = {}) {
    if (this.readOnly || !validEpoch(epoch) || epoch !== this.state.epoch || !validPosition(stageIndex, distance)) return false;
    if (this.state.completed) return false;
    if (stageIndex < this.state.stageIndex || stageIndex > this.state.stageIndex + 1 || distance < this.state.distance) return false;
    if (stageIndex === this.state.stageIndex && distance === this.state.distance) return false;
    this.state.stageIndex = stageIndex;
    this.state.distance = distance;
    this.state.clearedStages = Math.min(CYCLE_STAGES.length, stageIndex);
    if (stageIndex >= CYCLE_STAGES.length) {
      this.state.completed = true;
      this._achieve('four-stages');
    }
    this.revision++;
    return true;
  }
  _retireEpoch(epoch) { if (validEpoch(epoch) && !this.state.retiredEpochs.includes(epoch)) this.state.retiredEpochs = [...this.state.retiredEpochs, epoch].slice(-128); }
  _achieve(id) { if (!this.state.achievements.includes(id)) this.state.achievements.push(id); }
  /** Pass the token shown in the preview. A stale preview, repeated click, or
   * pre-completion call is a no-op. The caller resets only after a real result.
   */
  rebirth(token = this.token) {
    if (!this.canRebirth || typeof token !== 'string' || token !== this.token) return null;
    const reward = this.reward;
    const completedEpoch = this.epoch;
    this.state.rebirthCount++;
    this.state.currency = Math.min(MAX_COUNT, this.state.currency + reward);
    this.state.cycle = this.state.rebirthCount + 1;
    this.state.serial++;
    this._retireEpoch(completedEpoch);
    this.state.epoch = null;
    this.state.stageIndex = 0;
    this.state.distance = 0;
    this.state.clearedStages = 0;
    this.state.completed = false;
    this._achieve('first-rebirth');
    if (this.rebirthCount >= 10) this._achieve('ten-rebirths');
    if (this.rebirthCount >= 100) this._achieve('hundred-rebirths');
    this.revision++;
    return { reward, rebirthCount: this.rebirthCount, currency: this.currency, cycle: this.cycle, multiplier: this.multiplier, completedEpoch, token };
  }
  snapshot() {
    if (this.readOnly) return null;
    return { ...this.state, achievements: [...this.state.achievements], ranks: { ...this.state.ranks }, retiredEpochs: [...this.state.retiredEpochs] };
  }
}
export { Prestige as PrestigeSystem, Prestige as PrestigeEconomy };
