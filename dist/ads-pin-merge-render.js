import * as THREE from './vendor/three.module.min.js';
import { MERGE_TIERS } from './ads-pin-merge.js';
import { surface, roundedBox } from './ads-visuals.js';

const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const verticalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const intersection = new THREE.Vector3();

// Both cabinets are upright, so picking must intersect their front plane,
// rather than the horizontal ground plane used by the road/course games.
export function cabinetWorld(r, x, y) {
  if (!r.camera || !Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0, z: 0 };
  r.camera.updateMatrixWorld();
  r.ray.setFromCamera(new THREE.Vector2(x / Math.max(1, r.w) * 2 - 1, 1 - y / Math.max(1, r.h) * 2), r.camera);
  if (!r.ray.ray.intersectPlane(verticalPlane, intersection)) return { x: 0, y: 0, z: 0 };
  return { x: intersection.x, y: intersection.y, z: intersection.y };
}

function label(r, parent, width, height, fill = '#fff9e8', outline = '#273148') {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let texture = null, ctx = null;
  if (canvas) { canvas.width = 512; canvas.height = 160; ctx = canvas.getContext?.('2d'); if (ctx) { texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; } }
  const material = new THREE.SpriteMaterial({ map: texture, color: texture ? 0xffffff : 0xf0efff, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material); sprite.scale.set(width, height, 1); sprite.renderOrder = 8; parent.add(sprite);
  const item = { sprite, text: '', set(value) {
    const text = String(value); if (text === item.text) return; item.text = text; if (!ctx) return;
    ctx.clearRect(0, 0, 512, 160); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = '900 113px ui-rounded, "Arial Rounded MT Bold", Arial, sans-serif'; ctx.lineWidth = 12; ctx.strokeStyle = outline;
    ctx.strokeText(text, 256, 83, 475); ctx.fillStyle = fill; ctx.fillText(text, 256, 83, 475); texture.needsUpdate = true;
  } }; return item;
}
function mesh(r, geometry, material, parent, x, y, z, sx = 1, sy = 1, sz = 1) {
  const q = r.mesh(geometry, material, parent); q.position.set(x, y, z); q.scale.set(sx, sy, sz); return q;
}
function softBox(r, parent, x, y, z, w, h, d, material, radius = .06) {
  return mesh(r, roundedBox(w, h, d, radius, 2), material, parent, x, y, z);
}
// Shallow, real reliefs catch the key light without competing with the playfield.
function relief(r, parent, x, y, z, scale, material, sun = false) {
  const g = r.group(parent, x, y, z); g.scale.setScalar(scale);
  mesh(r, new THREE.TorusGeometry(.32, .035, 5, 20), material, g, 0, 0, 0);
  mesh(r, sun ? new THREE.CircleGeometry(.22, 12) : new THREE.OctahedronGeometry(.22), material, g, 0, 0, .016, 1, 1, .35);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8, q = r.box(g, Math.sin(a) * .45, Math.cos(a) * .45, 0, .05, .15, .045, material); q.rotation.z = -a;
  }
  return g;
}
function fern(r, parent, x, y, z, size, material) {
  const g = r.group(parent, x, y, z), geo = new THREE.SphereGeometry(1, 6, 4);
  for (let j = 0; j < 5; j++) {
    const a = (j - 2) * .38;
    for (let k = 0; k < 4; k++) {
      const t = (k + 1) / 4, q = mesh(r, geo, material, g, Math.sin(a) * t * .75, t * .65, j % 2 * .06, .095 * (1 - t * .35), .22 * (1 - t * .35), .03);
      q.rotation.z = -a + (k % 2 ? -.25 : .25);
    }
  }
  g.scale.setScalar(size); return g;
}
function burstPool(r, count, colors, round = false) {
  const geo = round ? new THREE.SphereGeometry(1, 8, 6) : new THREE.OctahedronGeometry(1);
  const mats = colors.map(c => r.mat(c, { roughness: .45, metalness: .1, emissive: c, emissiveIntensity: .18 }));
  return Array.from({ length: count }, (_, i) => { const q = mesh(r, geo, mats[i % mats.length], r.scene, 0, 0, 0); q.visible = false; q.castShadow = false; return { mesh: q, born: -100, x: 0, y: 0, angle: 0, speed: 0, steam: round }; });
}
function spawnBurst(pool, e, n, cursor, steam = false) {
  for (let i = 0; i < n; i++) { const q = pool[(cursor + i) % pool.length]; Object.assign(q, { born: e.time, x: e.x || 0, y: e.y || 0, angle: i * 2.399, speed: .9 + i % 5 * .21, steam }); }
  return cursor + n;
}
function updateBurst(pool, time, lowMotion) {
  pool.forEach((q, i) => {
    const t = time - q.born; q.mesh.visible = !lowMotion && t >= 0 && t < .8;
    if (!q.mesh.visible) return;
    q.mesh.position.set(q.x + Math.cos(q.angle) * t * q.speed, q.y + (q.steam ? 1.4 * t : Math.sin(q.angle) * t * q.speed + t - t * t * 2), .45 + Math.sin(i * 2.1) * t * .25);
    q.mesh.scale.setScalar(q.steam ? .1 + t * .17 : .11 * (1 - t)); q.mesh.rotation.set(t * 2, i + t * 4, t * 3);
  });
}
function camera(r, kind) {
  const target = kind === 'pins' ? 5.48 : 5.05;
  r.camera.position.set(.25, target + 1.65, 20); r.camera.lookAt(0, target, 0);
  r.sun.position.set(-7, 15, 10); r.sun.target.position.set(0, 4.5, 0);
}
function buildPins(r, m) {
  const s = r.pins = { pins: [], particles: [], lastEvent: 0, burstCursor: 0, steamCursor: 0 };
  r.scene.background = new THREE.Color(0x344845); r.scene.fog = new THREE.Fog(0x344845, 35, 70);
  const stone = surface(r, 'sand', 0xb99e72, { roughness: .94 }), edge = surface(r, 'stone', 0xe0c799, { roughness: .83 });
  const deepStone = surface(r, 'sand', 0x987d55, { roughness: .96 });
  const gold = surface(r, 'metal', 0xbe914b, { metalness: .74, roughness: .36 });
  const agedBronze = surface(r, 'metal', 0x617b64, { metalness: .55, roughness: .59 });
  const recess = surface(r, 'stone', 0x655c46, { roughness: .95 });
  const staticGroup = r.group();
  // Jointed sandstone, worn edges and cut-out reliefs give the temple weight.
  softBox(r, staticGroup, 0, 5.47, -1.03, 7.65, 11.15, .8, deepStone, .14);
  r.box(staticGroup, 0, 5.45, -.6, 6.14, 9.86, .18, recess);
  for (let row = 0; row < 11; row++) for (let col = 0; col < 4; col++) {
    const x = -2.25 + col * 1.5, y = .95 + row * .87;
    softBox(r, staticGroup, x, y, -.455, 1.47, .845, .13, (row + col) % 3 ? recess : deepStone, .035);
  }
  for (const x of [-3.44, 3.44]) {
    r.box(staticGroup, x, 5.48, -.09, .66, 10.45, 1.15, deepStone);
    for (let i = 0; i < 12; i++) {
      softBox(r, staticGroup, x + Math.sin(i * 2) * .018, .94 + i * .82, .02, .69, .79, 1.16, i % 3 ? stone : edge, .055);
      for (const dx of [-.19, .19]) r.box(staticGroup, x + dx, .97 + i * .82, .615, .027, .52, .025, deepStone);
    }
    for (const y of [.43, 10.65]) {
      softBox(r, staticGroup, x, y, .06, 1.01, .42, 1.4, edge, .06);
      softBox(r, staticGroup, x, y + .15, .77, .73, .085, .06, gold, .02);
    }
    for (const y of [2.45, 5.45, 9.2]) relief(r, staticGroup, x, y, .675, .56, agedBronze);
  }
  softBox(r, staticGroup, 0, 10.78, .05, 7.45, .47, 1.22, edge, .07);
  softBox(r, staticGroup, 0, 11.1, -.02, 5.9, .25, 1.25, stone, .06);
  // Repeating carved frieze under a crowned sun disk, with metal inlay.
  for (let i = 0; i < 13; i++) {
    const x = -2.88 + i * .48;
    const diamond = softBox(r, staticGroup, x, 10.78, .699, .13, .13, .035, deepStone, .015); diamond.rotation.z = Math.PI / 4;
  }
  relief(r, staticGroup, 0, 10.98, .82, .75, gold, true);
  for (const y of [.15, -.09]) softBox(r, staticGroup, 0, y, -.05, y > 0 ? 8.15 : 8.7, y > 0 ? .35 : .19, y > 0 ? 1.8 : 2.05, y > 0 ? stone : edge, .075);
  for (const x of [-3.02, 3.02]) r.box(staticGroup, x, 5.46, -.24, .065, 9.98, .48, edge);
  softBox(r, staticGroup, m.divider.x, (m.divider.bottom + m.divider.top) / 2, -.05, m.divider.width, m.divider.top - m.divider.bottom, .9, edge, .035);
  for (const y of [1.47, m.layout.basinY + .85, Math.min(m.layout.waterY, m.layout.gemY) - .8]) {
    for (const x of [-2.58, 2.58]) relief(r, staticGroup, x, y, -.33, .36, agedBronze);
  }
  const leafGeo = new THREE.SphereGeometry(1, 8, 5), leafMats = [surface(r, 'turf', 0x557344), surface(r, 'turf', 0x81934e)];
  for (const side of [-1, 1]) {
    const x = side * 3.84;
    r.tube(staticGroup, [[x, 11.05, -.2], [x + side * .14, 9.6, .13], [x - side * .08, 8.65, .43], [x + side * .05, 7.72, .52]], .04, leafMats[0]);
    for (let i = 0; i < 15; i++) { const q = mesh(r, leafGeo, leafMats[i % 2], staticGroup, x + Math.sin(i * 2.3) * .17, 10.86 - i * .21, .3 + i * .023, .13, .22, .035); q.rotation.z = (i % 2 ? 1 : -1) * .65; }
    fern(r, staticGroup, side * 3.9, .34, .36, .85, leafMats[1]);
    // Terracotta offering bowl and a pair of rough stones at the foot of each pillar.
    r.cylinder(staticGroup, side * 3.92, .38, .12, .29, .17, .23, deepStone, 10);
    for (let i = 0; i < 2; i++) mesh(r, new THREE.DodecahedronGeometry(.2), stone, staticGroup, side * (3.43 + i * .25), .31, .58, 1, .55, .8);
  }
  // Joint cracks are deliberately sparse so the chamber remains readable.
  for (let i = 0; i < 9; i++) {
    const x = (i % 2 ? -1 : 1) * (1.17 + i % 3 * .44), y = 2.2 + i * .77;
    const crack = r.box(staticGroup, x, y, -.369, .016, .28, .015, deepStone); crack.rotation.z = .4 + i % 3 * .3;
  }
  r.mergeStatic(staticGroup);
  const basinMat = surface(r, 'lava', 0xffa65a, { emissive: 0xff531b, emissiveIntensity: .66, metalness: .04, roughness: .65 });
  s.basin = r.box(r.scene, 0, m.layout.basinY + .25, -.09, 5.92, .52, .45, basinMat);
  s.basinTop = r.box(r.scene, 0, m.layout.basinY + .525, .015, 5.93, .045, .66, surface(r, 'lava', 0xffda83, { emissive: 0xff791e, emissiveIntensity: .8, roughness: .52 }));
  s.hotBasin = s.basin.material; s.hotBasinTop = s.basinTop.material;
  s.coldBasin = surface(r, 'obsidian', 0x424c4b, { roughness: .86, metalness: .08 });
  s.coldBasinTop = surface(r, 'obsidian', 0x727c72, { roughness: .77, metalness: .12 });
  s.basinLight = new THREE.PointLight(0xff772b, 3.5, 6, 2); s.basinLight.position.set(0, m.layout.basinY + .62, 1.1); r.scene.add(s.basinLight);
  s.status = label(r, r.scene, 3.45, .42, '#ffdd93', '#3a3444'); s.status.sprite.position.set(0, m.layout.basinY + 1.06, .46);
  // Hardware is mounted in front of the pillar faces (z=.6), not buried
  // inside their stone volume. The physical x/y pin plane remains unchanged.
  const rodGeo = new THREE.CylinderGeometry(.1, .1, 1, 14), ringGeo = new THREE.TorusGeometry(.27, .075, 8, 24);
  for (const p of m.pins) {
    const group = r.group(), span = p.x2 - p.x1, mid = (p.x2 + p.x1) / 2;
    const rod = mesh(r, rodGeo, gold, group, mid, p.y, .76, 1, span + .45, 1); rod.rotation.z = Math.PI / 2;
    const handleX = (p.side < 0 ? p.x1 : p.x2) + p.side * .43;
    const handle = mesh(r, ringGeo, gold, group, handleX, p.y, .79);
    for (const x of [p.x1 + .13, p.x2 - .13]) {
      const collar = r.cylinder(group, x, p.y, .76, .137, .137, .11, agedBronze, 12); collar.rotation.z = Math.PI / 2;
    }
    const core = mesh(r, new THREE.CircleGeometry(.21, 20), r.mat(p.tint, { emissive: p.tint, emissiveIntensity: .22, side: THREE.DoubleSide }), group, handleX, p.y, .795); core.castShadow = false;
    const number = label(r, group, .35, .27, '#fffcec', '#534723'); number.set(s.pins.length + 1); number.sprite.position.set(handleX, p.y, .91);
    const socket = r.cylinder(r.scene, p.side < 0 ? p.x1 : p.x2, p.y, .76, .16, .16, .26, agedBronze, 12); socket.rotation.z = Math.PI / 2;
    const select = mesh(r, new THREE.TorusGeometry(.39, .027, 6, 28), r.mat(0xffffff, { emissive: 0xc9f7ff, emissiveIntensity: 1 }), group, handleX, p.y, .85); select.visible = false;
    s.pins.push({ group, handle, core, number, select });
  }
  const gemGeo = new THREE.OctahedronGeometry(1), dropGeo = new THREE.SphereGeometry(1, 10, 7), lavaGeo = new THREE.IcosahedronGeometry(1, 1);
  s.waterMat = surface(r, 'water', 0x51bcce, { roughness: .095, metalness: .23, emissive: 0x176777, emissiveIntensity: .11 });
  s.gemMats = [r.mat(0x63f4c4, { metalness: .35, roughness: .15, emissive: 0x2fae96, emissiveIntensity: .2 }), r.mat(0x6ed5ff, { metalness: .4, roughness: .13 }), r.mat(0xd2a0ff, { metalness: .4, roughness: .2 })];
  s.lavaMat = surface(r, 'lava', 0xff9040, { emissive: 0xff471c, emissiveIntensity: .82, roughness: .66 });
  s.stoneMat = surface(r, 'obsidian', 0x4d5352, { roughness: .84, metalness: .12 });
  m.particles.forEach((p, i) => { const q = mesh(r, p.type === 'gem' ? gemGeo : p.type === 'water' ? dropGeo : lavaGeo, p.type === 'gem' ? s.gemMats[i % 3] : p.type === 'water' ? s.waterMat : s.lavaMat, r.scene, p.x, p.y, 0, p.r, p.r, p.r); s.particles.push(q); });
  // Thin meniscus behind the water drops makes the undisturbed reservoir read as liquid.
  const waterGate = m.pins[0], poolWidth = waterGate.x2 - waterGate.x1 - .24;
  s.waterSheet = softBox(r, r.scene, (waterGate.x1 + waterGate.x2) / 2, waterGate.y + .58, -.04, poolWidth, 1.06, .22, s.waterMat, .075);
  s.waterRim = softBox(r, r.scene, s.waterSheet.position.x, waterGate.y + 1.12, .005, poolWidth, .045, .3, surface(r, 'water', 0xc2f2ea, { roughness: .11, metalness: .08 }), .018);
  // Wide open treasure chest: individual wood boards, gold corner straps, keyhole
  // and an open hinged lid. Its collection mouth matches the model's floor.
  const chest = s.chest = r.group(r.scene, 0, .62, .18);
  const timber = surface(r, 'wood', 0x8c4e29), lightTimber = surface(r, 'wood', 0xaf7141), darkTimber = surface(r, 'wood', 0x422f23);
  softBox(r, chest, 0, .17, 0, 5.92, .54, .95, darkTimber);
  for (let i = 0; i < 9; i++) r.box(chest, -2.64 + i * .66, .22, .5, .63, .46, .09, i % 2 ? timber : lightTimber);
  for (const x of [-2.75, -1.7, 1.7, 2.75]) { r.box(chest, x, .25, .555, .13, .54, .08, gold); r.box(chest, x, .52, .06, .13, .08, 1.03, gold); }
  for (const y of [-.035, .51]) r.box(chest, 0, y, .555, 5.9, .075, .075, gold);
  r.box(chest, 0, .29, .63, .4, .35, .1, gold); r.box(chest, 0, .29, .7, .055, .16, .03, 0x5b3b37);
  const lid = r.group(chest, 0, .5, -.46); lid.rotation.x = -1.05;
  r.box(lid, 0, 0, -.47, 5.92, .15, .94, timber);
  for (const x of [-2.74, -1.7, 1.7, 2.74]) r.box(lid, x, .085, -.47, .14, .045, .95, gold);
  r.box(lid, 0, .09, -.92, 5.92, .05, .085, gold);
  // Small rivets and corner caps survive at phone scale as real highlights.
  for (const x of [-2.75, -1.7, 1.7, 2.75]) for (const y of [.06, .43]) mesh(r, new THREE.SphereGeometry(.044, 6, 4), agedBronze, chest, x, y, .61, 1, 1, .5);
  r.mergeStatic(chest);
  s.loot = Array.from({ length: m.totalGems }, (_, i) => { const q = mesh(r, gemGeo, s.gemMats[i % 3], chest, (i % 6 - 2.5) * .68, .46 + Math.floor(i / 6) * .16, (i % 2 ? .16 : -.05), .18, .18, .18); q.visible = false; return q; });
  s.burst = burstPool(r, 32, [0xffd76e, 0x76f4d7, 0xb5e8ff]); s.steam = burstPool(r, 20, [0xcde5e2, 0xe6efe1], true);
  s.caption = label(r, r.scene, 4.7, .43, '#f6e5b9', '#343b31'); s.caption.set(m.layout.name); s.caption.sprite.position.set(0, 11.55, .1);
  camera(r, 'pins'); updatePins(r, m);
}
function updatePins(r, m) {
  const s = r.pins, t = r.lowMotion ? 0 : m.time;
  s.pins.forEach((v, i) => {
    const p = m.pins[i], progress = p.pulled ? clamp((m.time - p.pulledAt) / .42, 0, 1) : 0;
    v.group.position.x = progress * p.side * (p.x2 - p.x1 + 1.3); v.group.visible = !p.pulled || progress < 1;
    v.select.visible = !p.pulled && m.selected === i; v.select.scale.setScalar(r.lowMotion ? 1 : 1 + Math.sin(t * 5) * .04);
  });
  const drain = m.pins[2].pulled;
  s.basin.visible = s.basinTop.visible = !drain;
  s.waterSheet.visible = s.waterRim.visible = !m.pins[0].pulled;
  s.basinLight.intensity = !drain ? m.heat * (3.5 + Math.sin(t * 3) * .35) : 0;
  s.basin.material = m.heat > .001 ? s.hotBasin : s.coldBasin;
  s.basinTop.material = m.heat > .001 ? s.hotBasinTop : s.coldBasinTop;
  s.hotBasin.emissiveIntensity = m.heat * .66; s.hotBasinTop.emissiveIntensity = m.heat * .8;
  s.status.set(m.heat > .001 ? `LAVA ${Math.round(m.heat * 100)}°` : 'COOLED ✓'); s.status.sprite.visible = !drain;
  s.particles.forEach((q, i) => { const p = m.particles[i]; q.visible = p.active; if (!p.active) return;
    q.position.set(p.x, p.y, p.type === 'gem' ? .26 : .16); q.rotation.set(p.spin, p.spin * .7, p.spin * .2);
    q.material = p.type === 'lava' ? m.heat > .001 ? s.lavaMat : s.stoneMat : p.type === 'water' ? s.waterMat : s.gemMats[i % 3];
    if (p.type === 'water') q.scale.set(p.r * .88, p.r * (1 + Math.min(.7, Math.abs(p.vy) * .06)), p.r);
  });
  s.loot.forEach((q, i) => q.visible = i < m.saved);
  for (const e of m.events) { if (e.id <= s.lastEvent) continue; s.lastEvent = e.id;
    if (e.type === 'steam') s.steamCursor = spawnBurst(s.steam, e, 2, s.steamCursor, true);
    if (e.type === 'gem' || e.type === 'success' || e.type === 'cooled') s.burstCursor = spawnBurst(s.burst, e, e.type === 'success' ? 24 : 7, s.burstCursor);
  }
  updateBurst(s.burst, m.time, r.lowMotion); updateBurst(s.steam, m.time, r.lowMotion); camera(r, 'pins');
}

