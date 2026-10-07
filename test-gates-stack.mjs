import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.min.js';
import { AdRenderer } from './dist/ads-render.js';
import { GAME_META, GAME_MODELS, GateCrowd, SkyStack } from './dist/ads-gates-stack.js';
import { GAME_RENDERERS } from './dist/ads-gates-stack-render.js';
const step = (model, seconds, dt = .01) => { for (let t = 0; t < seconds; t += dt) model.update(dt); };
const crossing = (model, row, lane) => { model.player.x = model.player.target = lane ? 2 : -2; row.z = 3.999; model.update(.01); };
assert.deepEqual(GAME_META.map(x => x.id), ['gates', 'stack']);
for (const meta of GAME_META) for (const field of ['name', 'hint', 'keys', 'accent']) assert.equal(typeof meta[field], 'string');
for (const id of ['gates', 'stack']) { const model = new GAME_MODELS[id](); assert(model.keys instanceof Set); assert.equal(model.stats.length, 3); assert.equal(typeof GAME_RENDERERS[id].build, 'function'); }

let g = new GateCrowd();
g.pointerDown(-1, 0, { x: -2.4, z: 5 }); step(g, .5); assert(g.player.x < -2.3);
g.pointerMove(1, 0); step(g, .5); assert(g.player.x > 2.3);
g.keys.add('ArrowLeft'); step(g, .5); g.keys.clear(); assert(g.player.x < 0);
const gate = g.rows[0]; g.crowd = 14; crossing(g, gate, 0); assert.equal(g.crowd, 34); assert(gate.passed); assert.equal(gate.chosen, 0);
assert(g.events.some(x => x.type === 'gate'));
g = new GateCrowd(); crossing(g, g.rows[0], 1); assert.equal(g.crowd, 28);
g = new GateCrowd(); g.crowd = 40; crossing(g, g.rows[1], 1); assert.equal(g.crowd, 25); assert(g.flash > 0);
g = new GateCrowd(); crossing(g, g.rows[1], 0); assert.equal(g.crowd, 22);
g = new GateCrowd(); g.crowd = 120; crossing(g, g.rows[3], 0); assert(g.combat); step(g, 2); assert.equal(g.crowd, 107); assert.equal(g.combat, null); assert(g.rows[3].passed);
g = new GateCrowd(); g.crowd = 180; crossing(g, g.rows[5], 0); step(g, 2); assert.equal(g.round, 2); assert.equal(g.cleared, 1); assert.equal(g.rows.length, 6); assert(g.rows.every(x => !x.passed)); assert.equal(g.rows[0].options[0].op, '×');
g = new GateCrowd(); crossing(g, g.rows[5], 0); step(g, .5); assert(g.dead); step(g, 1.8); assert.equal(g.attempt, 2); assert.equal(g.crowd, 14);
// Many rounds retain no old course, no unbounded history, and a sane crowd.
g = new GateCrowd();
for (let round = 0; round < 150; round++) {
  g.crowd = 600;
  crossing(g, g.rows[5], round % 2);
  step(g, 1.7);
  assert.equal(g.round, round + 2);
  assert(g.crowd >= 20 && g.crowd <= 95);
  assert.equal(g.rows.length, 6); assert(g.events.length <= 24);
}
const before = g.time; g.update(NaN); g.update(-1); assert.equal(g.time, before);

