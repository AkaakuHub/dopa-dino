// Finite, renderer-independent arcade rounds. Construct a new model to replay.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const safeDt = dt => Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
const validRound = round => Math.max(1, Math.floor(Number.isFinite(round) ? round : 1));

export const GAME_META = [
  { id: 'pins', name: 'TREASURE PINS', hint: '水で溶岩を冷やしてから、ピンを抜いて宝石を宝箱へ', keys: '← → でピン選択 · SPACE / ENTER で抜く', accent: '#ffd56a' },
  { id: 'merge', name: 'ORBIT MERGE', hint: 'ドラッグで狙って、離すと落下。同じ数字を合体！', keys: '← → / A D で照準 · SPACE / ENTER で落とす', accent: '#b99cff' }
];

// Heights and reservoir sides change between rounds, including an extra safety
// gate in the later temples. Every layout has a tested, timed solution.
export const PIN_LAYOUTS = Object.freeze([
  { name: 'SUN TEMPLE', waterSide: -1, waterY: 7.55, gemY: 7.55, basinY: 3.4, divider: 0, extraGate: false },
  { name: 'MOON TEMPLE', waterSide: 1, waterY: 8.25, gemY: 6.8, basinY: 3.15, divider: -.25, extraGate: false },
  { name: 'JADE FALLS', waterSide: -1, waterY: 6.8, gemY: 8.25, basinY: 3.6, divider: .3, extraGate: true },
  { name: 'EMBER VAULT', waterSide: 1, waterY: 7.3, gemY: 8.4, basinY: 3.25, divider: 0, extraGate: true }
].map(Object.freeze));