function buildMerge(r, m) {
  const s = r.merge = { pieces: [], lastEvent: 0, burstCursor: 0 };
  r.scene.background = new THREE.Color(0x5b716e); r.scene.fog = new THREE.Fog(0x5b716e, 35, 70);
  const porcelain = surface(r, 'ceramic', 0xf2ead6, { roughness: .22, metalness: .035 });
  const enamel = surface(r, 'ceramic', 0x8db9a5, { roughness: .29, metalness: .08 });
  const inset = surface(r, 'fabric', 0x3e635b, { roughness: .9 });
  const brass = surface(r, 'metal', 0xc6a26b, { metalness: .72, roughness: .28 });
  const walnut = surface(r, 'wood', 0x725040, { roughness: .6 });
  const marble = surface(r, 'marble', 0xe2ddc5, { roughness: .32 });
  const glow = r.mat(0xfff0c4, { emissive: 0xffcc89, emissiveIntensity: .24, roughness: .32 });
  const staticGroup = r.group();
  // A confectioner's glazed cabinet: porcelain molding, warm brass, walnut feet
  // and a deeply upholstered inset rather than a flat luminous rectangle.
  softBox(r, staticGroup, 0, 4.95, -1.05, 7.52, 10.25, 1.24, walnut, .22);
  softBox(r, staticGroup, 0, 4.98, -.75, 7.28, 10.05, .78, enamel, .24);
  softBox(r, staticGroup, 0, 4.87, -.315, 6.1, 8.6, .12, inset, .1);
  // Upholstery seams are geometry; small buttons emphasize the backplane depth.
  const seam = surface(r, 'fabric', 0x628778, { roughness: .93 });
  for (let row = 0; row < 10; row++) for (let col = 0; col < 7; col++) {
    const x = -2.64 + col * .88, y = 1.12 + row * .82;
    const tile = r.box(staticGroup, x, y, -.236, .016, .67, .018, seam); tile.rotation.z = .81;
    const other = r.box(staticGroup, x, y, -.236, .016, .67, .018, seam); other.rotation.z = -.81;
    if ((row + col) % 2 === 0) mesh(r, new THREE.SphereGeometry(.029, 6, 4), brass, staticGroup, x, y, -.205, 1, 1, .45);
  }
  for (const side of [-1, 1]) {
    softBox(r, staticGroup, side * 3.31, 4.97, .06, .53, 9.14, .95, porcelain, .14);
    r.cylinder(staticGroup, side * 3.34, 4.92, .61, .115, .115, 8.29, enamel, 12);
    for (const dx of [-.19, .19]) softBox(r, staticGroup, side * 3.31 + dx, 4.94, .52, .032, 8.47, .045, brass, .012);
    for (const y of [.9, 9.12]) {
      softBox(r, staticGroup, side * 3.31, y, .1, .7, .24, 1.08, brass, .045);
      softBox(r, staticGroup, side * 3.31, y + .14, .1, .63, .1, 1.02, porcelain, .025);
    }
    for (const y of [1.4, 4.95, 8.5]) {
      const bolt = r.cylinder(staticGroup, side * 3.33, y, .734, .053, .053, .05, brass, 10); bolt.rotation.x = Math.PI / 2;
      r.box(staticGroup, side * 3.33, y, .762, .05, .01, .007, walnut);
    }
    softBox(r, staticGroup, side * 2.72, -.03, -.13, .93, .4, 1.66, walnut, .1);
    softBox(r, staticGroup, side * 2.72, -.16, -.04, .79, .1, 1.47, brass, .045);
  }
  softBox(r, staticGroup, 0, .34, .12, 7.18, .63, 1.37, marble, .11);
  softBox(r, staticGroup, 0, .66, .08, 6.1, .074, .78, porcelain, .028);
  softBox(r, staticGroup, 0, .37, .844, 6.68, .36, .055, enamel, .055);
  for (const y of [.15, .56]) softBox(r, staticGroup, 0, y, .827, 6.87, .035, .034, brass, .012);
  // A scalloped marquee, tiny inlaid rosettes and a mechanical coin slot.
  softBox(r, staticGroup, 0, 9.6, .03, 7.17, .4, 1.13, porcelain, .12);
  softBox(r, staticGroup, 0, 9.83, -.05, 6.74, .16, 1.2, brass, .045);
  for (let i = 0; i < 17; i++) {
    const scallop = r.cylinder(staticGroup, -3.13 + i * .391, 9.43, .53, .185, .185, .08, enamel, 12); scallop.rotation.x = Math.PI / 2;
  }
  for (const x of [-2.4, 2.4]) relief(r, staticGroup, x, .35, .9, .3, brass, true);
  softBox(r, staticGroup, 0, .34, .901, 1.25, .22, .06, brass, .04);
  softBox(r, staticGroup, -.06, .34, .938, .55, .028, .01, walnut, .01);
  const coin = r.cylinder(staticGroup, .39, .34, .943, .055, .055, .016, porcelain, 12); coin.rotation.x = Math.PI / 2;
  // Thin side glass has a visible polished edge; there is no front sheet to obscure numbers.
  const glass = surface(r, 'ceramic', 0xc7ebe0, { roughness: .1, metalness: .12, transparent: true, opacity: .19, depthWrite: false });
  for (const side of [-1, 1]) {
    const pane = softBox(r, staticGroup, side * 3.07, 4.95, .06, .026, 8.45, .78, glass, .01); pane.castShadow = false;
    softBox(r, staticGroup, side * 3.053, 4.95, .456, .03, 8.45, .024, porcelain, .008);
  }
  r.mergeStatic(staticGroup);
  // Warning dashes sit at exactly the model's danger height.
  s.danger = r.group(); s.dangerMat = r.mat(0xff7d98, { emissive: 0xff496c, emissiveIntensity: .4, transparent: true, opacity: .65 });
  const dashGeo = new THREE.BoxGeometry(.29, .047, .05);
  for (let i = 0; i < 15; i++) mesh(r, dashGeo, s.dangerMat, s.danger, -2.8 + i * .4, m.bounds.danger, .4);
  s.warning = label(r, r.scene, 1.4, .23, '#ffa1b1', '#532a4f'); s.warning.set('DANGER'); s.warning.sprite.position.set(-2.22, m.bounds.danger + .26, .4);
  // Six tactile finishes: sea glass, blue glaze, lavender marble, strawberry
  // porcelain, brushed-gold bonbon and pale jade. No emissive sphere palette.
  s.palette = [
    surface(r, 'ceramic', 0x79d7bd, { roughness: .09, metalness: .19, repeat: [1, 1], bumpScale: .004 }),
    surface(r, 'ceramic', 0x85bedc, { roughness: .24, metalness: .035, repeat: [2, 1], bumpScale: .028 }),
    surface(r, 'marble', 0xb49fd1, { roughness: .2, metalness: .07, repeat: [1, 1] }),
    surface(r, 'ceramic', 0xe9a3b7, { roughness: .17, metalness: .02, repeat: [3, 2], bumpScale: .012 }),
    surface(r, 'metal', 0xe6bd6a, { roughness: .35, metalness: .52, repeat: [1, 1] }),
    surface(r, 'marble', 0xd8e7a1, { roughness: .25, metalness: .05, repeat: [2, 2] })
  ];
  s.accents = [0xdef7ea, 0xd5eaf1, 0xe9dced, 0xffeadb, 0xffe5a4, 0xf4f4ca].map(c => surface(r, 'ceramic', c, { roughness: .26, metalness: .06 }));
  s.sphereGeo = new THREE.SphereGeometry(1, 22, 16);
  // The numbered badge follows the sphere surface, so it cannot disappear
  // inside the body or look like a floating flat decal at oblique angles.
  s.faceGeo = new THREE.SphereGeometry(1.008, 20, 6, 0, TAU, 0, .59); s.faceGeo.rotateX(Math.PI / 2);
  s.faceMat = surface(r, 'ceramic', 0xfff4dc, { roughness: .23 });
  s.ringGeo = new THREE.TorusGeometry(.555, .022, 6, 28);
  s.ringMat = brass;
  s.seamGeo = new THREE.TorusGeometry(.977, .018, 5, 28);
  s.glintGeo = new THREE.SphereGeometry(.11, 8, 6);
  s.glintMat = r.mat(0xfffcf0, { roughness: .12, transparent: true, opacity: .55, depthWrite: false });
  function orb(parent) {
    const group = r.group(parent); const body = mesh(r, s.sphereGeo, s.palette[0], group, 0, 0, 0);
    const face = mesh(r, s.faceGeo, s.faceMat, group, 0, 0, 0); face.castShadow = false;
    const ring = mesh(r, s.ringGeo, s.ringMat, group, 0, 0, .836); ring.castShadow = false;
    const ribbon = mesh(r, s.seamGeo, s.accents[0], group, 0, 0, 0); ribbon.rotation.set(.55, -.27, .3); ribbon.castShadow = false;
    const text = label(r, group, .95, .71, '#4b544c', '#fff8e5'); text.sprite.position.z = 1.025;
    const glint = mesh(r, s.glintGeo, s.glintMat, group, -.36, .63, .68, 1.45, .55, .15); glint.rotation.z = -.5; glint.castShadow = false;
    group.visible = false; return { group, body, text, face, ring, ribbon, glint };
  }
  for (let i = 0; i < m.maxPieces; i++) s.pieces.push(orb(r.scene));
  s.next = orb(r.scene);
  s.launcher = r.group();
  softBox(r, s.launcher, 0, 0, -.25, 1.22, .32, .8, brass, .1);
  softBox(r, s.launcher, 0, .015, .17, .83, .18, .05, enamel, .05);
  for (const side of [-1, 1]) {
    const arm = softBox(r, s.launcher, side * .47, -.28, .04, .15, .46, .36, porcelain, .06); arm.rotation.z = side * -.19;
    softBox(r, s.launcher, side * .49, -.46, .21, .2, .09, .17, brass, .035);
  }
  r.mergeStatic(s.launcher);
  s.guide = r.group();
  const dotGeo = new THREE.SphereGeometry(.027, 7, 5), dotMat = r.mat(0xffefd0, { emissive: 0xffd899, emissiveIntensity: .16, transparent: true, opacity: .55 });
  for (let i = 0; i < 22; i++) mesh(r, dotGeo, dotMat, s.guide, 0, .9 + i * .35, .7);
  s.aimRing = mesh(r, new THREE.TorusGeometry(1, .034, 6, 28), glow, r.scene, 0, .78, .1); s.aimRing.rotation.x = Math.PI / 2;
  s.target = label(r, r.scene, 4, .6, '#fff2d3', '#3c5a53'); s.target.set(`MAKE ${MERGE_TIERS[m.targetTier - 1].value}`); s.target.sprite.position.set(0, 10.31, .1);
  s.tip = label(r, r.scene, 4.1, .38, '#d9e8d8', '#3c5a53'); s.tip.set('AIM · DROP · MERGE'); s.tip.sprite.position.set(0, 10.89, .1);
  s.burst = burstPool(r, 42, MERGE_TIERS.map(q => q.color));
  camera(r, 'merge'); updateMerge(r, m);
}
function setOrb(view, piece, s, time, lowMotion) {
  view.group.visible = !!piece; if (!piece) return;
  const radius = piece.r || MERGE_TIERS[piece.tier - 1].radius;
  const age = Math.max(0, time - (piece.born ?? -100)), squash = lowMotion || age >= .22 ? 0 : Math.sin(age / .22 * Math.PI) * .1;
  view.group.position.set(piece.x, piece.y, .2); view.group.scale.set(radius * (1 + squash), radius * (1 - squash), radius);
  view.body.material = s.palette[piece.tier - 1]; view.body.rotation.z = piece.rotation || 0;
  view.ribbon.material = s.accents[piece.tier - 1]; view.ribbon.rotation.z = (piece.rotation || 0) + piece.tier * .31;
  view.ribbon.visible = piece.tier !== 3 && piece.tier !== 6;
  view.face.material = piece.tier === 5 ? s.accents[4] : s.faceMat;
  view.text.set(MERGE_TIERS[piece.tier - 1].value);
}
function updateMerge(r, m) {
  const s = r.merge, t = r.lowMotion ? 0 : m.time;
  s.pieces.forEach((q, i) => setOrb(q, m.pieces[i], s, m.time, r.lowMotion));
  const next = { tier: m.nextTier, x: m.aim, y: m.bounds.spawn, born: -100 };
  setOrb(s.next, m.outcome ? null : next, s, m.time, true);
  s.next.group.visible = !m.outcome && m.cooldown <= .13;
  s.launcher.position.set(m.aim, 9.29, 0); s.launcher.visible = !m.outcome;
  s.guide.position.x = m.aim; s.guide.visible = !m.outcome;
  const rNext = MERGE_TIERS[m.nextTier - 1].radius;
  let landing = m.bounds.floor + rNext;
  for (const p of m.pieces) { const dx = m.aim - p.x, sum = p.r + rNext; if (Math.abs(dx) < sum) landing = Math.max(landing, p.y + Math.sqrt(sum * sum - dx * dx)); }
  s.guide.children.forEach(q => q.visible = q.position.y > landing + rNext && q.position.y < m.bounds.spawn - rNext);
  s.aimRing.visible = !m.outcome; s.aimRing.position.set(m.aim, landing - rNext + .04, .2); s.aimRing.scale.setScalar(rNext);
  s.dangerMat.opacity = m.dangerTime > .1 ? .7 + (r.lowMotion ? 0 : Math.sin(t * 12) * .27) : .45;
  s.dangerMat.emissiveIntensity = m.dangerTime > .1 ? 1.05 : .25;
  for (const e of m.events) { if (e.id <= s.lastEvent) continue; s.lastEvent = e.id; if (e.type === 'merge' || e.type === 'success') s.burstCursor = spawnBurst(s.burst, e, e.type === 'success' ? 32 : 10, s.burstCursor); }
  updateBurst(s.burst, m.time, r.lowMotion); camera(r, 'merge');
}

export const GAME_RENDERERS = {
  pins: { build: buildPins, update: updatePins, world: cabinetWorld, height: aspect => Math.max(13.2, 9.25 / Math.max(.25, aspect)) },
  merge: { build: buildMerge, update: updateMerge, world: cabinetWorld, height: aspect => Math.max(12.65, 8.35 / Math.max(.25, aspect)) }
};
