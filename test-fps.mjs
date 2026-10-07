import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.min.js';
import { AdRenderer } from './dist/ads-render.js';
import { GAME_META, GAME_MODELS, NeonRange, RANGE_RULES } from './dist/ads-fps.js';
import { GAME_RENDERERS } from './dist/ads-fps-render.js';

const step = (m, seconds, dt = .01) => { for (let i = 0; i < Math.ceil(seconds / dt); i++) m.update(dt); };
const aimAt = (m, target) => { const point = m.project(target); m.point(point.x, point.y); return point; };
const snapshot = m => JSON.stringify(m, (_, value) => value instanceof Set ? [...value] : value);
assert.equal(GAME_META[0].id, 'range'); assert.equal(GAME_META[0].name, 'NEON RANGE');
assert.equal(GAME_MODELS.range, NeonRange); assert.equal(typeof GAME_RENDERERS.range.resize, 'function');

let m = new NeonRange(); assert(m.keys instanceof Set); assert(m.isValidState()); assert.equal(m.stats.length, 3);
const beforeInvalid = snapshot(m);
m.update(NaN); m.update(Infinity); m.update(-5); m.pointerDown(NaN, 0); m.pointerMove(0, Infinity); m.setViewport(0, 0);
assert.equal(snapshot(m), beforeInvalid, 'invalid dt/input/viewport must not corrupt or advance state');
m.point(1e50, -1e50); assert.equal(m.aim.x, .98); assert.equal(m.aim.y, -.94);
m.keys.add('KeyA'); m.keys.add('ArrowDown'); step(m, .5); m.keys.clear(); assert(m.aim.x < .7 && m.aim.y > -.7);
const first = m.targets[0], aim = aimAt(m, first); m.pointerDown(aim.x, aim.y);
assert.equal(m.hits, 1); assert.equal(m.ammo, 5); assert(!first.active); assert.equal(m.score, 110);
assert(m.events.some(e => e.type === 'shot' && e.hit)); assert(m.events.some(e => e.type === 'hit'));
assert.equal(m.shoot(), false, 'repeated action cannot bypass shot cadence');
m.pointerUp(); assert(m.covered); assert(m.reload > 0); assert.equal(m.shoot(), false);
step(m, 1.11); assert.equal(m.ammo, 6); assert.equal(m.reload, 0); assert(first.active); assert(first.generation > 0);

// A held pointer repeats shots at a bounded rate and automatically reloads behind cover.
m = new NeonRange(); m.pointerDown(.97, .92); step(m, .3); assert.equal(m.shotsFired, 2);
step(m, 1); assert.equal(m.ammo, 0); assert(m.reload > 0); assert(m.covered);
step(m, 1.12); assert(m.ammo > 0 && m.ammo < 6); assert(!m.covered); assert(m.events.some(e => e.type === 'reloaded'));
m.pointerCancel(); const shotCount = m.shotsFired; step(m, .5); assert.equal(m.shotsFired, shotCount); assert(m.covered); assert.equal(m.keys.size, 0);

// Manual reload, keyboard-only shooting, aiming, and key release-to-cover all work.
m = new NeonRange(); const p = aimAt(m, m.targets[1]); m.keys.add('Space'); m.action('Space');
assert.equal(m.hits, 1); assert(m.aim.x === p.x); m.keys.delete('Space'); m.update(.01); assert(m.covered);
assert(m.action('Enter')); assert(!m.action('Enter')); step(m, 1.12); assert.equal(m.ammo, 6);

// The closest sphere wins along a ray, with no shooting-through or double hit.
m = new NeonRange();
m.targets[0].x = m.targets[1].x = 0; m.targets[0].y = m.targets[1].y = m.eyeY;
m.targets[0].z = -7; m.targets[1].z = -10; m.pointerDown(0, 0);
assert.equal(m.hits, 1); assert(!m.targets[0].active); assert(m.targets[1].active);
m = new NeonRange(); m.pointerDown(.95, .95); assert.equal(m.hits, 0); assert.equal(m.ammo, 5); assert.equal(m.combo, 0);

