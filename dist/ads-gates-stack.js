// Two endless, self-contained playable models. Rendering is deliberately separate.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const safeDt = dt => Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
const sideOf = x => x < 0 ? 0 : 1;

export const GAME_META = [
  { id: 'gates', name: 'CROWD RUSH', hint: '左右にドラッグ', keys: '← → / A D', accent: '#39d4f3' },
  { id: 'stack', name: 'SKY STACK', hint: 'タップで積む', keys: 'SPACE / ENTER', accent: '#ffba71' }
];

export class GateCrowd {
  constructor() {
    this.time = 0;
    this.keys = new Set();
    this.attempt = 1;
    this.best = 0;
    this.eventId = 0;
    this.events = [];
    this.reset();
  }
  reset() {
    this.player = { x: 0, z: 4, target: 0 };
    this.crowd = 14;
    this.round = 1;
    this.cleared = 0;
    this.score = 0;
    this.distance = 0;
    this.dead = 0;
    this.pop = 0;
    this.flash = 0;
    this.message = '';
    this.messageTime = 0;
    this.combat = null;
    this.rows = this.makeRows();
  }
  makeRows() {
    const n = this.round;
    // The useful choice changes with squad size. Multiplication is not always best.
    const pairs = [
      [{ op: '+', value: 18 + n * 2 }, { op: '×', value: 2 }],
      [{ op: '×', value: 2 }, { op: '+', value: 35 + n * 3 }],
      [{ op: '+', value: 44 + n * 4 }, { op: '×', value: 1.6 }]
    ];
    if (n % 2 === 0) pairs.forEach(p => p.reverse());
    const base = (type, z, extra = {}) => ({ type, z, passed: false, hit: 0, ...extra });
    return [
      base('gate', -4.5, { options: pairs[0] }),
      base('barrier', -14, { lane: n % 2, strength: 12 + n * 3, reward: 8 }),
      base('gate', -24, { options: pairs[1] }),
      base('battle', -35, { enemies: [20 + n * 5, 33 + n * 6], reward: [12, 30] }),
      base('gate', -47, { options: pairs[2] }),
      base('boss', -59, { strength: 62 + Math.min(260, n * 16) })
    ];
  }
  emit(type, extra = {}) {
    this.events.push({ id: ++this.eventId, type, time: this.time, x: this.player.x, ...extra });
    if (this.events.length > 24) this.events.shift();
  }
  announce(message, duration = .95) { this.message = message; this.messageTime = duration; }
  point(x) { if (Number.isFinite(x)) this.player.target = clamp(x, -2.4, 2.4); }
  pointerDown(u, v, world) { this.pointerMove(u, v, world); }
  pointerMove(u, v, world) { this.point(Number.isFinite(world?.x) ? world.x : u * 4.2); }
  pointerUp() {}
  action(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') this.point(-2.1);
    if (code === 'ArrowRight' || code === 'KeyD') this.point(2.1);
  }
  applyGate(option) {
    const before = this.crowd;
    this.crowd = clamp(Math.round(option.op === '×' ? before * option.value : before + option.value), 0, 999);
    this.pop = .7;
    this.score += this.crowd - before;
    this.emit('gate', { gain: this.crowd - before, crowd: this.crowd });
    this.announce('+' + (this.crowd - before));
  }
  beginCombat(row, enemy, reward = 0) {
    this.combat = { row, enemy, initial: enemy, reward, clock: 0, burst: 0, lane: sideOf(this.player.x) };
    this.emit('battle', { enemy });
  }
  fail() {
    this.crowd = 0;
    this.dead = 1.25;
    this.combat = null;
    this.flash = .6;
    this.announce('RETRY', .85);
    this.emit('fail');
  }
  finishBattle() {
    const c = this.combat;
    this.combat = null;
    c.row.passed = true;
    c.row.hit = this.time;
    this.score += c.initial * 3;
    this.best = Math.max(this.best, this.score);
    this.emit('victory', { boss: c.row.type === 'boss' });
    this.pop = .8;
    if (c.row.type === 'boss') {
      this.cleared++;
      this.round++;
      this.crowd = Math.min(95, Math.max(20, Math.round(this.crowd * .65) + 15));
      this.rows = this.makeRows();
      this.player.target = this.player.x;
      this.announce('ROUND ' + this.round, 1.15);
    } else {
      this.crowd = Math.min(999, this.crowd + c.reward);
      this.announce('+' + c.reward);
    }
  }
  update(dt) {
    dt = safeDt(dt);
    this.time += dt;
    this.pop = Math.max(0, this.pop - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.messageTime = Math.max(0, this.messageTime - dt);
    if (!this.messageTime) this.message = '';
    if (this.dead) {
      this.dead = Math.max(0, this.dead - dt);
      if (!this.dead) { this.attempt++; this.reset(); this.emit('restart'); }
      return;
    }
    const steer = +(this.keys.has('ArrowRight') || this.keys.has('KeyD')) - +(this.keys.has('ArrowLeft') || this.keys.has('KeyA'));
    if (steer) this.player.target = clamp(this.player.target + steer * dt * 7.5, -2.4, 2.4);
    this.player.x += (this.player.target - this.player.x) * Math.min(1, dt * 13);
    if (this.combat) {
      const c = this.combat;
      c.clock += dt;
      c.burst = Math.max(0, c.burst - dt);
      const tick = .085;
      while (c.clock >= tick) {
        c.clock -= tick;
        const damage = Math.min(c.enemy, Math.max(1, Math.ceil(c.initial / 16)), this.crowd);
        c.enemy -= damage;
        this.crowd -= damage;
        c.burst = .09;
        this.emit('shot', { damage, enemy: c.enemy });
        if (this.crowd <= 0) { this.fail(); return; }
        if (c.enemy <= 0) { this.finishBattle(); return; }
      }
      return;
    }
    const speed = 4.25 + Math.min(1.8, this.round * .12);
    this.distance += speed * dt;
    for (const row of this.rows) {
      row.z += speed * dt;
      if (row.passed || row.z < this.player.z) continue;
      const lane = sideOf(this.player.x);
      row.hit = this.time;
      if (row.type === 'gate') {
        row.passed = true;
        row.chosen = lane;
        this.applyGate(row.options[lane]);
      } else if (row.type === 'barrier') {
        row.passed = true;
        row.chosen = lane;
        if (lane === row.lane) {
          this.crowd = Math.max(0, this.crowd - row.strength);
          this.flash = .3;
          this.announce('−' + row.strength);
          this.emit('impact', { loss: row.strength });
          if (!this.crowd) { this.fail(); return; }
        } else {
          this.crowd = Math.min(999, this.crowd + row.reward);
          this.pop = .4;
          this.announce('+' + row.reward);
          this.emit('gate', { gain: row.reward, crowd: this.crowd });
        }
      } else {
        // Pull the combat formation ahead so both squads stay legible.
        row.z = 1.5;
        this.beginCombat(row, row.type === 'boss' ? row.strength : row.enemies[lane], row.type === 'boss' ? 0 : row.reward[lane]);
        return;
      }
    }
    this.best = Math.max(this.best, this.score);
  }
  get stats() { return [['SQUAD', this.crowd], ['ROUND', this.round], ['SCORE', this.score]]; }
}

export class SkyStack {
  constructor() {
    this.time = 0;
    this.keys = new Set();
    this.attempt = 1;
    this.best = 0;
    this.eventId = 0;
    this.events = [];
    this.reset();
  }
  reset() {
    this.level = 0;
    this.score = 0;
    this.combo = 0;
    this.dead = 0;
    this.lock = .18;
    this.pop = 0;
    this.message = '';
    this.messageTime = 0;
    this.blocks = [{ x: 0, z: 0, w: 3.65, d: 3.65, level: 0, perfect: false }];
    this.offcuts = [];
    this.spawn();
  }
  get top() { return this.blocks[this.blocks.length - 1]; }
  spawn() {
    const b = this.top;
    const axis = this.level % 2 === 0 ? 'x' : 'z';
    this.active = { x: b.x, z: b.z, w: b.w, d: b.d, level: this.level + 1, axis, offset: (this.level % 4 < 2 ? -1 : 1) * 4.7, direction: this.level % 4 < 2 ? 1 : -1 };
    this.active[axis] += this.active.offset;
  }
  emit(type, extra = {}) {
    this.events.push({ id: ++this.eventId, type, time: this.time, level: this.level, ...extra });
    if (this.events.length > 20) this.events.shift();
  }
  announce(message) { this.message = message; this.messageTime = .8; }
  addOffcut(piece, direction) {
    this.offcuts.push({ ...piece, born: this.time, direction, axis: this.active.axis });
    if (this.offcuts.length > 8) this.offcuts.shift();
  }
  place() {
    if (this.dead || this.lock > 0) return false;
    const a = this.active, b = this.top, axis = a.axis, dim = axis === 'x' ? 'w' : 'd';
    const delta = a[axis] - b[axis], size = b[dim], error = Math.abs(delta);
    const tolerance = Math.max(.025, Math.min(.095, size * .1));
    if (error >= size - .00001) {
      this.addOffcut({ x: a.x, z: a.z, w: a.w, d: a.d, level: a.level }, Math.sign(delta) || 1);
      this.dead = 1.35;
      this.combo = 0;
      this.announce('RETRY');
      this.emit('miss');
      return false;
    }
    const perfect = error <= tolerance;
    const block = { x: b.x, z: b.z, w: b.w, d: b.d, level: this.level + 1, perfect };
    if (perfect) {
      this.combo++;
      this.announce(this.combo > 1 ? 'PERFECT ×' + this.combo : 'PERFECT');
    } else {
      this.combo = 0;
      block[dim] = size - error;
      block[axis] = b[axis] + delta / 2;
      const cut = { x: a.x, z: a.z, w: a.w, d: a.d, level: a.level };
      cut[dim] = error;
      cut[axis] = b[axis] + Math.sign(delta) * size / 2 + delta / 2;
      this.addOffcut(cut, Math.sign(delta));
      this.message = '';
    }
    this.level++;
    this.score += 10 + (perfect ? Math.min(100, this.combo * 5) : 0);
    this.best = Math.max(this.best, this.level);
    this.blocks.push(block);
    if (this.blocks.length > 20) this.blocks.shift();
    this.pop = perfect ? .5 : .23;
    this.lock = .15;
    this.emit(perfect ? 'perfect' : 'cut', { x: block.x, z: block.z, w: block.w, d: block.d, combo: this.combo });
    this.spawn();
    return true;
  }
  action(code) { if (code === 'Space' || code === 'Enter') this.place(); }
  pointerDown() { this.place(); }
  pointerMove() {}
  pointerUp() {}
  update(dt) {
    dt = safeDt(dt);
    this.time += dt;
    this.lock = Math.max(0, this.lock - dt);
    this.pop = Math.max(0, this.pop - dt);
    this.messageTime = Math.max(0, this.messageTime - dt);
    if (!this.messageTime) this.message = '';
    this.offcuts = this.offcuts.filter(o => this.time - o.born < 2.2);
    if (this.dead) {
      this.dead = Math.max(0, this.dead - dt);
      if (!this.dead) { this.attempt++; this.reset(); this.emit('restart'); }
      return;
    }
    const a = this.active;
    // Triangular motion has a constant speed at the alignment point.
    a.offset += a.direction * dt * (2.55 + Math.min(4.5, this.level * .075));
    if (a.offset > 4.7) { a.offset = 9.4 - a.offset; a.direction = -1; }
    if (a.offset < -4.7) { a.offset = -9.4 - a.offset; a.direction = 1; }
    a[a.axis] = this.top[a.axis] + a.offset;
  }
  get stats() { return [['FLOOR', this.level], ['PERFECT', this.combo], ['BEST', this.best]]; }
}

export const GAME_MODELS = { gates: GateCrowd, stack: SkyStack };