export class TreasurePins {
  constructor(round = 1) {
    this.round = validRound(round); this.layout = PIN_LAYOUTS[(this.round - 1) % PIN_LAYOUTS.length];
    this.keys = new Set(); this.time = 0; this.events = []; this.eventId = 0;
    this.outcome = null; this.resultMetric = ''; this.score = 0; this.pop = 0;
    this.message = 'WATER → COOL → TREASURE'; this.messageTime = 4;
    this.bounds = { left: -3.05, right: 3.05, bottom: .68, top: 10.45 };
    this.heat = 1; this.saved = 0; this.totalGems = 12; this.selected = 0; this.pulls = 0;
    this.particles = []; this.particleId = 0; this.waterUsed = 0;
    const l = this.layout, d = l.divider;
    const waterRange = l.waterSide < 0 ? [-3.05, d] : [d, 3.05];
    const gemRange = l.waterSide < 0 ? [d, 3.05] : [-3.05, d];
    const pin = (id, title, range, y, side, tint) => ({ id, title, x1: range[0], x2: range[1], y, side, tint, pulled: false, pulledAt: -1 });
    this.pins = [pin('water', 'WATER', waterRange, l.waterY, l.waterSide, 0x53d9ff), pin('gems', 'GEMS', gemRange, l.gemY, -l.waterSide, 0xffd45d), pin('drain', 'DRAIN', [-3.05, 3.05], l.basinY, l.waterSide, 0xffaa65)];
    if (l.extraGate) this.pins.push(pin('chest', 'CHEST', [-3.05, 3.05], 1.9, -l.waterSide, 0x9ef5b4));
    this.divider = { x: d, bottom: Math.min(l.waterY, l.gemY) - .17, top: 10.55, width: .2 };
    this.poolSurface = l.basinY + .73;
    for (let i = 0; i < 28; i++) {
      const x = waterRange[0] + .3 + (i % 7) * (waterRange[1] - waterRange[0] - .6) / 6;
      this.addParticle('water', x, l.waterY + .27 + Math.floor(i / 7) * .3, .12, (i % 3 - 1) * .12);
    }
    for (let i = 0; i < this.totalGems; i++) {
      const x = gemRange[0] + .42 + (i % 4) * (gemRange[1] - gemRange[0] - .84) / 3;
      this.addParticle('gem', x, l.gemY + .3 + Math.floor(i / 4) * .42, .18, 0);
    }
    for (let i = 0; i < 18; i++) this.addParticle('lava', -2.77 + i % 9 * .69, l.basinY + .23 + Math.floor(i / 9) * .32, .17, (i % 2 ? 1 : -1) * .12);
  }
  addParticle(type, x, y, radius, vx = 0) {
    const p = { id: ++this.particleId, type, x, y, vx, vy: 0, r: radius, active: true, spin: this.particleId * .47 };
    this.particles.push(p); return p;
  }
  emit(type, data = {}) { this.events.push({ id: ++this.eventId, type, time: this.time, ...data }); if (this.events.length > 24) this.events.shift(); }
  say(message, seconds = 1.6) { this.message = message; this.messageTime = seconds; }
  finish(outcome, reason) {
    if (this.outcome) return;
    this.outcome = outcome; this.resultMetric = outcome === 'success' ? `${this.saved}/${this.totalGems} gems · ${this.pulls} pins` : `${this.saved}/${this.totalGems} gems · ${reason}`;
    this.say(outcome === 'success' ? 'TREASURE RESCUED!' : reason, 99); this.emit(outcome, { x: 0, y: 1.1 });
  }
  pull(id) {
    if (this.outcome) return false;
    const p = typeof id === 'number' ? this.pins[id] : this.pins.find(pin => pin.id === id);
    if (!p || p.pulled) return false;
    p.pulled = true; p.pulledAt = this.time; this.pulls++; this.selected = this.pins.indexOf(p);
    this.emit('pin', { x: (p.x1 + p.x2) / 2, y: p.y, pin: p.id });
    if (p.id === 'water') this.say('COOL THE LAVA');
    if (p.id === 'drain' && this.heat > .001) this.say('HOT LAVA!', 2);
    return true;
  }
  pointerDown(u, v, world) {
    if (this.outcome) return;
    // The renderer supplies an intersection with the cabinet's vertical plane.
    const x = world?.x, y = world?.y ?? world?.z;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    let nearest = null, distance = Infinity;
    for (const p of this.pins) {
      if (p.pulled) continue;
      const handleX = (p.side < 0 ? p.x1 : p.x2) + p.side * .43;
      const rodHit = x >= p.x1 - .18 && x <= p.x2 + .18 && Math.abs(y - p.y) <= .36;
      const d = Math.hypot(x - handleX, y - p.y);
      if ((rodHit || d < .48) && Math.abs(y - p.y) < distance) { nearest = p; distance = Math.abs(y - p.y); }
    }
    if (nearest) this.pull(nearest.id);
  }
  pointerMove() {} pointerUp() {} pointerCancel() {}
  action(code) {
    if (this.outcome) return;
    if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].includes(code)) this.selected = (this.selected + 1) % this.pins.length;
    if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(code)) this.selected = (this.selected + this.pins.length - 1) % this.pins.length;
    if (code === 'Space' || code === 'Enter') this.pull(this.selected);
    if (/^Digit[1-4]$/.test(code)) this.pull(Number(code.slice(-1)) - 1);
  }
  update(dt) {
    if (this.outcome) return;
    dt = safeDt(dt); if (!dt) return;
    this.time += dt; this.pop = Math.max(0, this.pop - dt);
    this.messageTime = Math.max(0, this.messageTime - dt); if (!this.messageTime) this.message = '';
    for (let remain = dt; remain > 1e-8 && !this.outcome;) {
      const h = Math.min(remain, 1 / 150); remain -= h;
      const closedDrain = !this.pins[2].pulled;
      for (const p of this.particles) {
        if (!p.active || this.outcome) continue;
        const oldY = p.y;
        p.vy = Math.max(-13, p.vy - 13 * h); p.x += p.vx * h; p.y += p.vy * h; p.spin += p.vx * h * 2;
        if (p.x < this.bounds.left + p.r) { p.x = this.bounds.left + p.r; p.vx = Math.abs(p.vx) * .35; }
        if (p.x > this.bounds.right - p.r) { p.x = this.bounds.right - p.r; p.vx = -Math.abs(p.vx) * .35; }
        if (p.y + p.r > this.divider.bottom && p.y - p.r < this.divider.top && Math.abs(p.x - this.divider.x) < p.r + .1) {
          const side = p.x < this.divider.x ? -1 : 1; p.x = this.divider.x + side * (p.r + .101); p.vx = side * Math.abs(p.vx) * .25;
        }
        for (const gate of this.pins) {
          if (gate.pulled || p.x + p.r < gate.x1 || p.x - p.r > gate.x2) continue;
          const top = gate.y + .105 + p.r;
          if (oldY >= top - .07 && p.y < top && p.vy <= 0) { p.y = top; p.vy = Math.abs(p.vy) > 1 ? -p.vy * .1 : 0; p.vx *= .98; }
        }
        // Water mixes into the whole connected lava basin, rather than only one
        // side cooling. Absorbed droplets are retired from a fixed-size pool.
        if (p.type === 'water' && p.y - p.r <= this.poolSurface && p.y > this.layout.basinY - .15 && this.heat > 0 && closedDrain) {
          p.active = false; this.waterUsed++; this.heat = Math.max(0, this.heat - 1 / 19);
          this.emit('steam', { x: p.x, y: this.poolSurface });
          if (this.heat < 1e-8) { this.heat = 0; this.pop = .6; this.say('COOLED! RELEASE THE TREASURE', 3); this.emit('cooled', { x: 0, y: this.poolSurface }); }
          continue;
        }
        if (p.type === 'water' && closedDrain && this.heat === 0 && p.y - p.r <= this.poolSurface) { p.active = false; continue; }
        if (p.type === 'gem' && this.heat > .001) {
          const inPool = closedDrain && p.y - p.r < this.poolSurface && p.y > this.layout.basinY;
          const hitLava = !closedDrain && this.particles.some(q => q.active && q.type === 'lava' && Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r + .1);
          if (inPool || hitLava) { this.finish('failure', 'Treasure touched lava'); break; }
        }
        if (p.y - p.r < 1.08) {
          p.active = false;
          if (p.type === 'lava' && this.heat > .001) { this.finish('failure', 'Lava reached the chest'); break; }
          if (p.type === 'gem') { this.saved++; this.score += 25; this.pop = .3; this.emit('gem', { x: p.x, y: 1.1 }); if (this.saved === this.totalGems) this.finish('success'); }
        }
      }
      if (this.outcome) break;
      // Gem collisions keep the falling pile physical without water particles
      // causing numerical pressure explosions inside a closed reservoir.
      const gems = this.particles.filter(p => p.active && p.type === 'gem');
      for (let i = 0; i < gems.length; i++) for (let j = i + 1; j < gems.length; j++) separate(gems[i], gems[j], .1);
    }
  }
  get stats() { return [['GEMS', `${this.saved}/${this.totalGems}`], ['LAVA', this.heat > .001 ? `${Math.round(this.heat * 100)}°` : 'COOLED'], ['PINS', `${this.pulls}/${this.pins.length}`]]; }
}

