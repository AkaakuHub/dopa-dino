import * as THREE from './vendor/three.module.min.js';

// Original, deterministic material library. No downloads, canvas dependency,
// photogrammetry assets, post-processing, or additional render passes.
const TAU = Math.PI * 2;
const SIZE = 128;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const fract = n => n - Math.floor(n);
const hash = (x, y, seed = 1) => fract(Math.sin(x * 127.1 + y * 311.7 + seed * 19.19) * 43758.5453);
const smooth = n => n * n * (3 - 2 * n);
function noise(x, y, seed = 1) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(fract(x)), fy = smooth(fract(y));
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export const ART_DIRECTIONS = Object.freeze({
  snow: { name: 'Frostfire / blue-hour timber settlement', background: 0x97b1c6, sky: 0xc5e6fa, ground: 0x445a79, key: 0xffdfaf, fill: 0x83b5ed, keyPower: 3.1, ambient: 1.05, exposure: 1.03, environment: .54 },
  hole: { name: 'City Hole / sun-warmed coastal town', background: 0xcad5d6, sky: 0xe8f3f5, ground: 0x9a796b, key: 0xffe7bb, fill: 0xa4c8e5, keyPower: 3, ambient: 1.05, exposure: 1.06, environment: .42 },
  helix: { name: 'Helix / porcelain and brass observatory', background: 0x273a48, sky: 0xa5c8d1, ground: 0x16242e, key: 0xffe6ba, fill: 0x6e9fbb, keyPower: 3.5, ambient: .85, exposure: 1.12, environment: .7 },
  gates: { name: 'Crowd Gates / tropical expedition causeway', background: 0xb7ded8, sky: 0xe8f5e1, ground: 0x5a918c, key: 0xffedc1, fill: 0xa3d6e4, keyPower: 2.8, ambient: 1.05, exposure: 1.05, environment: .44 },
  stack: { name: 'Stack / mineral tower above a sunrise city', background: 0xe8cec1, sky: 0xffe9d7, ground: 0x8a9298, key: 0xffead0, fill: 0x9aaec9, keyPower: 2.5, ambient: 1.15, exposure: 1.02, environment: .72 },
  golf: { name: 'Golf / botanical garden miniature', background: 0xc3d4c3, sky: 0xf0f5d8, ground: 0x566f51, key: 0xffeec5, fill: 0xaccbb7, keyPower: 2.8, ambient: 1.0, exposure: 1.05, environment: .44 },
  breaker: { name: 'Breaker / brass and enamel arcade instrument', background: 0x222d3d, sky: 0xafc0c6, ground: 0x1d252e, key: 0xffd49a, fill: 0x6a9cb5, keyPower: 3.0, ambient: .7, exposure: 1.08, environment: .8 },
  range: { name: 'Range / weathered orbital training hangar', background: 0x0b1724, sky: 0xb1c7d2, ground: 0x1a2936, key: 0xd7eafa, fill: 0xf5bc7d, keyPower: 2.7, ambient: .72, exposure: 1.05, environment: .64 },
  pins: { name: 'Pins / sandstone water temple', background: 0x343d3d, sky: 0xe3dcc6, ground: 0x3f493f, key: 0xffe1ad, fill: 0x88b6ac, keyPower: 3, ambient: .86, exposure: 1.05, environment: .5 },
  merge: { name: 'Merge / porcelain patisserie cabinet', background: 0xd5c9bd, sky: 0xfff3e1, ground: 0x877b79, key: 0xffe6cb, fill: 0xbac8bf, keyPower: 2.5, ambient: 1.1, exposure: 1.04, environment: .8 },
  kitchen: { name: 'North Camp Kitchen / lantern-lit service cabin', background: 0x23384b, sky: 0xbfd5e1, ground: 0x536678, key: 0xffe2b0, fill: 0x83b8d0, keyPower: 3, ambient: 1.05, exposure: 1.04, environment: .56 }
});
const profiles = {
  snow: [.95, 0, .038], wood: [.85, 0, .06], stone: [.92, 0, .075], asphalt: [.95, 0, .05],
  turf: [1, 0, .043], sand: [.99, 0, .036], metal: [.47, .76, .012], ceramic: [.27, .05, .012],
  marble: [.34, 0, .018], obsidian: [.32, .25, .06], fabric: [.96, 0, .035], circuit: [.53, .48, .017],
  water: [.18, .08, .022], lava: [.71, .08, .11]
};
function art(r) { return r.art ||= { textures: new Map(), materials: new Map(), time: { value: 0 }, extras: [], environment: null }; }
function relief(name, u, v) {
  const n = noise(u * 13, v * 13, 3), fine = hash(Math.floor(u * SIZE), Math.floor(v * SIZE), 8);
  const wave = Math.sin((u * 3 + Math.sin(v * TAU) * .22) * TAU);
  switch (name) {
    case 'wood': { const grain = .5 + .5 * Math.sin(u * TAU * 28 + Math.sin(v * TAU * 2) * 2 + n * 3); return .5 + grain * .26 + n * .12 - (fract(v * 4) < .022 ? .25 : 0); }
    case 'stone': { const row = Math.floor(v * 4), seam = fract(v * 4) < .034 || fract(u * 4 + row % 2 * .5) < .028; return seam ? .27 : .7 + n * .17 + fine * .065; }
    case 'asphalt': return .68 + fine * .2 + n * .045 - (fine < .08 ? .17 : 0);
    case 'snow': return .85 + n * .075 + fine * .06 + Math.sin((u + v) * TAU * 7) * .014;
    case 'turf': return .64 + fine * .18 + n * .09 + (Math.floor(u * 8) % 2 ? .065 : 0);
    case 'sand': return .76 + fine * .12 + Math.sin(v * TAU * 10 + Math.sin(u * TAU * 3)) * .045;
    case 'metal': return .77 + hash(0, Math.floor(v * SIZE), 6) * .15 + fine * .035 - (fine < .007 ? .2 : 0);
    case 'ceramic': return .92 + n * .04 + fine * .025;
    case 'marble': { const vein = Math.pow(.5 + .5 * Math.sin((u * 3 + v * 2) * TAU + n * 8), 14); return .91 + n * .07 - vein * .23; }
    case 'obsidian': return .5 + n * .22 + Math.pow(fine, 4) * .14;
    case 'fabric': return .75 + (Math.floor(u * 64) % 2 === Math.floor(v * 64) % 2 ? .15 : 0) + fine * .045;
    case 'circuit': { const line = fract(u * 8) < .034 || fract(v * 8) < .028; return line ? .55 : .81 + n * .08; }
    case 'water': return .75 + wave * .085 + Math.sin(v * TAU * 4 + u * 6) * .085;
    case 'lava': return .42 + Math.pow(.5 + .5 * Math.sin((u + v) * TAU * 3 + n * 7), 4) * .52;
    default: return .8 + n * .12;
  }
}
function materialMaps(r, name, repeat) {
  const state = art(r), key = `${name}:${repeat.join(',')}`;
  if (state.textures.has(key)) return state.textures.get(key);
  const albedo = new Uint8Array(SIZE * SIZE * 4), detail = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const q = (y * SIZE + x) * 4, h = clamp(relief(name, x / SIZE, y / SIZE), 0, 1);
    const rgb = Math.round((.76 + h * .24) * 255), rough = Math.round(clamp(.7 + h * .3, 0, 1) * 255);
    albedo[q] = albedo[q + 1] = albedo[q + 2] = rgb; albedo[q + 3] = 255;
    detail[q] = detail[q + 2] = Math.round(h * 255); detail[q + 1] = rough; detail[q + 3] = 255;
  }
  const make = (data, colorSpace) => {
    const t = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
    t.name = `authored-${name}`; t.colorSpace = colorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = Math.min(4, r.renderer?.capabilities?.getMaxAnisotropy?.() || 1); t.needsUpdate = true; return t;
  };
  const maps = { map: make(albedo, THREE.SRGBColorSpace), detail: make(detail, THREE.NoColorSpace) };
  state.textures.set(key, maps); return maps;
}
export function surface(r, name, color, options = {}) {
  const state = art(r), { repeat = [2, 2], ...parameters } = options;
  const colorHex = new THREE.Color(color).getHex(), key = `${name}:${colorHex}:${JSON.stringify(options)}`;
  if (state.materials.has(key)) return state.materials.get(key);
  const [roughness, metalness, bumpScale] = profiles[name] || profiles.stone, maps = materialMaps(r, name, repeat);
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, bumpScale, map: maps.map, roughnessMap: maps.detail, bumpMap: maps.detail, ...parameters });
  m.name = `crafted-${name}`; m.userData.artSurface = name;
  if (name === 'water' || name === 'lava') {
    m.onBeforeCompile = shader => {
      shader.uniforms.artTime = state.time;
      shader.vertexShader = 'varying vec3 vArtPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvArtPosition = position;');
      shader.fragmentShader = 'varying vec3 vArtPosition;\nuniform float artTime;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\nfloat artWave = sin(vArtPosition.x * 5.0 + vArtPosition.z * 3.0 + vArtPosition.y * 4.0 + artTime * ${name === 'lava' ? '.48' : '.8'}) * sin(vArtPosition.z * 7.0 - vArtPosition.x * 2.0 + vArtPosition.y * 6.0 - artTime * .6);\ndiffuseColor.rgb *= .91 + .09 * artWave;`);
    };
    m.customProgramCacheKey = () => `crafted-${name}-v1`;
  }
  state.materials.set(key, m); r.cache?.set('surface:'+key,m); return m;
}

