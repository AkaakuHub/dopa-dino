import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.min.js';
import { AdRenderer } from './dist/ads-render.js';
import { GAME_META, GAME_MODELS, TreasurePins, OrbitMerge, PIN_LAYOUTS, MERGE_TIERS } from './dist/ads-pin-merge.js';
import { GAME_RENDERERS } from './dist/ads-pin-merge-render.js';
const advance = (m, seconds, dt = 1 / 120) => { for (let t = 0; t < seconds; t += dt) m.update(dt); };
const snapshot = m => JSON.stringify(m, (key, v) => v instanceof Set ? [...v] : v);
const freezeCheck = m => {
  assert(['success', 'failure'].includes(m.outcome)); assert.equal(typeof m.resultMetric, 'string'); assert(m.resultMetric.length > 4);
  const old = snapshot(m); advance(m, 10); m.action('Space'); m.action('ArrowRight'); m.pointerDown(1, 0, { x: 2, y: 3 }); m.pointerMove(-1, 0, { x: -2, y: 2 }); m.pointerUp(); m.pointerCancel(); assert.equal(snapshot(m), old, 'terminal rounds freeze and do not auto-reset');
};
assert.deepEqual(GAME_META.map(g => g.id), ['pins', 'merge']);
for (const meta of GAME_META) for (const f of ['name', 'hint', 'keys', 'accent']) assert.equal(typeof meta[f], 'string');
for (const id of ['pins', 'merge']) { const m = new GAME_MODELS[id](); assert(m.keys instanceof Set); assert.equal(m.stats.length, 3); assert.equal(m.outcome, null); assert.equal(typeof GAME_RENDERERS[id].world, 'function'); const before = snapshot(m); m.update(NaN); m.update(-2); m.update(Infinity); assert.equal(snapshot(m), before); }

// All four temples are physically solvable. These are real updates and inputs,
// not synthetic result flags or direct changes to heat/gem counters.
for (let round = 1; round <= 12; round++) {
  const m = new TreasurePins(round); assert.equal(m.layout, PIN_LAYOUTS[(round - 1) % 4]); advance(m, 2);
  assert.equal(m.saved, 0); assert.equal(m.outcome, null); assert.equal(m.heat, 1);
  assert(m.particles.filter(p => p.type === 'gem').every(p => p.y > m.layout.gemY));
  const water = m.pins[0]; m.pointerDown(0, 0, { x: (water.x1 + water.x2) / 2, y: water.y });
  assert(water.pulled); assert(!m.pull('water')); advance(m, 2);
  assert.equal(m.heat, 0); assert(m.waterUsed >= 19); assert.equal(m.outcome, null); assert(m.events.some(e => e.type === 'cooled'));
  m.pull('gems'); advance(m, 1.5); assert.equal(m.saved, 0, 'cooled basin gate still holds treasure');
  assert.equal(m.outcome, null); m.pull('drain'); advance(m, 1.6);
  if (m.layout.extraGate) { assert.equal(m.saved, 0, 'extra gate is a real physical gate'); m.pull('chest'); advance(m, 2); }
  assert.equal(m.outcome, 'success', `temple ${round}`); assert.equal(m.saved, 12); assert.equal(m.score, 300);
  assert(m.events.length <= 24); assert.equal(m.particles.length, 58); freezeCheck(m);
  assert.equal(new TreasurePins(round).outcome, null, 'fresh replay');
}
for (let round = 1; round <= 4; round++) {
  const hot = new TreasurePins(round); hot.pull('gems'); advance(hot, 3); assert.equal(hot.outcome, 'failure'); assert.match(hot.resultMetric, /lava/); freezeCheck(hot);
  const spill = new TreasurePins(round); spill.pull('drain'); spill.pull('chest'); advance(spill, 3); assert.equal(spill.outcome, 'failure'); assert.match(spill.resultMetric, /chest/); freezeCheck(spill);
}
{
  const m = new TreasurePins(); m.pointerDown(0, 0, { x: 99, y: 99 }); m.pointerDown(NaN, NaN); assert.equal(m.pulls, 0);
  m.action('ArrowRight'); assert.equal(m.selected, 1); m.action('ArrowLeft'); assert.equal(m.selected, 0); m.action('Enter'); assert(m.pins[0].pulled);
  const drag = new TreasurePins(3); const p = drag.pins[3]; const hx = (p.side < 0 ? p.x1 : p.x2) + p.side * .43; drag.pointerDown(0, 0, { x: hx, z: p.y }); assert(p.pulled, 'large visible ring handle is tappable');
}
console.log('PASS pins: four distinct layouts across 12 rounds, closed-gate collisions, pointer handles, keyboard selection, cooling, secondary gate, all-gem success, both lava failures, bounded particles/events and frozen results');