export const MERGE_TIERS = Object.freeze([
  { value: 2, radius: .33, color: 0x80eddb }, { value: 4, radius: .42, color: 0x77c9ff },
  { value: 8, radius: .53, color: 0xb294ff }, { value: 16, radius: .66, color: 0xff91c0 },
  { value: 32, radius: .81, color: 0xffc467 }, { value: 64, radius: .99, color: 0xecf77c }
].map(Object.freeze));
const DROP_SEQUENCES = [[1, 1, 2], [2, 1, 1], [1, 1, 1, 1], [2, 2]];

// Position-based circle collision, followed by a normal impulse. The visual
// spheres and these radii share the exact same dimensions.
function separate(a, b, bounce = .08) {
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), sum = a.r + b.r;
  if (d >= sum) return false;
  if (d < 1e-7) { dx = (a.id < b.id ? 1 : -1) * .001; dy = .0003; d = Math.hypot(dx, dy); }
  dx /= d; dy /= d;
  const total = a.r * a.r + b.r * b.r, wa = b.r * b.r / total, wb = 1 - wa, push = sum - d + .00005;
  a.x -= dx * push * wa; a.y -= dy * push * wa; b.x += dx * push * wb; b.y += dy * push * wb;
  const relative = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
  if (relative < 0) { const impulse = -(1 + bounce) * relative; a.vx -= dx * impulse * wa; a.vy -= dy * impulse * wa; b.vx += dx * impulse * wb; b.vy += dy * impulse * wb; }
  return true;
}