// Rounded cuboids retain exact outside dimensions; collisions remain model-owned.
export function roundedBox(w, h, d, radius = .08, segments = 2) {
  const r = Math.min(radius, w * .22, h * .22, d * .22), n = Math.max(1, Math.min(2, segments)) * 2 + 1;
  const geo = new THREE.BoxGeometry(1, 1, 1, n, n, n), p = geo.attributes.position, normals = geo.attributes.normal;
  const sizes = [w, h, d], point = new THREE.Vector3(), inner = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    point.set(p.getX(i) * w, p.getY(i) * h, p.getZ(i) * d);
    inner.set(...sizes.map((s, j) => clamp(point.getComponent(j), -s / 2 + r, s / 2 - r)));
    normal.copy(point).sub(inner).normalize(); point.copy(inner).addScaledVector(normal, r);
    p.setXYZ(i, point.x, point.y, point.z); normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  geo.name = 'crafted-rounded-cuboid'; geo.computeBoundingBox(); geo.computeBoundingSphere(); return geo;
}
function environmentTexture(direction) {
  // Small original equirectangular studio sky supplies coherent reflections.
  const w = 128, h = 64, bytes = new Uint8Array(w * h * 4), sky = new THREE.Color(direction.sky), ground = new THREE.Color(direction.ground), key = new THREE.Color(direction.key), c = new THREE.Color();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = y / (h - 1), u = x / w, horizon = smooth(clamp((v - .28) / .45, 0, 1));
    c.copy(sky).lerp(ground, horizon); const softbox = Math.exp(-((u - .23) ** 2 / .008 + (v - .25) ** 2 / .018));
    c.lerp(key, softbox * .7); const q = (y * w + x) * 4;
    bytes[q] = Math.round(clamp(c.r, 0, 1) * 255); bytes[q + 1] = Math.round(clamp(c.g, 0, 1) * 255); bytes[q + 2] = Math.round(clamp(c.b, 0, 1) * 255); bytes[q + 3] = 255;
  }
  const t = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.LinearSRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; t.name = 'authored-reflection-sky'; return t;
}
export function applyArtDirection(r, kind) { art(r).direction = ART_DIRECTIONS[kind]; }
export function finishArtDirection(r, kind) {
  const state = art(r), direction = ART_DIRECTIONS[kind];
  r.scene.background = new THREE.Color(direction.background);
  if (r.scene.fog) r.scene.fog.color.copy(r.scene.background);
  r.scene.environment = state.environment = environmentTexture(direction); r.scene.environmentIntensity = direction.environment;
  if (r.renderer) r.renderer.toneMappingExposure = direction.exposure;
  let directional = 0;
  r.scene.traverse(o => {
    if (o.isHemisphereLight) { o.color.setHex(direction.sky); o.groundColor.setHex(direction.ground); o.intensity = direction.ambient; }
    if (o.isDirectionalLight) { o.color.setHex(directional++ === 0 ? direction.key : direction.fill); o.intensity = o === r.sun ? direction.keyPower : .6; }
  });
  r.scene.userData.artDirection = direction.name;
  if (kind === 'helix') addObservatory(r);
  if (kind === 'snow') addSnowDetails(r);
}
function addSnowDetails(r) {
  const g = r.group(), ice = surface(r, 'marble', 0x89bacb, { roughness: .2, metalness: .06, repeat: [3, 3] });
  // Low snow banks have an organic, wind-carved silhouette; unobstructed paths.
  for (let i = 0; i < 18; i++) {
    const a = i * 2.399, radius = 6.8 + i % 4 * 1.3;
    const drift = r.mesh(new THREE.SphereGeometry(1, 12, 8), surface(r, 'snow', 0xf2f7f7), g);
    drift.position.set(Math.cos(a) * radius, -.12, Math.sin(a) * radius); drift.scale.set(1.5 + i % 3 * .3, .3, .7 + i % 4 * .15); drift.rotation.y = a;
  }
  const frozen = r.mesh(new THREE.CircleGeometry(1, 48), ice, g); frozen.rotation.x = -Math.PI / 2; frozen.position.set(5.5, .016, 3.4); frozen.scale.set(1.4, .8, 1);
  for (let i = 0; i < 7; i++) { const a = i * TAU / 7; const shard = r.mesh(new THREE.ConeGeometry(.09, .45 + i % 3 * .1, 5), ice, g); shard.position.set(5.5 + Math.cos(a) * 1.32, .18, 3.4 + Math.sin(a) * .75); shard.rotation.z = Math.cos(a) * .23; }
  // A wagon, axe block and lanterns are functional settlement storytelling.
  const wood = surface(r, 'wood', 0x77503a), iron = surface(r, 'metal', 0x516371);
  r.box(g, -2.1, .35, 2.1, 1.15, .12, .68, wood);
  for (const x of [-2.59, -1.61]) for (const z of [1.85, 2.35]) { const wheel = r.ring(g, x, .28, z, .24, .045, iron); wheel.rotation.set(0, Math.PI / 2, 0); }
  for (let i = 0; i < 5; i++) r.log(g, -2.1, .48 + (i % 2) * .16, 1.87 + i * .1, .9);
  r.cylinder(g, 1.7, .24, 2.0, .3, .38, .47, wood, 12); const axe = r.box(g, 1.72, .68, 2.0, .045, .65, .05, wood); axe.rotation.z = -.35;
  r.box(g, 1.6, .97, 2.0, .25, .17, .06, iron);
  r.mergeStatic(g);
}
function addObservatory(r) {
  const g = r.group(), brass = surface(r, 'metal', 0xb59a64, { metalness: .78, roughness: .39 }), stone = surface(r, 'stone', 0x41545e);
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10, x = Math.cos(a) * 7.4, z = Math.sin(a) * 7.4 - 2.5;
    r.cylinder(g, x, -12, z, .42, .56, 46, stone, 12);
    for (const y of [-24, -16, -8, 0, 8]) r.cylinder(g, x, y, z, .62, .62, .22, brass, 12);
  }
  for (const y of [-22, -10, 2, 10]) r.ring(g, 0, y, -2.5, 7.4, .14, brass);
  r.mergeStatic(g); art(r).observatory = g;
  const orbit = r.ring(r.scene, 0, -3, 0, 4.1, .023, brass); orbit.rotation.z = .36; art(r).orbit = orbit;
}
export function updateArtDirection(r, m) {
  if (!r.art) return; r.art.time.value = r.lowMotion ? 0 : m.time || 0;
  if (r.art.observatory) { r.art.observatory.position.y = r.followY; r.art.orbit.position.y = r.followY - 3; r.art.orbit.rotation.y = r.lowMotion ? 0 : (m.time || 0) * .04; }
}
export function disposeArtDirection(r) {
  if (!r.art) return;
  // Materials may be allocated for a pool but currently absent from its meshes.
  // Central disposal gathers these with scene resources to dispose each once.
  r.art = null;
}
