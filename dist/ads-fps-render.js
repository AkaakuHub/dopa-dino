import * as THREE from './vendor/three.module.min.js';
import { surface, roundedBox } from './ads-visuals.js';
import { RANGE_RULES } from './ads-fps.js';

const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const scratch = new THREE.Object3D();
const cyan = 0x67f5df, amber = 0xffb956;

function unit(r, s, parent, x, y, z, w, h, d, color) {
  const mesh = r.mesh(s.box, color, parent);
  mesh.position.set(x, y, z); mesh.scale.set(w, h, d); return mesh;
}
function glow(color, opacity = 1) { return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false, depthWrite: opacity === 1 }); }
function label(parent, width, height) {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let ctx, texture;
  if (canvas) {
    canvas.width = 768; canvas.height = 128; ctx = canvas.getContext?.('2d');
    if (ctx) { texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; }
  }
  const material = new THREE.SpriteMaterial({ map: texture || null, color: texture ? 0xffffff : cyan, transparent: true, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(material); sprite.scale.set(width, height, 1); parent.add(sprite);
  const item = { sprite, text: '', set(text) {
    if (item.text === String(text)) return; item.text = String(text); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 74px ui-rounded, Arial, sans-serif'; ctx.fillStyle = '#8effeb';
    ctx.shadowColor = '#052c35'; ctx.shadowBlur = 9; ctx.fillText(item.text, 384, 65, 748); texture.needsUpdate = true;
  } }; return item;
}
function overlay(object) {
  object.traverse(o => {
    if (o.isMesh || o.isSprite || o.isLine) {
      o.castShadow = o.receiveShadow = false; o.renderOrder = 20;
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) { material.depthTest = false; material.depthWrite = false; }
    }
  });
}
function makeDrone(r, s, slot) {
  const group = r.group();
  const shell = surface(r,'metal',[0x8d9ea8,0xad9d83,0x87a59b][slot],{metalness:.67,roughness:.37,repeat:[3,2]});
  const dark = r.mat(0x162739, { metalness: .45, roughness: .38 });
  const face = r.mat(0x061b27, { metalness: .6, roughness: .18 });
  const body = r.mesh(s.sphere, shell, group); body.scale.set(.68, .58, .43);
  const faceplate = r.mesh(s.sphere, face, group); faceplate.position.z = .33; faceplate.scale.set(.49, .36, .13);
  const lamp = glow(cyan); const eye = r.mesh(s.sphere, lamp, group); eye.position.set(0, .015, .46); eye.scale.set(.23, .1, .035);
  const hoopMaterial = glow(cyan); const hoop = r.mesh(s.hoop, hoopMaterial, group); hoop.position.z = .1;
  for (const side of [-1, 1]) {
    unit(r, s, group, side * .79, 0, -.07, .5, .13, .34, dark);
    const wing = unit(r, s, group, side * .96, .04, -.09, .18, .51, .48, shell); wing.rotation.z = side * -.22;
    unit(r, s, group, side * .966, .04, .16, .075, .36, .025, lamp);
    const rotor = r.mesh(s.rotor, dark, group); rotor.position.set(side * .82, .26, -.09); rotor.rotation.x = Math.PI / 2;
  }
  unit(r, s, group, 0, .66, -.04, .04, .23, .04, shell);
  const aerial = r.mesh(s.sphere, lamp, group); aerial.position.y = .79; aerial.scale.setScalar(.075);
  const threat = r.mesh(s.hoop, glow(amber, .8), group); threat.scale.setScalar(1.28); threat.position.z = .1; threat.visible = false;
  const shadow = r.mesh(s.shadow, new THREE.MeshBasicMaterial({ color: 0x01091c, transparent: true, opacity: .36, depthWrite: false }), r.scene);
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.2, .85, 1); shadow.castShadow = false;
  return { group, hoop, hoopMaterial, lamp, threat, shadow };
}