// Cover blocks a real telegraphed pulse, while staying exposed loses one shield.
m = new NeonRange(); step(m, 4.75); assert(m.events.some(e => e.type === 'warning')); assert(m.events.some(e => e.type === 'block')); assert.equal(m.shields, 3);
m = new NeonRange(); step(m, 4.25); assert(m.pulses.length > 0); m.pointerDown(.98, .94); step(m, .46);
assert.equal(m.shields, 2); assert(m.events.some(e => e.type === 'damage'));
// Simultaneous incoming pulses cannot remove multiple shields during the same invulnerability window.
m.pulses = [0, 1, 2].map(id => ({ id, age: .895, duration: .9, x: 0, y: 2, z: -7, toX: m.eyeX, toY: m.eyeY }));
step(m, .02); assert.equal(m.shields, 2);
m = new NeonRange(); step(m, 2); assert(m.eyeX > .2 && m.eyeX <= .32);
let strafeAim = aimAt(m, m.targets[0]); m.pointerDown(strafeAim.x, strafeAim.y); assert.equal(m.hits, 1, 'strafe camera and ray origin agree');
m.pointerUp(); m.setReducedMotion(true); step(m, 2); assert.equal(m.eyeX, 0);

function playWin(width = 390, height = 844) {
  const model = new NeonRange(); model.setViewport(width, height);
  for (let frame = 0; frame < 4500 && !model.outcome; frame++) {
    if (!model.reload && !model.cooldown) {
      const target = model.targets.find(t => t.active);
      if (target) { const p = model.project(target); model.pointerDown(p.x, p.y); model.pointerUp(); }
    }
    model.update(.01); assert(model.isValidState());
  }
  assert.equal(model.outcome, 'success'); assert.equal(model.hits, 12); assert.equal(model.accuracy, 100);
  assert(model.time < 45); assert(model.resultMetric.includes('12/12')); return model;
}
for (const dimensions of [[390, 844], [1440, 900], [844, 390]]) playWin(...dimensions);
m = playWin(); const won = snapshot(m);
for (let i = 0; i < 100; i++) { m.update(.05); m.pointerDown(0, 0); m.pointerUp(); m.pointerCancel(); m.action('Space'); m.action('Enter'); m.setViewport(1600, 900); m.setReducedMotion(true); m.say('oops'); m.emit('oops'); m.finish('failure'); }
assert.equal(snapshot(m), won, 'success is terminal and frozen; replay requires a fresh model');
let losing = new NeonRange(); losing.pointerDown(.98, .94);
for (let i = 0; i < 4600 && !losing.outcome; i++) losing.update(.01);
assert.equal(losing.outcome, 'failure'); assert.equal(losing.failureReason, 'SHIELD EMPTY'); assert.equal(losing.shields, 0);
const lost = snapshot(losing); step(losing, 200); losing.action('Space'); assert.equal(snapshot(losing), lost);
const covered = new NeonRange(); step(covered, 46); assert.equal(covered.outcome, 'failure'); assert.equal(covered.failureReason, 'TIME UP'); assert.equal(covered.shields, 3);
const fresh = new NeonRange(); assert.equal(fresh.outcome, null); assert.equal(fresh.hits, 0); assert.equal(fresh.events.length, 0); assert.equal(fresh.time, 0);

// Long randomized input plus repeated fresh rounds maintains fixed state caps.
let seed = 173; const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
for (let round = 0; round < 40; round++) {
  m = new NeonRange(); m.setViewport(round % 2 ? 390 : 1440, round % 2 ? 844 : 900);
  for (let i = 0; i < 1000 && !m.outcome; i++) {
    if (i % 31 === 0) m.pointerDown(rand() * 2 - 1, rand() * 2 - 1);
    if (i % 113 === 0) m.pointerUp(); if (i % 229 === 0) m.pointerCancel();
    m.update(.05); assert(m.isValidState());
  }
  assert(m.outcome); assert(m.events.length <= 24); assert(m.traces.length <= 6); assert(m.pulses.length <= 6);
}