// An actual aim/drop strategy solves each sequence and both target tiers.
for (let round = 1; round <= 12; round++) {
  const m = new OrbitMerge(round);
  for (let i = 0; i < 40 && !m.outcome; i++) { m.pointerDown(0, 0, { x: 0, y: 9 }); m.pointerUp(0, 0, { x: 0, y: 9 }); advance(m, 1.5); }
  assert.equal(m.outcome, 'success', `merge round ${round}`); assert.equal(m.bestTier, m.targetTier); assert(m.drops <= 16); assert(m.merges > 5); assert(m.score >= 100); assert(m.events.length <= 24); freezeCheck(m);
}
{
  const m = new OrbitMerge(); m.pointerDown(1, 0, { x: 99 }); assert(m.aim < 3); m.pointerCancel(); m.pointerUp(); assert.equal(m.drops, 0);
  m.pointerDown(-1, 0, { x: -1.2 }); m.pointerMove(.4, 0, { x: 1.2 }); m.pointerUp(); assert.equal(m.drops, 1); assert.equal(m.pieces[0].x, 1.2); assert(!m.drop(), 'drop cooldown blocks duplicate events');
  advance(m, .5); m.keys.add('ArrowLeft'); advance(m, .4); m.keys.clear(); assert(m.aim < -.5); m.action('Space'); assert.equal(m.drops, 2);
  const old = m.aim; m.point(NaN); assert.equal(m.aim, old);
}
{
  const floor = new OrbitMerge(); const p = floor.makePiece(2, -2.9, .1, -5, -6); floor.update(.02); assert(p.y >= floor.bounds.floor + p.r); assert(p.x >= floor.bounds.left + p.r); assert(p.vx >= 0); assert(p.vy >= 0);
  const collide = new OrbitMerge(); const a = collide.makePiece(1, 0, 3), b = collide.makePiece(2, .2, 3); collide.update(.02); assert.equal(collide.pieces.length, 2); assert(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - .002, 'unlike circles collide instead of merging');
  const fuse = new OrbitMerge(); fuse.makePiece(2, -.1, 2); fuse.makePiece(2, .1, 2); advance(fuse, .3); assert.equal(fuse.pieces.length, 1); assert.equal(fuse.pieces[0].tier, 3); assert.equal(fuse.score, 8); assert(fuse.events.some(e => e.type === 'merge'));
  const win = new OrbitMerge(); win.makePiece(4, -.3, 2); win.makePiece(4, .3, 2); advance(win, .3); assert.equal(win.outcome, 'success'); freezeCheck(win);
}
{
  // Build a stable unequal-tier column under the danger line. The test observes
  // physical overflow and its grace timer; it never calls finish directly.
  const fail = new OrbitMerge(4); fail.targetTier = 6;
  let y = fail.bounds.floor;
  for (let i = 0; i < 14; i++) { const tier = i % 2 ? 4 : 3, rad = MERGE_TIERS[tier - 1].radius; const p = fail.makePiece(tier, 0, y + rad); p.born = -2; y += rad * 2; }
  advance(fail, 3); assert.equal(fail.outcome, 'failure'); assert.match(fail.resultMetric, /Danger line/); freezeCheck(fail);
  const spawn = new OrbitMerge(); spawn.drop(); advance(spawn, .5); assert.equal(spawn.dangerTime, 0, 'a newly dropped sphere gets travel grace');
  const bounded = new OrbitMerge(); for (let i = 0; i < 60; i++) bounded.makePiece(i % 2 + 1, 0, 1 + i); assert.equal(bounded.pieces.length, bounded.maxPieces); assert(!bounded.drop()); assert.equal(bounded.outcome, 'failure');
}
console.log('PASS merge: 12 input-driven wins, 32/64 targets, drag/drop/cancel, keyboard aim, cooldown, unequal collisions, equal merges, floor/walls, overflow grace/failure, cap and frozen results');