function buildRange(r, m) {
  r.scene.background = new THREE.Color(0x071223); r.scene.fog = new THREE.Fog(0x071223, 24, 55);
  r.camera = new THREE.PerspectiveCamera(57, 1, .06, 85);
  r.scene.add(r.camera); r.camera.position.set(m.eyeX, m.eyeY, 5);
  const s = r.range = {
    box: roundedBox(1,1,1,.07,1), sphere: new THREE.SphereGeometry(1, 16, 12),
    hoop: new THREE.TorusGeometry(.76, .028, 6, 36), rotor: new THREE.TorusGeometry(.22, .035, 6, 20),
    shadow: new THREE.CircleGeometry(1, 24), lastEvent: 0, effects: [], effectCursor: 0,
    amber: glow(amber)
  };
  const architecture = r.group();
  r.box(architecture, 0, -.22, -10, 17,.42,39,surface(r,'stone',0x465058,{repeat:[9,24],roughness:.83,bumpScale:.06}));
  r.box(architecture, 0, .025, -8, 8.1,.035,27,surface(r,'circuit',0x354b58,{repeat:[4,16],roughness:.56,metalness:.4}));
  for (const side of [-1, 1]) {
    r.box(architecture, side * 7.1, 3.5, -10, .55,7.2,34,surface(r,'metal',0x304452,{repeat:[4,18],roughness:.64,metalness:.46}));
    r.box(architecture, side * 4.15, .12, -9, .075, .055, 30, cyan, { emissive: cyan, emissiveIntensity: 1 });
    for (let i = 0; i < 7; i++) {
      const z = 3 - i * 4.6;
      r.box(architecture, side * 6.8, 3.1, z, .48, 6.3, .42, 0x263d56, { metalness: .4 });
      r.box(architecture, side * 6.52, 3.8, z, .055, 2.9, .12, cyan, { emissive: cyan, emissiveIntensity: 1.2 });
      r.box(architecture, side * 5.7, .64, z - 1.3, 1.25, 1.28, 1.85, 0x22394e);
      r.box(architecture, side * 5.7, 1.31, z - 1.3, 1.32, .1, 1.91, 0x486078);
      r.box(architecture, side * 5.7, .69, z - .35, .55, .18, .025, amber, { emissive: amber, emissiveIntensity: .6 });
    }
  }
  for (let i = 0; i < 12; i++) {
    const z = 4 - i * 2.5;
    r.box(architecture, 0, .05, z, 8, .018, .025, 0x2d5069);
    for (const x of [-2.65, 0, 2.65]) r.box(architecture, x, .045, z, .025, .018, 2.45, 0x31566e);
  }
  for (let i = 0; i < 6; i++) {
    const z = 1 - i * 5;
    r.box(architecture, 0, 6.65, z, 14, .25, .35, 0x293c53);
    r.box(architecture, 0, 6.48, z, 7, .055, .12, 0x97e7fb, { emissive: 0x65c9ea, emissiveIntensity: 1.7 });
  }
  r.box(architecture, 0, 3.2, -25, 14, 6.5, .5, 0x1b2d46);
  r.box(architecture, 0, 3.25, -24.72, 8.7, 2.4, .14, 0x091426);
  for (const x of [-4.6, 4.6]) r.box(architecture, x, 3.25, -24.57, .09, 2.8, .08, cyan, { emissive: cyan, emissiveIntensity: 1.2 });
  // Solid cover lip establishes the eye-level perspective without hiding targets.
  r.box(architecture, 0, .58, 3.25, 7.7, 1.15, .62, 0x253b4d, { metalness: .5 });
  r.box(architecture, 0, 1.17, 3.25, 7.9, .11, .69, 0x526878);
  r.box(architecture, 0, 1.24, 3.4, 7.4, .025, .045, cyan, { emissive: cyan, emissiveIntensity: 1 });
  const dullSteel=surface(r,'metal',0x6a7980,{roughness:.6,metalness:.6}),safety=surface(r,'ceramic',0xb99b5c,{roughness:.7}),dark=surface(r,'metal',0x273a45,{roughness:.67});
  for(const side of [-1,1]){
    const duct=r.cylinder(architecture,side*5.4,5.72,-9,.46,.46,32,dullSteel,12);duct.rotation.x=Math.PI/2;
    for(let i=0;i<6;i++){
      const z=1-i*5;
      const collar=r.cylinder(architecture,side*5.4,5.72,z,.53,.53,.18,dark,12);collar.rotation.x=Math.PI/2;
      // Exposed triangular steel trusses and cylinder tanks break the box silhouette.
      r.tube(architecture,[[side*6.85,4.4,z],[side*5.55,6.54,z],[side*3.95,6.65,z]],.11,dullSteel);
      if(i%2===0){r.cylinder(architecture,side*5.8,1.66,z-1,.48,.48,1.34,dullSteel,16);r.sphere(architecture,side*5.8,2.33,z-1,.48,dullSteel).scale.y=.25;r.ring(architecture,side*5.8,1.35,z-1,.49,.025,safety);}
      for(let j=0;j<5;j++){const fin=r.box(architecture,side*6.76,2.9+j*.13,z-.7,.1,.048,1.24,dark);fin.rotation.z=side*.12;}
      for(let j=0;j<5;j++){const stripe=r.box(architecture,side*4.6,.053,z-1+j*.23,.42,.015,.08,safety);stripe.rotation.y=side*.42;}
    }
  }
  const portal=r.mesh(new THREE.TorusGeometry(2.85,.24,6,8),dullSteel,architecture);portal.position.set(0,3.45,-24.56);portal.rotation.z=Math.PI/8;
  const portalInner=r.mesh(new THREE.TorusGeometry(2.54,.06,6,8),safety,architecture);portalInner.position.copy(portal.position);portalInner.position.z+=.08;portalInner.rotation.z=Math.PI/8;
  for(const x of [-6.4,6.4]){const reel=r.mesh(new THREE.TorusGeometry(.5,.15,8,20),dark,architecture);reel.position.set(x,1.6,-4);r.cylinder(architecture,x,.66,-4,.26,.33,1.25,dullSteel,12);}
  r.mergeStatic(architecture);
  s.title = label(r.scene, 7.3, 1.2); s.title.sprite.position.set(0, 3.3, -24.48); s.title.set('NEON RANGE');
  s.board = label(r.scene, 5.2, .75); s.board.sprite.position.set(0, 4.5, -9); s.board.set('12 TARGETS');
  s.drones = Array.from({ length: RANGE_RULES.targets }, (_, i) => makeDrone(r, s, i));
  s.traces = Array.from({ length: RANGE_RULES.traces }, () => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({ color: cyan, transparent: true, opacity: .85, depthWrite: false, toneMapped: false });
    const line = new THREE.Line(geometry, material); line.frustumCulled = false; line.visible = false; r.scene.add(line); return line;
  });
  s.pulses = Array.from({ length: RANGE_RULES.pulses }, () => {
    const group = r.group(); const core = r.mesh(s.sphere, s.amber, group); core.scale.set(.105, .105, .24);
    const halo = r.mesh(s.sphere, glow(amber, .23), group); halo.scale.set(.22, .22, .4);
    group.visible = false; return group;
  });
  const shard = new THREE.OctahedronGeometry(.085, 0);
  for (let i = 0; i < 8; i++) {
    const material = glow(i % 2 ? cyan : 0xffdf8e, .9);
    const mesh = new THREE.InstancedMesh(shard, material, 12); mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.visible = false; r.scene.add(mesh);
    s.effects.push({ mesh, born: -2, x: 0, y: 0, z: 0 });
  }
  // First-person pulse tool and reticle belong to the perspective camera itself.
  s.weapon = r.group(r.camera);
  const gunMetal=surface(r,'metal',0x87949c,{metalness:.76,roughness:.34,repeat:[3,3]}),gunDark=surface(r,'fabric',0x243845,{roughness:.87,repeat:[3,4]});
  unit(r, s, s.weapon, 0, 0, 0, .16, .16, .47, gunMetal);
  unit(r, s, s.weapon, 0, -.085, .11, .115, .21, .14, gunDark).rotation.x = -.2;
  unit(r, s, s.weapon, 0, .102, -.055, .085, .035, .28, gunDark);
  unit(r, s, s.weapon, 0, .12, -.17, .035, .035, .045, glow(cyan));
  unit(r, s, s.weapon, 0, .055, .16, .19, .12, .08, gunDark);
  const barrel = r.mesh(new THREE.CylinderGeometry(.05, .065, .23, 14), gunDark, s.weapon); barrel.rotation.x = Math.PI / 2; barrel.position.z = -.29;
  const muzzle = r.mesh(new THREE.TorusGeometry(.049, .012, 6, 20), glow(cyan), s.weapon); muzzle.position.z = -.414;
  s.muzzle = r.mesh(new THREE.ConeGeometry(.047, .19, 7), glow(0xd9fff2, .85), s.weapon); s.muzzle.rotation.x = -Math.PI / 2; s.muzzle.position.z = -.49;
  s.cells = [];
  for (let i = 0; i < 6; i++) s.cells.push(unit(r, s, s.weapon, -.087, .02, .13 - i * .038, .016, .028, .025, glow(cyan)));
  for(let i=0;i<4;i++){unit(r,s,s.weapon,.085,.025,-.16+i*.058,.012,.055,.026,gunDark);unit(r,s,s.weapon,-.085,.025,-.16+i*.058,.012,.055,.026,gunDark);}
  const chamber=r.mesh(new THREE.CylinderGeometry(.046,.046,.15,12),surface(r,'metal',0xc6a772,{metalness:.72,roughness:.35}),s.weapon);chamber.rotation.x=Math.PI/2;chamber.position.set(0,.024,-.19);
  overlay(s.weapon);
  s.reticle = r.group(r.camera); s.reticle.position.z = -1;
  s.reticleMaterial = glow(0xecfff9);
  for (const [x, y, w, h] of [[-.024, 0, .018, .003], [.024, 0, .018, .003], [0, -.024, .003, .018], [0, .024, .003, .018]]) unit(r, s, s.reticle, x, y, 0, w, h, .001, s.reticleMaterial);
  const dot = r.mesh(new THREE.CircleGeometry(.0028, 8), s.reticleMaterial, s.reticle); dot.position.z = .001;
  overlay(s.reticle);
  s.coverFrame = r.group(r.camera);
  s.coverMaterial = glow(cyan, .22);
  for (const side of [-1, 1]) unit(r, s, s.coverFrame, side * .4, -.28, -.75, .024, .42, .001, s.coverMaterial);
  unit(r, s, s.coverFrame, 0, -.48, -.75, .82, .024, .001, s.coverMaterial);
  overlay(s.coverFrame);
  if (r.sun) { r.sun.position.set(-3, 8, 2); r.sun.target.position.set(0, 1, -8); r.sun.intensity = 2; }
  resizeRange(r, m); updateRange(r, m);
}