let s = new SkyStack(); step(s, .2); const initial = s.active.x; step(s, .4); assert(s.active.x > initial);
s.active.x = s.top.x + .02; s.active.offset = .02; s.action('Space'); assert.equal(s.level, 1); assert.equal(s.combo, 1); assert.equal(s.top.w, 3.65); assert.equal(s.active.axis, 'z');
step(s, .2); s.active.z = s.top.z + .4; s.active.offset = .4; s.pointerDown(); assert.equal(s.level, 2); assert.equal(s.combo, 0); assert(Math.abs(s.top.d - 3.25) < 1e-8); assert(Math.abs(s.top.z - .2) < 1e-8); assert.equal(s.offcuts.length, 1); assert(Math.abs(s.offcuts[0].d - .4) < 1e-8); assert(Math.abs(s.offcuts[0].z - 2.025) < 1e-8);
assert.equal(s.place(), false); assert.equal(s.level, 2); // Repeated pointers cannot double-place.
step(s, .2); s.active.x = 20; s.pointerDown(); assert(s.dead); assert.equal(s.offcuts.length, 2); step(s, 1.5); assert.equal(s.attempt, 2); assert.equal(s.level, 0); assert.equal(s.best, 2);
// Alternate-axis cutting maintains true rectangular intersection.
s = new SkyStack();
for (let i = 0; i < 8; i++) {
  s.lock = 0; const a = s.active, b = s.top, axis = a.axis, dim = axis === 'x' ? 'w' : 'd', delta = (i % 3 ? 1 : -1) * .14;
  const oldSize = b[dim], oldPosition = b[axis];
  a[axis] = oldPosition + delta; s.place();
  assert(Math.abs(s.top[dim] - (oldSize - .14)) < 1e-8);
  assert(Math.abs(s.top[axis] - oldPosition - delta / 2) < 1e-8);
}
s = new SkyStack();
for (let i = 0; i < 5000; i++) {
  s.lock = 0; s.active[s.active.axis] = s.top[s.active.axis]; s.place(); s.update(.016);
  assert(s.blocks.length <= 20); assert(s.offcuts.length <= 8); assert(s.events.length <= 20);
}
assert.equal(s.level, 5000); assert.equal(s.combo, 5000); assert.equal(s.best, 5000); assert.equal(s.top.w, 3.65); assert.equal(s.top.d, 3.65);
step(s, 3); assert.equal(s.message, '');

// Headless scene construction exercises all helpers and DOM-free label fallback.
const renderer = () => {
  const r = new AdRenderer({ getBoundingClientRect: () => ({ width: 390, height: 740 }) });
  r.scene = new THREE.Scene(); r.camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 120);
  r.sun = new THREE.DirectionalLight(0xffffff, 2); r.scene.add(r.sun); r.scene.add(r.sun.target); return r;
};
function inspect(r) {
  const geometry = new Set(), materials = new Set(r.cache.values()), textures = new Set(); let objects = 0;
  r.scene.traverse(o => {
    objects++;
    for (const value of [...o.position, ...o.scale]) assert(Number.isFinite(value));
    assert(Math.abs(o.position.y) < 200, 'floating origin keeps transforms bounded');
    if (o.geometry) { geometry.add(o.geometry); const a = o.geometry.getAttribute('position'); if (a) for (let i = 0; i < a.count * a.itemSize; i++) assert(Number.isFinite(a.array[i])); }
    if (o.material) for (const mat of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(mat); for (const v of Object.values(mat)) if (v?.isTexture) textures.add(v); }
  });
  return { objects, geometry: geometry.size, materials: materials.size, textures: textures.size };
}
for (const id of ['gates', 'stack']) {
  const model = new GAME_MODELS[id](), r = renderer(); GAME_RENDERERS[id].build(r, model); GAME_RENDERERS[id].update(r, model); const baseline = inspect(r);
  if (id === 'gates') {
    for (let i = 0; i < 24; i++) {
      model.crowd = 600; crossing(model, model.rows[0], i % 2); GAME_RENDERERS[id].update(r, model);
      crossing(model, model.rows[5], i % 2);
      for (let t = 0; t < 100; t++) { model.update(.02); if (t % 10 === 0) GAME_RENDERERS[id].update(r, model); }
    }
  } else {
    for (let i = 0; i < 1200; i++) {
      model.lock = 0; model.active[model.active.axis] = model.top[model.active.axis]; model.place(); model.update(.016); GAME_RENDERERS[id].update(r, model);
    }
  }
  r.lowMotion = true; GAME_RENDERERS[id].update(r, model);
  const after = inspect(r); assert.equal(after.objects, baseline.objects); assert.equal(after.geometry, baseline.geometry); assert(after.materials <= baseline.materials + 4);
  console.log(id + ' stable scene:', JSON.stringify(after));
  r.disposeScene();
}
console.log('PASS gates: arithmetic choices, pointer/keyboard steering, avoidable losses, supplies, battle attrition/rewards, round changes, failure/restart, 150 rounds, bounded events.');
console.log('PASS stack: constant-speed motion, perfect snap/combo, alternating axes, exact overlap and offcuts, input lock, failure/restart, retained best, 5,000 floors, bounded history.');
console.log('PASS renderers: headless Three.js construction, DOM fallback, finite geometry/transforms, fixed object/geometry counts, floating origin after 1,200 floors, reduced motion, disposal.');