// Real Three graphs and picking without a GPU. Assert scene construction emits
// no merge warnings, and all dimensions match the physics/pointer plane.
const originalError = console.error, originalWarn = console.warn, warnings = [];
console.error = (...args) => warnings.push(args.join(' ')); console.warn = (...args) => warnings.push(args.join(' '));
try {
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) for (const id of ['pins', 'merge']) {
    const canvas = { dataset: {}, getBoundingClientRect: () => ({ width, height }) };
    const r = new AdRenderer(canvas), m = new GAME_MODELS[id](3), impl = GAME_RENDERERS[id]; r.kind = id;
    r.scene = new THREE.Scene(); r.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 120); r.lights(id); impl.build(r, m);
    r.w = width; r.h = height; const h = impl.height(width / height); r.camera.left = -h * width / height / 2; r.camera.right = h * width / height / 2; r.camera.top = h / 2; r.camera.bottom = -h / 2; r.camera.updateProjectionMatrix(); r.camera.updateMatrixWorld();
    const inventory = () => { const geos = new Set(), mats = new Set(r.cache.values()); let meshes = 0, triangles = 0, vertices = 0;
      r.scene.traverse(q => { for (const n of [...q.position, ...q.scale, ...q.rotation.toArray().slice(0, 3)]) assert(Number.isFinite(n));
        if (q.geometry) { geos.add(q.geometry); const a = q.geometry.attributes.position; assert(a.count > 0); vertices += a.count; for (const n of a.array) assert(Number.isFinite(n)); }
        if (q.material) for (const mat of Array.isArray(q.material) ? q.material : [q.material]) mats.add(mat);
        if (q.isMesh) { meshes++; triangles += (q.geometry.index?.count ?? q.geometry.attributes.position.count) / 3; }
      }); return { geos, mats, meshes, triangles, vertices }; };
    const before = inventory(); assert(before.meshes > 50 && before.meshes < 420); assert(before.triangles < 110000); assert(before.vertices > 8000);
    for (const [x, y] of [[0, 1], [-3.55, 6], [3.55, 8.4], [0, 10.8]]) {
      const p = new THREE.Vector3(x, y, 0).project(r.camera), px = (p.x + 1) * width / 2, py = (1 - p.y) * height / 2;
      const q = impl.world(r, px, py); assert(Math.abs(q.x - x) < 1e-7 && Math.abs(q.y - y) < 1e-7, 'vertical cabinet pointer inverse'); assert(px > 0 && px < width && py > 0 && py < height, 'full cabinet stays visible');
    }
    if (id === 'pins') {
      const p = m.pins[0], ndc = new THREE.Vector3((p.x1 + p.x2) / 2, p.y, 0).project(r.camera), world = impl.world(r, (ndc.x + 1) * width / 2, (1 - ndc.y) * height / 2); m.pointerDown(0, 0, world); assert(p.pulled);
    }
    for (let i = 0; i < 600; i++) { if (id === 'merge' && i % 90 === 0) m.drop(); if (id === 'pins' && i === 300) { m.pull('gems'); m.pull('drain'); m.pull('chest'); } m.update(1 / 60); impl.update(r, m); }
    const after = inventory(); assert.equal(after.geos.size, before.geos.size); assert.equal(after.mats.size, before.mats.size); assert.equal(after.meshes, before.meshes);
    r.lowMotion = true; impl.update(r, m); assert(r[id].burst.every(q => !q.mesh.visible));
    let gd = 0, md = 0; after.geos.forEach(g => g.addEventListener('dispose', () => gd++)); after.mats.forEach(mat => mat.addEventListener('dispose', () => md++)); r.disposeScene(); assert.equal(gd, after.geos.size); assert.equal(md, after.mats.size); assert.equal(r.cache.size, 0);
    console.log(`PASS ${id} ${width}×${height}: ${before.meshes} meshes / ${Math.round(before.triangles)} triangles, exact input projection, finite transforms, fixed resources, reduced motion and disposal`);
  }
} finally { console.error = originalError; console.warn = originalWarn; }
assert.deepEqual(warnings, [], 'no invalid geometry batching or Three warnings');
console.log('Headless tests cover real Three scene graphs and model physics; browser pixels, GPU rendering and performance were not verified here.');
