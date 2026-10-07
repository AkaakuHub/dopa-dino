import * as THREE from './vendor/three.module.min.js';
import { MERGE_TIERS } from './ads-pin-merge.js';

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
function beam(r, parent, a, b, radius, color) {
  const delta = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
  const q = r.cylinder(parent, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, radius, radius, delta.length(), color, 10);
  q.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return q;
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
  r.scene.background = new THREE.Color(0x243c50); r.scene.fog = new THREE.Fog(0x243c50, 35, 70);
  const stone = r.mat(0x627d89, { roughness: .85 }), edge = r.mat(0x9bb3af, { roughness: .7 });
  const gold = r.mat(0xffcb67, { metalness: .6, roughness: .26 }), recess = r.mat(0x24465a, { roughness: .9 });
  const staticGroup = r.group();
  // Carved temple, arch, ornamented pillars and deep chamber backplates.
  r.box(staticGroup, 0, 5.47, -1.03, 7.65, 11.15, .8, stone);
  r.box(staticGroup, 0, 5.45, -.55, 6.14, 9.86, .24, recess);
  for (const x of [-3.44, 3.44]) {
    r.box(staticGroup, x, 5.48, -.04, .65, 10.45, 1.15, stone);
    for (let i = 0; i < 12; i++) r.box(staticGroup, x, .9 + i * .82, .58, .67, .025, .025, 0x425e70);
    for (const y of [.43, 10.65]) { r.box(staticGroup, x, y, .02, .92, .42, 1.38, edge); r.box(staticGroup, x, y + .15, .72, .57, .085, .07, gold); }
    for (const y of [2.45, 5.45, 9.2]) { const ornament = r.mesh(new THREE.OctahedronGeometry(.18), gold, staticGroup); ornament.position.set(x, y, .69); ornament.scale.z = .3; }
  }
  r.box(staticGroup, 0, 10.78, .06, 7.45, .47, 1.22, edge);
  r.box(staticGroup, 0, 11.1, -.02, 5.9, .25, 1.25, stone);
  r.box(staticGroup, 0, .15, -.05, 8.15, .35, 1.8, stone);
  r.box(staticGroup, 0, -.09, -.15, 8.7, .19, 2.05, edge);
  // Relief lines communicate the physical walls without a flat outlined board.
  for (const x of [-3.02, 3.02]) r.box(staticGroup, x, 5.46, -.24, .065, 9.98, .48, 0x9fb6b4);
  r.box(staticGroup, m.divider.x, (m.divider.bottom + m.divider.top) / 2, -.05, m.divider.width, m.divider.top - m.divider.bottom, .9, edge);
  for (const y of [1.47, m.layout.basinY + .73, Math.min(m.layout.waterY, m.layout.gemY) - .8]) {
    for (const x of [-2.58, 2.58]) { const icon = r.mesh(new THREE.BoxGeometry(.26, .26, .035), 0x376071, staticGroup); icon.position.set(x, y, -.4); icon.rotation.z = Math.PI / 4; }
  }
  // Moss and vines are modelled leaves with actual depth and soft shadows.
  const leafGeo = new THREE.SphereGeometry(1, 8, 5), leafMats = [r.mat(0x559766), r.mat(0x75b87c)];
  for (const side of [-1, 1]) {
    const x = side * 3.84;
    r.tube(staticGroup, [[x, 11.05, -.2], [x + side * .14, 9.6, .13], [x - side * .08, 8.65, .43], [x + side * .05, 7.72, .52]], .035, 0x477056);
    for (let i = 0; i < 11; i++) { const q = mesh(r, leafGeo, leafMats[i % 2], staticGroup, x + Math.sin(i * 2.3) * .17, 10.83 - i * .27, .3 + i * .023, .15, .23, .05); q.rotation.z = (i % 2 ? 1 : -1) * .65; }
  }
  // Top relief emblem is not text and remains readable at small sizes.
  const emblem = r.mesh(new THREE.OctahedronGeometry(.32), gold, staticGroup); emblem.position.set(0, 10.94, .73); emblem.scale.z = .3;
  r.mergeStatic(staticGroup);
  const basinMat = r.mat(0xff732e, { emissive: 0xff531b, emissiveIntensity: .6, metalness: .18, roughness: .4 });
  s.basin = r.box(r.scene, 0, m.layout.basinY + .25, -.09, 5.92, .52, .45, basinMat);
  s.basinTop = r.box(r.scene, 0, m.layout.basinY + .525, .015, 5.93, .045, .66, r.mat(0xffcf70, { emissive: 0xff791e, emissiveIntensity: .7 }));
  s.status = label(r, r.scene, 3.45, .42, '#ffdd93', '#3a3444'); s.status.sprite.position.set(0, m.layout.basinY + 1.06, .46);
  // Pullable pins are polished rods, sockets, collars and large ring handles.
  const rodGeo = new THREE.CylinderGeometry(.1, .1, 1, 14), ringGeo = new THREE.TorusGeometry(.27, .075, 8, 24);
  for (const p of m.pins) {
    const group = r.group(), span = p.x2 - p.x1, mid = (p.x2 + p.x1) / 2;
    const rod = mesh(r, rodGeo, gold, group, mid, p.y, .25, 1, span + .45, 1); rod.rotation.z = Math.PI / 2;
    const handleX = (p.side < 0 ? p.x1 : p.x2) + p.side * .43;
    const handle = mesh(r, ringGeo, gold, group, handleX, p.y, .28);
    const core = mesh(r, new THREE.CircleGeometry(.21, 20), r.mat(p.tint, { emissive: p.tint, emissiveIntensity: .22, side: THREE.DoubleSide }), group, handleX, p.y, .295); core.castShadow = false;
    const number = label(r, group, .35, .27, '#fffcec', '#534723'); number.set(s.pins.length + 1); number.sprite.position.set(handleX, p.y, .4);
    const socket = r.cylinder(r.scene, p.side < 0 ? p.x1 : p.x2, p.y, .23, .16, .16, .26, 0xb2b6a5, 12, { metalness: .5 }); socket.rotation.z = Math.PI / 2;
    const select = mesh(r, new THREE.TorusGeometry(.39, .027, 6, 28), r.mat(0xffffff, { emissive: 0xc9f7ff, emissiveIntensity: 1 }), group, handleX, p.y, .34); select.visible = false;
    s.pins.push({ group, handle, core, number, select });
  }
  const gemGeo = new THREE.OctahedronGeometry(1), dropGeo = new THREE.SphereGeometry(1, 10, 7), lavaGeo = new THREE.IcosahedronGeometry(1, 1);
  s.waterMat = r.mat(0x42cffa, { roughness: .2, metalness: .3, emissive: 0x2ca5db, emissiveIntensity: .25 });
  s.gemMats = [r.mat(0x63f4c4, { metalness: .35, roughness: .15, emissive: 0x2fae96, emissiveIntensity: .2 }), r.mat(0x6ed5ff, { metalness: .4, roughness: .13 }), r.mat(0xd2a0ff, { metalness: .4, roughness: .2 })];
  s.lavaMat = r.mat(0xff833e, { emissive: 0xff471c, emissiveIntensity: .72, roughness: .6 });
  s.stoneMat = r.mat(0x738699, { roughness: .9 });
  m.particles.forEach((p, i) => { const q = mesh(r, p.type === 'gem' ? gemGeo : p.type === 'water' ? dropGeo : lavaGeo, p.type === 'gem' ? s.gemMats[i % 3] : p.type === 'water' ? s.waterMat : s.lavaMat, r.scene, p.x, p.y, 0, p.r, p.r, p.r); s.particles.push(q); });
  // Wide open treasure chest: individual wood boards, gold corner straps, keyhole
  // and an open hinged lid. Its collection mouth matches the model's floor.
  const chest = s.chest = r.group(r.scene, 0, .62, .18);
  r.box(chest, 0, .17, 0, 5.92, .54, .95, 0x563c39);
  for (let i = 0; i < 9; i++) r.box(chest, -2.64 + i * .66, .22, .5, .63, .46, .09, i % 2 ? 0xa96c46 : 0xba8151);
  for (const x of [-2.75, -1.7, 1.7, 2.75]) { r.box(chest, x, .25, .555, .13, .54, .08, gold); r.box(chest, x, .52, .06, .13, .08, 1.03, gold); }
  for (const y of [-.035, .51]) r.box(chest, 0, y, .555, 5.9, .075, .075, gold);
  r.box(chest, 0, .29, .63, .4, .35, .1, gold); r.box(chest, 0, .29, .7, .055, .16, .03, 0x5b3b37);
  const lid = r.group(chest, 0, .5, -.46); lid.rotation.x = -1.05;
  r.box(lid, 0, 0, -.47, 5.92, .15, .94, 0x9a6145);
  for (const x of [-2.74, -1.7, 1.7, 2.74]) r.box(lid, x, .085, -.47, .14, .045, .95, gold);
  r.box(lid, 0, .09, -.92, 5.92, .05, .085, gold);
  s.loot = Array.from({ length: m.totalGems }, (_, i) => { const q = mesh(r, gemGeo, s.gemMats[i % 3], chest, (i % 6 - 2.5) * .68, .46 + Math.floor(i / 6) * .16, (i % 2 ? .16 : -.05), .18, .18, .18); q.visible = false; return q; });
  s.burst = burstPool(r, 32, [0xffd76e, 0x76f4d7, 0xb5e8ff]); s.steam = burstPool(r, 20, [0xcde5e2, 0xe6efe1], true);
  s.caption = label(r, r.scene, 4.7, .43, '#d9ede5', '#21384c'); s.caption.set(m.layout.name); s.caption.sprite.position.set(0, 11.55, .1);
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
  s.basin.material.color.setHex(m.heat > .001 ? 0xf06b30 : 0x627788); s.basin.material.emissive.setHex(m.heat > .001 ? 0xff471b : 0x17293a); s.basin.material.emissiveIntensity = m.heat * .6;
  s.basinTop.material.color.setHex(m.heat > .001 ? 0xffbd66 : 0x96abb3); s.basinTop.material.emissiveIntensity = m.heat * .7;
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
  r.scene.background = new THREE.Color(0x211d3b); r.scene.fog = new THREE.Fog(0x211d3b, 35, 70);
  const navy = r.mat(0x303957, { metalness: .25, roughness: .45 }), trim = r.mat(0x7978c4, { metalness: .5, roughness: .3 });
  const glow = r.mat(0x9f99ff, { emissive: 0x8c72ff, emissiveIntensity: .8, roughness: .25 });
  const staticGroup = r.group();
  r.box(staticGroup, 0, 4.95, -1.04, 7.52, 10.25, 1.24, navy);
  r.box(staticGroup, 0, 4.87, -.35, 6.1, 8.6, .12, 0x172c44, { roughness: .55 });
  for (let i = 0; i < 12; i++) {
    r.box(staticGroup, 0, 1.02 + i * .65, -.275, 5.95, .014, .012, 0x233e55);
    if (i < 9) r.box(staticGroup, -2.7 + i * .67, 4.87, -.26, .014, 8.45, .01, 0x233e55);
  }
  for (const side of [-1, 1]) {
    r.box(staticGroup, side * 3.31, 4.97, .06, .49, 9.14, .95, trim);
    r.box(staticGroup, side * 3.057, 4.9, .12, .065, 8.8, .4, glow);
    r.box(staticGroup, side * 3.43, 4.97, .58, .08, 8.46, .075, glow);
    for (const y of [1.15, 3.6, 6.05, 8.5]) {
      const bolt = r.cylinder(staticGroup, side * 3.35, y, .585, .075, .075, .05, 0xced7ed, 10, { metalness: .8 }); bolt.rotation.x = Math.PI / 2;
    }
    r.box(staticGroup, side * 2.72, -.03, -.13, .93, .4, 1.66, navy);
  }
  r.box(staticGroup, 0, .35, .1, 7.16, .62, 1.36, trim);
  r.box(staticGroup, 0, .667, .06, 6.1, .065, .74, 0xc6c5fc, { metalness: .4 });
  r.box(staticGroup, 0, 9.6, .03, 7.17, .4, 1.13, trim);
  r.box(staticGroup, 0, 9.61, .62, 6.7, .1, .09, glow);
  // Planet insignia and cooling grilles make this a dimensional arcade machine.
  for (let i = 0; i < 13; i++) r.box(staticGroup, -1.44 + i * .24, .3, .802, .12, .17, .028, 0x273653);
  for (const x of [-2.32, 2.32]) { const q = r.mesh(new THREE.TorusGeometry(.19, .04, 7, 20), glow, staticGroup); q.position.set(x, .28, .81); }
  r.mergeStatic(staticGroup);
  // Warning dashes sit at exactly the model's danger height.
  s.danger = r.group(); s.dangerMat = r.mat(0xff7d98, { emissive: 0xff496c, emissiveIntensity: .4, transparent: true, opacity: .65 });
  const dashGeo = new THREE.BoxGeometry(.29, .047, .05);
  for (let i = 0; i < 15; i++) mesh(r, dashGeo, s.dangerMat, s.danger, -2.8 + i * .4, m.bounds.danger, .4);
  s.warning = label(r, r.scene, 1.4, .23, '#ffa1b1', '#532a4f'); s.warning.set('DANGER'); s.warning.sprite.position.set(-2.22, m.bounds.danger + .26, .4);
  s.palette = MERGE_TIERS.map(q => r.mat(q.color, { roughness: .24, metalness: .15, emissive: q.color, emissiveIntensity: .1 }));
  s.sphereGeo = new THREE.SphereGeometry(1, 18, 12);
  s.faceGeo = new THREE.CircleGeometry(.65, 28);
  s.faceMat = r.mat(0xffffff, { transparent: true, opacity: .2, depthWrite: false, roughness: .3 });
  s.ringGeo = new THREE.TorusGeometry(.66, .018, 6, 28);
  s.ringMat = r.mat(0xffffff, { transparent: true, opacity: .45, depthWrite: false });
  function orb(parent) {
    const group = r.group(parent); const body = mesh(r, s.sphereGeo, s.palette[0], group, 0, 0, 0);
    const face = mesh(r, s.faceGeo, s.faceMat, group, 0, 0, .78); face.castShadow = false;
    const ring = mesh(r, s.ringGeo, s.ringMat, group, 0, 0, .79); ring.castShadow = false;
    const text = label(r, group, 1.3, .9, '#ffffff', '#313252'); text.sprite.position.z = 1.025;
    const glint = mesh(r, new THREE.SphereGeometry(.11, 8, 6), r.mat(0xffffff, { roughness: .2, transparent: true, opacity: .48 }), group, -.4, .5, .72, 1, .55, .16); glint.castShadow = false;
    group.visible = false; return { group, body, text, face, ring };
  }
  for (let i = 0; i < m.maxPieces; i++) s.pieces.push(orb(r.scene));
  s.next = orb(r.scene);
  s.launcher = r.group();
  r.box(s.launcher, 0, 0, -.25, 1.22, .32, .8, 0x9390dd, { metalness: .5 });
  for (const side of [-1, 1]) {
    const arm = r.box(s.launcher, side * .47, -.28, .04, .15, .46, .36, 0xd5d9f6, { metalness: .5 }); arm.rotation.z = side * -.19;
    r.box(s.launcher, side * .49, -.46, .21, .2, .09, .17, glow);
  }
  s.guide = r.group();
  const dotGeo = new THREE.SphereGeometry(.029, 7, 5), dotMat = r.mat(0xc0c7ee, { emissive: 0x899acb, emissiveIntensity: .5, transparent: true, opacity: .55 });
  for (let i = 0; i < 22; i++) mesh(r, dotGeo, dotMat, s.guide, 0, .9 + i * .35, .7);
  s.aimRing = mesh(r, new THREE.TorusGeometry(1, .034, 6, 28), glow, r.scene, 0, .78, .1); s.aimRing.rotation.x = Math.PI / 2;
  s.target = label(r, r.scene, 4, .6, '#f2eaff', '#34335d'); s.target.set(`MAKE ${MERGE_TIERS[m.targetTier - 1].value}`); s.target.sprite.position.set(0, 10.31, .1);
  s.tip = label(r, r.scene, 4.1, .38, '#b8c9ef', '#273653'); s.tip.set('AIM · DROP · MERGE'); s.tip.sprite.position.set(0, 10.89, .1);
  s.burst = burstPool(r, 42, MERGE_TIERS.map(q => q.color));
  camera(r, 'merge'); updateMerge(r, m);
}
function setOrb(view, piece, s, time, lowMotion) {
  view.group.visible = !!piece; if (!piece) return;
  const radius = piece.r || MERGE_TIERS[piece.tier - 1].radius;
  const age = Math.max(0, time - (piece.born ?? -100)), squash = lowMotion || age >= .22 ? 0 : Math.sin(age / .22 * Math.PI) * .1;
  view.group.position.set(piece.x, piece.y, .2); view.group.scale.set(radius * (1 + squash), radius * (1 - squash), radius);
  view.body.material = s.palette[piece.tier - 1]; view.body.rotation.z = piece.rotation || 0;
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