export class OrbitMerge {
  constructor(round = 1) {
    this.round = validRound(round); this.time = 0; this.keys = new Set(); this.events = []; this.eventId = 0;
    this.outcome = null; this.resultMetric = ''; this.message = 'MATCH NUMBERS · MAKE 32'; this.messageTime = 3;
    this.bounds = { left: -3.05, right: 3.05, floor: .7, danger: 7.65, spawn: 9.05 };
    this.targetTier = this.round % 4 === 0 ? 6 : 5; this.message = `MATCH NUMBERS · MAKE ${MERGE_TIERS[this.targetTier - 1].value}`;
    this.pieces = []; this.nextId = 0; this.drops = 0; this.merges = 0; this.score = 0; this.bestTier = 1;
    this.aim = 0; this.dragging = false; this.cooldown = 0; this.dangerTime = 0; this.pop = 0; this.maxPieces = 42;
    this.sequence = DROP_SEQUENCES[(this.round - 1) % DROP_SEQUENCES.length]; this.nextTier = this.sequence[0];
  }
  emit(type, data = {}) { this.events.push({ id: ++this.eventId, type, time: this.time, ...data }); if (this.events.length > 24) this.events.shift(); }
  say(message, seconds = 1.5) { this.message = message; this.messageTime = seconds; }
  finish(outcome, reason = 'Danger line overflow') {
    if (this.outcome) return;
    this.outcome = outcome; this.dragging = false;
    this.resultMetric = outcome === 'success' ? `${MERGE_TIERS[this.bestTier - 1].value} created · ${this.drops} drops` : `${this.score} points · ${reason}`;
    this.say(outcome === 'success' ? 'MERGE COMPLETE!' : 'TANK OVERFLOW!', 99); this.emit(outcome, { x: this.aim, y: 5 });
  }
  makePiece(tier, x, y, vx = 0, vy = 0) {
    if (this.pieces.length >= this.maxPieces || this.outcome) return null;
    tier = clamp(Math.floor(tier), 1, MERGE_TIERS.length);
    const r = MERGE_TIERS[tier - 1].radius;
    const p = { id: ++this.nextId, tier, r, x: clamp(x, this.bounds.left + r, this.bounds.right - r), y, vx, vy, born: this.time, rotation: 0 };
    this.pieces.push(p); this.bestTier = Math.max(this.bestTier, tier); return p;
  }
  point(x) { if (!this.outcome && Number.isFinite(x)) { const r = MERGE_TIERS[this.nextTier - 1].radius; this.aim = clamp(x, this.bounds.left + r, this.bounds.right - r); } }
  pointerDown(u, v, world) { if (this.outcome) return; this.dragging = true; this.pointerMove(u, v, world); }
  pointerMove(u, v, world) { if (this.outcome) return; this.point(Number.isFinite(world?.x) ? world.x : Number.isFinite(u) ? u * 3.05 : this.aim); }
  pointerUp(u, v, world) { if (!this.dragging || this.outcome) return; if (world) this.pointerMove(u, v, world); this.dragging = false; this.drop(); }
  pointerCancel() { if (!this.outcome) this.dragging = false; }
  action(code) { if (!this.outcome && (code === 'Space' || code === 'Enter')) this.drop(); }
  drop() {
    if (this.outcome || this.cooldown > 0) return false;
    if (this.pieces.length >= this.maxPieces) { this.finish('failure', 'Tank is full'); return false; }
    const p = this.makePiece(this.nextTier, this.aim, this.bounds.spawn, 0, -.6);
    if (!p) return false;
    this.drops++; this.cooldown = .45; this.emit('drop', { x: p.x, y: p.y, tier: p.tier });
    this.nextTier = this.sequence[this.drops % this.sequence.length]; this.point(this.aim); return true;
  }
  wall(p) {
    if (p.x - p.r < this.bounds.left) { p.x = this.bounds.left + p.r; p.vx = Math.abs(p.vx) * .24; }
    if (p.x + p.r > this.bounds.right) { p.x = this.bounds.right - p.r; p.vx = -Math.abs(p.vx) * .24; }
    if (p.y - p.r < this.bounds.floor) { p.y = this.bounds.floor + p.r; p.vy = Math.abs(p.vy) > .8 ? -p.vy * .16 : 0; p.vx *= .95; }
  }
  combine(a, b) {
    if (this.outcome || a.tier !== b.tier || a.tier >= MERGE_TIERS.length) return false;
    const ai = this.pieces.indexOf(a), bi = this.pieces.indexOf(b); if (ai < 0 || bi < 0 || ai === bi) return false;
    this.pieces.splice(Math.max(ai, bi), 1); this.pieces.splice(Math.min(ai, bi), 1);
    const p = this.makePiece(a.tier + 1, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.vx + b.vx) * .25, .65);
    this.wall(p); this.merges++; this.score += MERGE_TIERS[p.tier - 1].value; this.pop = .35;
    this.emit('merge', { x: p.x, y: p.y, tier: p.tier });
    if (p.tier >= this.targetTier) this.finish('success');
    return true;
  }
  update(dt) {
    if (this.outcome) return;
    dt = safeDt(dt); if (!dt) return;
    this.time += dt; this.cooldown = Math.max(0, this.cooldown - dt); this.pop = Math.max(0, this.pop - dt);
    this.messageTime = Math.max(0, this.messageTime - dt); if (!this.messageTime) this.message = '';
    const steer = +(this.keys.has('ArrowRight') || this.keys.has('KeyD')) - +(this.keys.has('ArrowLeft') || this.keys.has('KeyA'));
    if (steer) this.point(this.aim + steer * dt * 5);
    for (let remain = dt; remain > 1e-8 && !this.outcome;) {
      const h = Math.min(remain, 1 / 180); remain -= h;
      for (const p of this.pieces) { p.vy = Math.max(-15, p.vy - 15 * h); p.vx *= Math.exp(-h * .38); p.x += p.vx * h; p.y += p.vy * h; p.rotation -= p.vx * h / p.r; this.wall(p); }
      // Resolve several passes for stable piles, merge at most one pair each
      // substep so IDs cannot be consumed twice during a cascade.
      let merged = false;
      for (let pass = 0; pass < 5 && !this.outcome; pass++) {
        pairLoop: for (let i = 0; i < this.pieces.length; i++) for (let j = i + 1; j < this.pieces.length; j++) {
          const a = this.pieces[i], b = this.pieces[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + .005) continue;
          if (!merged && a.tier === b.tier && a.tier < MERGE_TIERS.length && this.time - a.born > .1 && this.time - b.born > .1) { this.combine(a, b); merged = true; break pairLoop; }
          separate(a, b);
        }
        if (!this.outcome) for (const p of this.pieces) this.wall(p);
      }
    }
    if (this.outcome) return;
    const overflowing = this.pieces.some(p => this.time - p.born > .85 && p.y + p.r > this.bounds.danger);
    this.dangerTime = overflowing ? this.dangerTime + dt : Math.max(0, this.dangerTime - dt * 2);
    if (this.dangerTime > .18) this.say('DANGER! MERGE TO MAKE ROOM', .3);
    if (this.dangerTime >= 1.35) this.finish('failure');
  }
  get stats() { return [['NEXT', MERGE_TIERS[this.nextTier - 1].value], ['TARGET', MERGE_TIERS[this.targetTier - 1].value], ['SCORE', this.score]]; }
}

export const GAME_MODELS = { pins: TreasurePins, merge: OrbitMerge };