// Real Three.js scene graphs, exact ray/projection agreement, fixed pools, disposal.
// This headless test does not instantiate WebGL or claim browser pixel/performance QA.
const renderer = (w, h) => {
  const r = new AdRenderer({ getBoundingClientRect: () => ({ width: w, height: h }) });
  r.w = w; r.h = h; r.scene = new THREE.Scene(); r.camera = new THREE.OrthographicCamera();
  r.sun = new THREE.DirectionalLight(); r.scene.add(r.sun); r.scene.add(r.sun.target); return r;
};
function inspect(r) {
  const geometries = new Set(), materials = new Set(), textures = new Set(); let objects = 0, triangles = 0;
  r.scene.updateMatrixWorld(true);
  r.scene.traverse(o => {
    objects++; for (const value of [...o.position, ...o.scale, ...o.quaternion, ...o.matrixWorld.elements]) assert(Number.isFinite(value));
    if (o.geometry) {
      geometries.add(o.geometry); const p = o.geometry.attributes.position;
      if (p) for (const n of p.array) assert(Number.isFinite(n));
      if (o.isMesh) triangles += (o.geometry.index?.count ?? p?.count ?? 0) / 3 * (o.isInstancedMesh ? o.count : 1);
      if (o.isInstancedMesh) for (const n of o.instanceMatrix.array) assert(Number.isFinite(n));
    }
    if (o.material) for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(mat); for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
  });
  return { objects, triangles, geometries, materials, textures };
}
for (const [w, h] of [[390, 844], [1440, 900], [844, 390]]) {
  const model = new NeonRange(), r = renderer(w, h); GAME_RENDERERS.range.build(r, model);
  assert(r.camera.isPerspectiveCamera); assert(r.camera.parent === r.scene); assert(r.range.weapon.parent === r.camera);
  const baseline = inspect(r); assert(baseline.objects < 350); assert(baseline.triangles < 60000);
  for (let i = 0; i < 1600 && !model.outcome; i++) {
    if (i % 80 === 0 && !model.reload) {
      const target = model.targets.find(t => t.active); if (target) { const p = model.project(target); model.pointerDown(p.x, p.y); }
    }
    if (i % 80 === 40) model.pointerUp();
    model.update(.02); GAME_RENDERERS.range.update(r, model);
    for (const target of model.targets) {
      const p = new THREE.Vector3(target.x, target.y, target.z).project(r.camera), expected = model.project(target);
      assert(Math.abs(p.x - expected.x) < 1e-10); assert(Math.abs(p.y + expected.y) < 1e-10);
      assert(Math.abs(p.x) < .95 && Math.abs(p.y) < .95, 'all target centers remain on screen');
    }
    if (i % 80 === 0) inspect(r);
  }
  const after = inspect(r); assert.equal(after.objects, baseline.objects); assert.equal(after.geometries.size, baseline.geometries.size); assert.equal(after.materials.size, baseline.materials.size);
  r.lowMotion = true; GAME_RENDERERS.range.update(r, model); assert(r.range.effects.every(e => !e.mesh.visible)); assert(r.range.traces.every(t => !t.visible)); assert(!r.range.muzzle.visible);
  r.w = h; r.h = w; GAME_RENDERERS.range.resize(r, model); GAME_RENDERERS.range.update(r, model); assert(Number.isFinite(r.camera.fov)); assert.equal(r.camera.aspect, h / w); inspect(r);
  let gd = 0, md = 0, td = 0;
  after.geometries.forEach(g => g.addEventListener('dispose', () => gd++)); after.materials.forEach(mat => mat.addEventListener('dispose', () => md++)); after.textures.forEach(t => t.addEventListener('dispose', () => td++));
  r.disposeScene(); assert.equal(gd, after.geometries.size); assert.equal(md, after.materials.size); assert.equal(td, after.textures.size); assert.equal(r.cache.size, 0);
  console.log(`PASS range ${w}×${h}: perspective graph, ${after.objects} objects, ${Math.round(after.triangles)} triangles, stable pools, finite transforms and complete disposal`);
}
console.log('PASS NEON RANGE: pointer/keyboard aim and shooting, ray hits, cadence, reload, cover, telegraphed pulses, shields, success/failure/frozen lifecycle, viewport agreement, 40 bounded stress rounds and reduced motion. GPU rendering/browser pixels not tested.');