function resizeRange(r, m) {
  const aspect = clamp((r.w || 1) / (r.h || 1), .25, 5);
  m?.setViewport(r.w || 1, r.h || 1);
  const tan = Math.max(Math.tan(57 * Math.PI / 360), Math.tan(52 * Math.PI / 360) / aspect);
  r.camera.aspect = aspect; r.camera.fov = Math.atan(tan) * 360 / Math.PI; r.camera.updateProjectionMatrix();
}
function updateRange(r, m) {
  const s = r.range; resizeRange(r, m); m.setReducedMotion(r.lowMotion);
  r.camera.position.set(m.eyeX, m.eyeY, 5); r.camera.rotation.set(0, 0, 0); r.camera.updateMatrixWorld(true);
  const time = r.lowMotion ? 0 : m.time;
  s.drones.forEach((view, i) => {
    const target = m.targets[i]; view.group.visible = target.active; view.group.position.set(target.x, target.y, target.z);
    view.group.rotation.set(0, 0, r.lowMotion ? 0 : Math.sin(time * 1.5 + i) * .08);
    view.hoop.rotation.z = time * .6 * (i % 2 ? -1 : 1);
    const warning = target.charge > 0;
    view.hoopMaterial.color.setHex(warning ? amber : cyan); view.lamp.color.setHex(warning ? amber : cyan);
    view.threat.visible = warning; view.threat.scale.setScalar(1.3 - target.charge * .2); view.threat.material.opacity = .3 + target.charge * .6;
    view.shadow.visible = target.active; view.shadow.position.set(target.x, .069, target.z); view.shadow.scale.set(1.05, .65, 1);
  });
  s.traces.forEach((line, i) => {
    const trace = m.traces[i]; line.visible = !!trace && !r.lowMotion;
    if (!trace) return;
    const a = line.geometry.attributes.position;
    a.setXYZ(0, trace.fromX + .2, trace.fromY - .18, 4.45); a.setXYZ(1, trace.x, trace.y, trace.z); a.needsUpdate = true;
    line.material.opacity = Math.max(0, 1 - trace.age / .16) * .8;
  });
  s.pulses.forEach((view, i) => {
    const pulse = m.pulses[i]; view.visible = !!pulse;
    if (pulse) {
      const t = clamp(pulse.age / pulse.duration, 0, 1);
      view.position.set(pulse.x + (pulse.toX - pulse.x) * t, pulse.y + (pulse.toY - pulse.y) * t, pulse.z + (4.6 - pulse.z) * t);
      view.lookAt(pulse.toX, pulse.toY, 5);
    }
  });
  for (const event of m.events) {
    if (event.id <= s.lastEvent) continue; s.lastEvent = event.id;
    if (event.type === 'hit') Object.assign(s.effects[s.effectCursor++ % s.effects.length], { born: event.time, x: event.x, y: event.y, z: event.z });
  }
  for (const effect of s.effects) {
    const age = m.time - effect.born; effect.mesh.visible = !r.lowMotion && age >= 0 && age < .7;
    if (!effect.mesh.visible) continue;
    for (let i = 0; i < 12; i++) {
      const a = i * 2.399, spread = .4 + age * 2;
      scratch.position.set(effect.x + Math.cos(a) * spread, effect.y + Math.sin(a) * spread - age * age, effect.z + Math.sin(i * 4.2) * age);
      scratch.rotation.set(age * 4 + i, age * 2 + i, a); scratch.scale.setScalar(Math.max(.02, 1 - age / .7)); scratch.updateMatrix(); effect.mesh.setMatrixAt(i, scratch.matrix);
    }
    effect.mesh.instanceMatrix.needsUpdate = true; effect.mesh.material.opacity = 1 - age / .7;
  }
  // Size weapon and reticle in screen space, preserving framing at both orientations.
  const tan = Math.tan(r.camera.fov * Math.PI / 360), aspect = r.camera.aspect;
  const recoil = r.lowMotion ? 0 : m.recoil;
  s.weapon.position.set(tan * aspect * .42, -tan * .40 - m.coverBlend * .09, -.65 + recoil * .03);
  s.weapon.rotation.set(m.reload ? -.48 : recoil * .07 - m.aim.y * .12, -.1 - m.aim.x * .2, m.reload ? -.22 : -.06);
  s.weapon.scale.setScalar(Math.min(1.6, Math.max(.85, tan * 1.45)));
  s.muzzle.visible = !r.lowMotion && m.recoil > .38 && !m.reload && !m.outcome;
  s.cells.forEach((cell, i) => { cell.material.color.setHex(i < m.ammo ? cyan : 0x21384c); });
  s.reticle.position.set(m.aim.x * tan * aspect, -m.aim.y * tan, -1);
  s.reticle.scale.setScalar(tan * .8); s.reticleMaterial.color.setHex(m.pop > .15 ? amber : m.covered ? 0x7ea6b3 : 0xecfff9);
  s.coverFrame.visible = m.covered && !m.outcome; s.coverFrame.scale.set(tan * aspect * 1.75, tan * 1.4, 1);
  s.coverMaterial.opacity = m.reload ? .42 : .24;
  s.board.set(m.outcome ? (m.outcome === 'success' ? 'RANGE CLEAR' : m.failureReason) : `${m.hits} / ${RANGE_RULES.goal} TARGETS`);
}

// resize is called by the shared renderer; update also synchronizes viewport for older hosts.
export const GAME_RENDERERS = { range: { build: buildRange, update: updateRange, resize: resizeRange } };
