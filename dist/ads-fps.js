// A bounded, renderer-independent first-person training range. No people or gore.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const safeDt = n => Number.isFinite(n) ? clamp(n, 0, .05) : 0;
export const RANGE_RULES = Object.freeze({ goal: 12, shields: 3, magazine: 6, seconds: 45, reload: 1.1, shotDelay: .24, targets: 3, events: 24, traces: 6, pulses: 6 });
export const GAME_META = [{ id: 'range', name: 'NEON RANGE', hint: '押して照準・連射 · 離すとカバー＆リロード · ドローン12機', keys: '矢印 / WASD 照準 · SPACE 射撃 · ENTER リロード', accent: '#67f5df' }];

export class NeonRange {
  constructor() {
    this.keys = new Set(); this.time = 0; this.events = []; this.eventId = 0;
    this.outcome = null; this.resultMetric = ''; this.failureReason = '';
    this.hits = 0; this.shotsFired = 0; this.score = 0; this.combo = 0;
    this.shields = RANGE_RULES.shields; this.ammo = RANGE_RULES.magazine;
    this.remaining = RANGE_RULES.seconds; this.reload = 0; this.cooldown = 0;
    this.covered = true; this.coverBlend = 1; this.pointerHeld = false;
    this.player = { x: 0, z: 5 }; this.reducedMotion = false;
    this.aim = { x: 0, y: 0 }; this.aspect = 1; this.tanHalfFov = Math.tan(57 * Math.PI / 360);
    this.flash = 0; this.pop = 0; this.recoil = 0; this.invulnerable = 0;
    this.message = '12 TARGETS · RELEASE TO COVER'; this.messageTime = 3;
    this.traces = []; this.pulses = []; this.serial = 0;
    this.targets = Array.from({ length: RANGE_RULES.targets }, (_, slot) => ({
      slot, generation: 0, active: true, x: (slot - 1) * 2.8, y: 2.35 + slot * .35,
      z: -7 - slot * 1.7, radius: .8, cooldown: 3.8 + slot * 1.05,
      respawn: 0, charge: 0, hit: 0
    }));
  }
  get eyeX() { return this.player.x; }
  get eyeY() { return 2.3 - this.coverBlend * .85; }
  get accuracy() { return this.shotsFired ? Math.round(this.hits / this.shotsFired * 100) : 0; }
  get stats() { return [['TARGETS', `${this.hits}/${RANGE_RULES.goal}`], ['CELLS', this.reload ? 'RELOAD' : `${this.ammo}/${RANGE_RULES.magazine}`], ['SHIELD', `${'◆'.repeat(this.shields)} · ${Math.ceil(this.remaining)}s`]]; }
  setViewport(width, height) {
    // Viewport state is only updated while a round is live. Finished rounds stay frozen.
    if (this.outcome || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    this.aspect = clamp(width / height, .25, 5);
    this.tanHalfFov = Math.max(Math.tan(57 * Math.PI / 360), Math.tan(52 * Math.PI / 360) / this.aspect);
  }
  setReducedMotion(value) {
    if (this.outcome) return;
    this.reducedMotion = !!value;
    if (this.reducedMotion) this.player.x = 0;
  }
  emit(type, data = {}) {
    if (this.outcome) return;
    this.events.push({ id: ++this.eventId, type, time: this.time, ...data });
    if (this.events.length > RANGE_RULES.events) this.events.shift();
  }
  say(text, duration = 1.15) { if (!this.outcome) { this.message = text; this.messageTime = duration; } }
  point(u, v) {
    if (this.outcome || !Number.isFinite(u) || !Number.isFinite(v)) return false;
    this.aim.x = clamp(u, -.98, .98); this.aim.y = clamp(v, -.94, .94); return true;
  }
  pointerDown(u, v) {
    if (!this.point(u, v)) return;
    this.pointerHeld = true; this.covered = this.reload > 0; this.shoot();
  }
  pointerMove(u, v) { this.point(u, v); }
  pointerUp() {
    if (this.outcome) return;
    this.pointerHeld = false; this.covered = true;
    if (this.ammo < RANGE_RULES.magazine) this.beginReload();
  }
  pointerCancel() {
    if (this.outcome) return;
    this.pointerHeld = false; this.covered = true; this.keys.clear();
  }
  action(code) {
    if (this.outcome) return false;
    if (code === 'Space') { this.covered = this.reload > 0; return this.shoot(); }
    if (code === 'Enter' || code === 'KeyR') return this.beginReload();
    return false;
  }
  beginReload() {
    if (this.outcome || this.reload > 0 || this.ammo === RANGE_RULES.magazine) return false;
    this.reload = RANGE_RULES.reload; this.covered = true;
    this.emit('reload'); this.say('IN COVER · RELOADING', RANGE_RULES.reload); return true;
  }
  ray() {
    const x = this.aim.x * this.tanHalfFov * this.aspect, y = -this.aim.y * this.tanHalfFov;
    const length = Math.hypot(x, y, 1); return { x: x / length, y: y / length, z: -1 / length };
  }
  project(target) {
    const depth = 5 - target.z;
    return { x: (target.x - this.eyeX) / (depth * this.tanHalfFov * this.aspect), y: -(target.y - this.eyeY) / (depth * this.tanHalfFov) };
  }
  shoot() {
    if (this.outcome || this.covered || this.reload > 0 || this.cooldown > .000001) return false;
    if (!this.ammo) { this.beginReload(); return false; }
    this.ammo--; this.shotsFired++; this.cooldown = RANGE_RULES.shotDelay; this.recoil = 1;
    const ray = this.ray(); let nearest = 80, target = null;
    for (const candidate of this.targets) {
      if (!candidate.active) continue;
      const x = candidate.x - this.eyeX, y = candidate.y - this.eyeY, z = candidate.z - 5;
      const along = x * ray.x + y * ray.y + z * ray.z;
      // Slightly generous rim matches the whole visible drone, including its hoop.
      const offset2 = x * x + y * y + z * z - along * along;
      const radius = candidate.radius + .13;
      if (along <= 0 || offset2 > radius * radius) continue;
      const distance = along - Math.sqrt(Math.max(0, radius * radius - offset2));
      if (distance < nearest) { nearest = distance; target = candidate; }
    }
    const trace = { id: ++this.serial, age: 0, x: this.eyeX + ray.x * nearest, y: this.eyeY + ray.y * nearest, z: 5 + ray.z * nearest, fromX: this.eyeX, fromY: this.eyeY, hit: !!target };
    this.traces.push(trace); if (this.traces.length > RANGE_RULES.traces) this.traces.shift();
    this.emit('shot', { x: trace.x, y: trace.y, z: trace.z, hit: !!target });
    if (target) {
      target.active = false; target.respawn = .75; target.hit = .55; target.charge = 0;
      this.hits++; this.combo++; this.score += 100 + Math.min(this.combo, 10) * 10; this.pop = .45;
      this.emit('hit', { x: target.x, y: target.y, z: target.z, slot: target.slot, hits: this.hits });
      this.say(`${this.hits} / ${RANGE_RULES.goal} TARGETS`);
      if (this.hits >= RANGE_RULES.goal) { this.finish('success'); return true; }
    } else { this.combo = 0; }
    if (!this.ammo) this.beginReload();
    return true;
  }
  finish(outcome, reason = '') {
    if (this.outcome || !['success', 'failure'].includes(outcome)) return;
    this.failureReason = reason;
    this.resultMetric = `${this.hits}/${RANGE_RULES.goal} TARGETS · ${outcome === 'success' ? this.accuracy + '% ACCURACY' : reason}`;
    this.message = outcome === 'success' ? 'RANGE CLEAR!' : reason;
    this.pointerHeld = false; this.keys.clear(); this.covered = true;
    this.emit(outcome === 'success' ? 'clear' : 'fail', { hits: this.hits, score: this.score, reason });
    this.outcome = outcome;
  }
  update(dt) {
    if (this.outcome) return;
    dt = safeDt(dt); if (!dt) return;
    this.time += dt; this.remaining = Math.max(0, RANGE_RULES.seconds - this.time);
    // A gentle, real rail-strafe gives nearby cover and distant drones parallax.
    this.player.x = this.reducedMotion ? 0 : Math.sin(this.time * .36) * .32;
    for (const key of ['cooldown', 'flash', 'pop', 'invulnerable', 'messageTime']) this[key] = Math.max(0, this[key] - dt);
    this.recoil *= Math.exp(-dt * 19); if (!this.messageTime) this.message = '';
    const dx = +(this.keys.has('ArrowRight') || this.keys.has('KeyD')) - +(this.keys.has('ArrowLeft') || this.keys.has('KeyA'));
    const dy = +(this.keys.has('ArrowDown') || this.keys.has('KeyS')) - +(this.keys.has('ArrowUp') || this.keys.has('KeyW'));
    if (dx || dy) this.point(this.aim.x + dx * dt * .95, this.aim.y + dy * dt * .95);
    if (this.reload > 0) {
      this.reload = Math.max(0, this.reload - dt);
      if (!this.reload) { this.ammo = RANGE_RULES.magazine; this.emit('reloaded'); this.say('CELLS READY', .65); }
    }
    const firing = this.pointerHeld || this.keys.has('Space');
    this.covered = !firing || this.reload > 0;
    this.coverBlend += ((this.covered ? 1 : 0) - this.coverBlend) * Math.min(1, dt * 13);
    for (const target of this.targets) {
      target.hit = Math.max(0, target.hit - dt);
      if (!target.active) {
        target.respawn = Math.max(0, target.respawn - dt);
        if (!target.respawn) {
          target.active = true; target.generation++;
          target.cooldown = 3.25 + (target.slot + target.generation) % 3 * .5;
        } else continue;
      }
      const phase = this.time * (.68 + target.slot * .13) + target.slot * 2.3 + target.generation * .8;
      target.x = (target.slot - 1) * 2.8 + Math.sin(phase) * .6;
      target.y = 2.45 + target.slot * .3 + Math.cos(phase * 1.3) * .3;
      target.z = -7 - target.slot * 1.7 + Math.sin(phase * .7) * .45;
      target.cooldown = Math.max(0, target.cooldown - dt);
      target.charge = clamp(1 - target.cooldown / 1.15, 0, 1);
      if (!target.cooldown) {
        if (this.pulses.length < RANGE_RULES.pulses) this.pulses.push({ id: ++this.serial, age: 0, duration: .9, x: target.x, y: target.y, z: target.z, toX: this.eyeX, toY: this.eyeY });
        this.emit('warning', { slot: target.slot }); target.cooldown = 3.25; target.charge = 0;
      }
    }
    // Resolve visible enemy energy pulses. Cover always blocks; one impact cannot remove multiple shields.
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i]; pulse.age += dt;
      if (pulse.age < pulse.duration) continue;
      this.pulses.splice(i, 1);
      if (this.covered) this.emit('block');
      else if (!this.invulnerable) {
        this.shields = Math.max(0, this.shields - 1); this.combo = 0; this.flash = .35; this.invulnerable = .55;
        this.emit('damage', { shields: this.shields }); this.say('RELEASE TO TAKE COVER');
        if (!this.shields) { this.finish('failure', 'SHIELD EMPTY'); return; }
      }
    }
    for (let i = this.traces.length - 1; i >= 0; i--) { this.traces[i].age += dt; if (this.traces[i].age > .16) this.traces.splice(i, 1); }
    if (!this.remaining) { this.finish('failure', 'TIME UP'); return; }
    if (firing) this.shoot();
  }
  isValidState() {
    const finite = values => values.every(Number.isFinite);
    return finite([this.time, this.remaining, this.ammo, this.reload, this.shields, this.hits, this.aim.x, this.aim.y, this.aspect, this.tanHalfFov, this.coverBlend, this.score, this.eyeX, this.eyeY])
      && this.time >= 0 && this.remaining >= 0 && this.remaining <= RANGE_RULES.seconds
      && this.ammo >= 0 && this.ammo <= RANGE_RULES.magazine && this.shields >= 0 && this.shields <= RANGE_RULES.shields
      && this.hits >= 0 && this.hits <= RANGE_RULES.goal && Math.abs(this.aim.x) <= .98 && Math.abs(this.aim.y) <= .94
      && Math.abs(this.eyeX) <= .32 && this.coverBlend >= 0 && this.coverBlend <= 1 && this.targets.length === RANGE_RULES.targets
      && this.events.length <= RANGE_RULES.events && this.traces.length <= RANGE_RULES.traces && this.pulses.length <= RANGE_RULES.pulses
      && this.targets.every(t => finite([t.x, t.y, t.z, t.cooldown, t.respawn, t.charge, t.hit]) && Math.abs(t.x) <= 3.4 && t.y > 1 && t.y < 4 && t.z > -12 && t.z < -6)
      && this.traces.every(t => finite([t.x, t.y, t.z, t.age, t.fromX, t.fromY]))
      && this.pulses.every(p => finite([p.x, p.y, p.z, p.toX, p.toY, p.age, p.duration]))
      && (this.outcome === null || this.outcome === 'success' || this.outcome === 'failure');
  }
}
export const GAME_MODELS = { range: NeonRange };
