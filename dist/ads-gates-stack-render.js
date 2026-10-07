import * as THREE from './vendor/three.module.min.js';
import { surface, roundedBox } from './ads-visuals.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dummy = new THREE.Object3D();
const color = new THREE.Color();

// Every text canvas and geometry is created once. Labels repaint in place.
function label(r, parent, width = 2, height = .9, fill = '#ffffff', stroke = '#123c60') {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let texture, ctx;
  if (canvas) {
    canvas.width = 512; canvas.height = 192;
    ctx = canvas.getContext?.('2d');
    if (ctx) { texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; }
  }
  const material = new THREE.SpriteMaterial({ map: texture || null, color: texture ? 0xffffff : 0xcdeeff, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = 10;
  parent.add(sprite);
  const item = { sprite, text: '', set(text) {
    text = String(text);
    if (text === item.text) return;
    item.text = text;
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 192);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 136px ui-rounded, "Arial Rounded MT Bold", Arial, sans-serif';
    ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = 15;
    ctx.strokeText(text, 256, 99, 475); ctx.fillStyle = fill; ctx.fillText(text, 256, 99, 475);
    texture.needsUpdate = true;
  } };
  return item;
}
function unit(r, geometry, material, parent, x, y, z, w = 1, h = 1, d = 1) {
  const mesh = r.mesh(geometry, material, parent);
  mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
  return mesh;
}
function makeTroops(r, max, tint, helmetColor) {
  const group = r.group();
  const parts = [];
  const add = (geo, x, y, z, rx = 0, rz = 0) => { geo.rotateX(rx); geo.rotateZ(rz); geo.translate(x, y, z); parts.push(geo); };
  add(new THREE.CylinderGeometry(.135, .17, .3, 10), 0, .39, 0);
  add(new THREE.SphereGeometry(.135, 10, 8), 0, .55, 0);
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(.055, .064, .27, 8), s * .18, .39, -.025, -.4, s * .23);
  add(new THREE.BoxGeometry(.085, .085, .29), .18, .35, -.15);
  const bodyGeo = mergeGeometries(parts); parts.forEach(g => g.dispose());
  const headGeo = new THREE.SphereGeometry(.14, 12, 10); headGeo.translate(0, .655, -.005);
  const helmGeo = new THREE.SphereGeometry(.158, 12, 8, 0, TAU, 0, Math.PI * .57); helmGeo.translate(0, .69, .004);
  const visorGeo = new THREE.BoxGeometry(.22, .072, .055); visorGeo.translate(0, .665, -.137);
  const legGeo = new THREE.BoxGeometry(.09, .24, .12); legGeo.translate(0, -.1, 0);
  const make = (geo, mat) => {
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = false; group.add(mesh); return mesh;
  };
  return { group, max, body: make(bodyGeo, r.mat(tint, { roughness: .42 })),
    head: make(headGeo, r.mat(0xffdfb1, { roughness: .65 })),
    helmet: make(helmGeo, r.mat(helmetColor, { roughness: .3, metalness: .18 })),
    visor: make(visorGeo, r.mat(0x18384f, { roughness: .25, metalness: .25 })),
    left: make(legGeo, r.mat(tint)), right: make(legGeo, r.mat(tint)) };
}
function updateTroops(pool, count, time, centerX, centerZ, width = 2.5, enemy = false, low = false) {
  const n = Math.min(pool.max, Math.max(0, Math.ceil(count)));
  const cols = Math.max(1, Math.min(Math.ceil(Math.sqrt(n * 1.25)), 10));
  const spacing = Math.min(.4, width / Math.max(1, cols - 1));
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const rowCount = Math.min(cols, n - row * cols);
    const phase = low ? 0 : time * 14 + i * 1.7;
    const x = centerX + (col - (rowCount - 1) / 2) * spacing;
    const z = centerZ + (enemy ? -1 : 1) * row * .4;
    const y = low ? .055 : .055 + Math.abs(Math.sin(phase)) * .055;
    dummy.position.set(x, y, z); dummy.rotation.set(0, enemy ? Math.PI : 0, 0); dummy.scale.setScalar(.92); dummy.updateMatrix();
    for (const mesh of [pool.body, pool.head, pool.helmet, pool.visor]) mesh.setMatrixAt(i, dummy.matrix);
    for (const [mesh, s] of [[pool.left, -1], [pool.right, 1]]) {
      dummy.position.set(x + s * .078, y + .24, z);
      dummy.rotation.set(Math.sin(phase + (s === 1 ? Math.PI : 0)) * .55, enemy ? Math.PI : 0, 0);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
  }
  for (const mesh of [pool.body, pool.head, pool.helmet, pool.visor, pool.left, pool.right]) {
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  }
  pool.group.visible = n > 0;
  return rows;
}
function gateFrame(r, state, x, tint) {
  const g = r.group(nullParent(state), x, 0, 0);
  const material = surface(r,'metal',tint,{metalness:.48,roughness:.37});
  for (const side of [-1, 1]) {
    unit(r, state.box, material, g, side * 1.51, 1.28, 0, .18, 2.55, .26);
    unit(r, state.box, 0xeaf9ff, g, side * 1.51, 2.43, .02, .205, .12, .29);
    unit(r, state.box, material, g, side * 1.51, .13, 0, .42, .26, .52);
    unit(r, state.box, 0xc8faff, g, side * 1.51, 1.3, .145, .055, 1.85, .028);
  }
  unit(r, state.box, material, g, 0, 2.5, 0, 3.18, .19, .28);
  const panel = unit(r, state.box, new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: .26, depthWrite: false, side: THREE.DoubleSide }), g, 0, 1.31, 0, 2.95, 2.26, .045);
  panel.castShadow = false;
  const glow = unit(r, state.box, new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: .13, depthWrite: false }), g, 0, .037, .13, 2.9, .025, 2.2);
  glow.castShadow = false;
  const number = label(r, g, 2.45, .94); number.sprite.position.set(0, 1.63, .14);
  return { group: g, number, panel, glow };
}
// Explicit parent is assigned by the caller after allocation, keeping helpers local.
function nullParent(state) { return state.parent; }

function palmLeafGeometry(){
  const vertices=[],uv=[];
  for(let i=0;i<5;i++){const a=i/5,b=(i+1)/5,point=(t,side)=>[t*1.3,Math.sin(t*Math.PI)*.18-t*t*.29,side*Math.sin(t*Math.PI)*.19];const pa=point(a,-1),pb=point(a,1),pc=point(b,1),pd=point(b,-1);vertices.push(...pa,...pb,...pc,...pa,...pc,...pd);uv.push(a,0,a,1,b,1,a,0,b,1,b,0);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return geo;
}
function buildGates(r, m) {
  const s = r.gates = { box: roundedBox(1,1,1,.055,1), sphere: new THREE.SphereGeometry(1, 12, 8), rows: [], lastEvent: 0, lastAttempt: m.attempt, effects: [], fxCursor: 0, impact: 0, lastTime: m.time };
  r.scene.background = new THREE.Color(0x92dcde);
  r.scene.fog = new THREE.Fog(0x92dcde, 34, 75);
  const ground = r.group();
  r.box(ground, 0, -1.72, -10, 150, .4, 170, surface(r,'water',0x369da8,{repeat:[55,65],roughness:.21,metalness:.12,bumpScale:.05}));
  r.box(ground, 0, -.35, -14, 8.25, .64, 70, 0x647f8f);
  r.box(ground, 0, -.035, -14, 7.55, .13, 70, surface(r,'stone',0xd7ddd5,{repeat:[5,45],roughness:.91,bumpScale:.03}));
  for (const x of [-3.91, 3.91]) {
    r.box(ground, x, .12, -14, .4, .38, 70, 0xebefda);
    r.box(ground, x, .34, -14, .44, .09, 70, 0xffffff);
    r.box(ground, x * .93, .04, -14, .075, .03, 70, 0xfdfbef);
    r.box(ground, x * 1.033, -.63, -14, .12, .35, 70, 0x426b7c);
  }
  // Receding bridge piers and small sandy islands keep the road in a real space.
  for (let i = 0; i < 8; i++) {
    const z = 10 - i * 9;
    for (const x of [-3.45, 3.45]) r.box(ground, x, -1.1, z, .72, 1.8, 1.4, 0x456d7b);
  }
  for (let i = 0; i < 12; i++) {
    const x = (i % 2 ? 1 : -1) * (9 + i % 4 * 4), z = 8 - i * 5.2;
    r.cylinder(ground, x, -1.5, z, 2.2, 2.75, .42, surface(r,'sand',0xe9d6a5,{repeat:[4,4]}), 16);
    r.cylinder(ground, x, -1.18, z, 1.65, 2.1, .58, surface(r,'turf',0x6f9969,{repeat:[4,4]}), 16);
    for (let j = 0; j < 3; j++) {
      const tx = x + Math.sin(j * 2.5) * .7, tz = z + Math.cos(j * 2.5) * .7;
      r.cylinder(ground, tx, -.28, tz, .09, .16, 1.55, 0xb88755, 7);
      for (let k = 0; k < 5; k++) {
        const a = k * TAU / 5;
        const leaf = r.mesh(palmLeafGeometry(),surface(r,'fabric',k%2?0x3a8058:0x65a269,{side:THREE.DoubleSide,roughness:.85,repeat:[1,3]}),ground);leaf.position.set(tx,.58,tz);leaf.rotation.y=-a;leaf.rotation.z=.08;
      }
    }
  }
  const timber=surface(r,'wood',0x916944,{repeat:[1,5]}),rope=surface(r,'fabric',0xb1a578,{repeat:[1,5]}),brass=surface(r,'metal',0xb69e69,{roughness:.52});
  for(const side of [-1,1]){
    for(let i=0;i<6;i++){
      const z=8-i*11;
      r.cylinder(ground,side*4.13,.83,z,.105,.135,2.05,timber,10);
      r.sphere(ground,side*4.13,1.94,z,.16,brass);
      if(i<5){r.tube(ground,[[side*4.13,1.72,z],[side*4.13,1.18,z-5.5],[side*4.13,1.72,z-11]],.045,rope);}
      // Rounded cutwaters, not featureless square bridge supports.
      r.cylinder(ground,side*3.5,-1.18,z,.42,.56,1.9,surface(r,'stone',0x677d77),10);
    }
  }
  r.mergeStatic(ground);
  s.dashes = [];
  for (let i = 0; i < 28; i++) {
    const mesh = unit(r, s.box, 0xf9fbeb, r.scene, 0, .044, i * 2.6 - 42, .085, .02, 1.05);
    mesh.castShadow = false; s.dashes.push(mesh);
  }
  s.posts = [];
  for (let i = 0; i < 22; i++) for (const side of [-1, 1]) {
    const post = r.group(r.scene, side * 3.93, .44, 0);
    unit(r, s.box, 0x6c9db0, post, 0, .15, 0, .16, .55, .18);
    unit(r, s.box, 0xfff2b5, post, 0, .39, 0, .23, .16, .25);
    s.posts.push({ group: post, index: i });
  }
  s.waves = [];
  for (let i = 0; i < 45; i++) {
    const mesh = unit(r, s.box, 0x70dae0, r.scene, (i % 2 ? 1 : -1) * (5.1 + i % 9 * 1.7), -1.48, -35 + i * 1.05, .5 + i % 4 * .22, .01, .055);
    mesh.castShadow = false; s.waves.push(mesh);
  }
  for (const row of m.rows) {
    const group = r.group(); const item = { group, type: row.type };
    if (row.type === 'gate') {
      s.parent = group;
      item.gates = [gateFrame(r, s, -1.75, 0x079ff1), gateFrame(r, s, 1.75, 0xa554f4)];
    } else if (row.type === 'barrier') {
      item.wall = r.group(group);
      for (let j = 0; j < 5; j++) {
        const g = r.group(item.wall, (j - 2) * .52, 0, 0);
        unit(r, s.box, 0x384d63, g, 0, .48, 0, .49, .95, .55);
        unit(r, s.box, 0xffa338, g, 0, .92, 0, .51, .12, .57);
        const stripe = unit(r, s.box, 0xffd165, g, 0, .51, .289, .085, .57, .025); stripe.rotation.z = -.45;
      }
      item.number = label(r, item.wall, 2, .8, '#ffdb70', '#5e281b'); item.number.sprite.position.set(0, 1.6, .12);
      item.reward = r.group(group);
      const crate = unit(r, s.box, 0xffc147, item.reward, 0, .4, 0, .76, .75, .76);
      crate.rotation.y = .2;
      unit(r, s.box, 0xffefb5, item.reward, 0, .79, 0, .86, .08, .86);
      unit(r, s.box, 0xfff0bb, item.reward, 0, .41, .394, .18, .48, .04);
      unit(r, s.box, 0xfff0bb, item.reward, 0, .41, .395, .48, .18, .04);
      item.rewardLabel = label(r, item.reward, 1.2, .54, '#fff7d1', '#8c5422'); item.rewardLabel.sprite.position.set(0, 1.26, 0);
    } else if (row.type === 'battle') {
      item.platoons = [makeTroops(r, 40, 0xe94e56, 0xff7971), makeTroops(r, 40, 0xe94e56, 0xff7971)];
      for (const p of item.platoons) group.add(p.group);
      item.labels = [-1.8, 1.8].map(x => { const l = label(r, group, 1.6, .7, '#fff1d7', '#962d3d'); l.sprite.position.set(x, 1.7, -.25); return l; });
      for (const x of [-1.8, 1.8]) {
        const pad = unit(r, s.box, 0xd9b9aa, group, x, .021, -.3, 3, .035, 2.6); pad.castShadow = false;
      }
    } else {
      item.robot = r.group(group);
      const robot = item.robot;
      for (const side of [-1, 1]) {
        unit(r, s.box, 0x833b50, robot, side * .42, .35, 0, .62, .6, .7);
        unit(r, s.box, 0xfa6865, robot, side * .43, .77, -.08, .52, .47, .55);
        r.sphere(robot, side * .87, 1.52, 0, .44, 0xfb7966, { metalness: .2, roughness: .32 });
        unit(r, s.box, 0xb73e54, robot, side * 1.02, 1.08, .02, .5, .62, .57);
        unit(r, s.box, 0xf1ab6b, robot, side * 1.05, .84, .15, .48, .29, .58);
      }
      r.cylinder(robot, 0, 1.38, 0, .66, .5, .98, 0xc94156, 8, { metalness: .18, roughness: .33 });
      unit(r, s.box, 0x773f53, robot, 0, 1.5, .55, .57, .53, .13);
      r.sphere(robot, 0, 1.5, .66, .19, 0xffd467, { emissive: 0xffa136, emissiveIntensity: 1.3 });
      unit(r, s.box, 0xf57465, robot, 0, 2.13, 0, 1.13, .64, .82);
      unit(r, s.box, 0x582d40, robot, 0, 2.2, .435, .81, .2, .065);
      for (const x of [-.22, .22]) unit(r, s.box, 0xffe39b, robot, x, 2.2, .475, .23, .095, .055);
      unit(r, s.box, 0xffd177, robot, 0, 2.54, 0, .66, .15, .48);
      for (const x of [-.25, 0, .25]) unit(r, s.box, 0xffd177, robot, x, 2.7, 0, .14, .36, .28);
      item.number = label(r, group, 2.5, 1, '#ffeabc', '#8a253b'); item.number.sprite.position.set(0, 3.5, .1);
      item.healthBack = unit(r, s.box, 0x973a4e, group, 0, 2.97, .55, 2.6, .18, .06);
      item.health = unit(r, s.box, 0xffd16a, group, 0, 2.98, .6, 2.5, .105, .065);
    }
    s.rows.push(item);
  }
  delete s.parent;
  s.troops = makeTroops(r, 110, 0x159fea, 0x7bd9ff);
  s.count = label(r, r.scene, 2.12, .83, '#fffef2', '#0c5895');
  s.cannon = r.group();
  unit(r, s.box, 0x276fc2, s.cannon, 0, .31, 0, .77, .35, .85);
  unit(r, s.box, 0x78d1f5, s.cannon, 0, .56, -.05, .55, .23, .55);
  const barrel = r.cylinder(s.cannon, 0, .69, -.39, .235, .27, .93, 0x23a6ef, 16, { metalness: .32, roughness: .28 }); barrel.rotation.x = Math.PI / 2;
  const muzzle = r.cylinder(s.cannon, 0, .69, -.885, .2, .2, .06, 0x174a72, 16); muzzle.rotation.x = Math.PI / 2;
  for (const x of [-.46, .46]) for (const z of [-.23, .29]) {
    const wheel = r.cylinder(s.cannon, x, .22, z, .23, .23, .14, 0x203a55, 12); wheel.rotation.z = Math.PI / 2;
    const hub = r.cylinder(s.cannon, x * 1.17, .22, z, .12, .12, .025, 0xffd783, 12); hub.rotation.z = Math.PI / 2;
  }
  s.shots = [];
  for (let i = 0; i < 16; i++) { const shot = unit(r, s.sphere, r.mat(0xffd966, { emissive: 0xffab28, emissiveIntensity: .8 }), r.scene, 0, 0, 0, .065, .065, .27); shot.castShadow = false; shot.visible = false; s.shots.push(shot); }
  for (let i = 0; i < 48; i++) { const mesh = unit(r, s.box, i % 3 ? 0x96edff : 0xffd765, r.scene, 0, 0, 0, .11, .11, .11); mesh.visible = false; mesh.castShadow = false; s.effects.push({ mesh, born: -5 }); }
  r.camera.position.set(0, 16, 17); r.camera.lookAt(0, .4, -5);
  r.sun.position.set(-9, 18, 9); r.sun.target.position.set(0, 0, -7);
}
function updateGates(r, m) {
  const s = r.gates, dt = clamp(m.time - s.lastTime, 0, .05); s.lastTime = m.time;
  const time = r.lowMotion ? 0 : m.time;
  const scroll = m.distance;
  for (let i = 0; i < s.dashes.length; i++) s.dashes[i].position.z = ((i * 2.6 + scroll) % 72.8) - 47;
  for (const p of s.posts) p.group.position.z = ((p.index * 3.3 + scroll) % 72.6) - 45;
  s.waves.forEach((w, i) => { w.position.x += r.lowMotion ? 0 : Math.sin(time * .6 + i) * dt * .06; });
  s.rows.forEach((view, index) => {
    const row = m.rows[index];
    view.group.position.z = row.z;
    view.group.visible = row.z > -33 && row.z < 11 && !(row.passed && row.type === 'battle');
    if (row.type === 'gate') {
      view.gates.forEach((g, lane) => {
        g.number.set(row.options[lane].op + row.options[lane].value);
        const pulse = row.passed && row.chosen === lane ? Math.max(0, 1 - (m.time - row.hit) / .6) : 0;
        g.group.scale.set(1 + pulse * .06, 1 + pulse * .08, 1);
        g.panel.material.opacity = .23 + pulse * .4;
        g.number.sprite.visible = !row.passed || m.time - row.hit < .4;
      });
    } else if (row.type === 'barrier') {
      view.wall.position.x = row.lane ? 1.8 : -1.8;
      view.reward.position.x = row.lane ? -1.8 : 1.8;
      view.number.set('−' + row.strength); view.rewardLabel.set('+' + row.reward);
      view.reward.visible = !row.passed || row.chosen === row.lane;
      view.wall.rotation.z = row.passed && row.chosen === row.lane ? Math.sin((m.time - row.hit) * 30) * Math.max(0, .5 - (m.time - row.hit)) * .1 : 0;
    } else if (row.type === 'battle') {
      view.platoons.forEach((p, lane) => {
        const count = m.combat?.row === row && m.combat.lane === lane ? m.combat.enemy : row.enemies[lane];
        updateTroops(p, count, time, lane ? 1.8 : -1.8, 0, 2.3, true, r.lowMotion);
        view.labels[lane].set(count);
        if (m.combat?.row === row) p.group.visible = lane === m.combat.lane;
        view.labels[lane].sprite.visible = m.combat?.row !== row || lane === m.combat.lane;
      });
    } else {
      const life = m.combat?.row === row ? m.combat.enemy : row.strength;
      view.number.set(life);
      view.health.scale.x = 2.5 * life / row.strength;
      view.health.position.x = -(2.5 - view.health.scale.x) / 2;
      view.robot.rotation.z = Math.sin(time * 3.6) * .035;
      view.robot.position.y = Math.abs(Math.sin(time * 3.6)) * .06;
    }
  });
  const renderCount = Math.min(110, m.crowd);
  const formationWidth = Math.min(2.7, .62 + Math.sqrt(renderCount) * .18);
  const frontZ = m.combat ? 3.25 : 3.45;
  const x = clamp(m.player.x, -3.34 + formationWidth / 2, 3.34 - formationWidth / 2);
  const rows = updateTroops(s.troops, renderCount, time, x, frontZ, formationWidth, false, r.lowMotion);
  s.count.set(m.crowd);
  s.count.sprite.position.set(x, 1.56 + Math.max(0, m.pop) * .18, frontZ + Math.max(.1, rows - 1) * .2);
  s.count.sprite.visible = !m.dead;
  s.cannon.position.set(x, .03, Math.min(8.1, frontZ + rows * .4 + .52));
  s.cannon.visible = !m.dead;
  s.cannon.rotation.z = m.combat && !r.lowMotion ? Math.sin(time * 35) * .024 : 0;
  s.shots.forEach((shot, i) => {
    shot.visible = !!m.combat && !r.lowMotion;
    if (shot.visible) {
      const f = (time * 4.8 + i / s.shots.length) % 1;
      const targetX = m.combat.row.type === 'boss' ? 0 : (m.combat.lane ? 1.8 : -1.8);
      shot.position.set(x + (targetX - x) * f + Math.sin(i * 2.4) * .42, .45 + Math.sin(f * Math.PI) * .25, 3.3 - f * 2.1);
    }
  });
  for (const e of m.events) {
    if (e.id <= s.lastEvent) continue;
    s.lastEvent = e.id;
    if (e.type === 'impact' || e.type === 'fail') s.impact = .23;
    if (e.type === 'gate' || e.type === 'victory' || e.type === 'fail' || e.type === 'impact') {
      const n = e.type === 'victory' ? 24 : 14;
      for (let i = 0; i < n; i++) {
        const f = s.effects[s.fxCursor++ % s.effects.length];
        f.born = m.time; f.x = e.x; f.z = 3.8; f.angle = i * 2.399; f.speed = .7 + i % 5 * .35;
        f.mesh.material = r.mat(e.type === 'fail' || e.type === 'impact' ? 0xff866f : i % 2 ? 0x7deaff : 0xffd56b);
      }
    }
  }
  for (const f of s.effects) {
    const t = m.time - f.born;
    f.mesh.visible = !r.lowMotion && t >= 0 && t < .9;
    if (f.mesh.visible) {
      f.mesh.position.set(f.x + Math.cos(f.angle) * t * f.speed, .8 + t * 3 - t * t * 4.6, f.z + Math.sin(f.angle) * t * f.speed);
      f.mesh.rotation.set(t * 5, f.angle, t * 7); f.mesh.scale.setScalar(.11 * (1 - t * .7));
    }
  }
  s.impact = Math.max(0, s.impact - dt);
  const shake = r.lowMotion ? 0 : Math.sin(time * 64) * s.impact * .18;
  r.camera.position.set(shake, 16, 17); r.camera.lookAt(0, .4, -5);
}

function chamferedBox() {
  const shape = new THREE.Shape();
  shape.moveTo(-.455, -.455); shape.lineTo(.455, -.455); shape.lineTo(.455, .455); shape.lineTo(-.455, .455); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: .91, bevelEnabled: true, bevelSize: .045, bevelThickness: .045, bevelSegments: 2, steps: 1 });
  geo.translate(0, 0, -.455); geo.rotateX(Math.PI / 2);
  return geo;
}
function buildStack(r, m) {
  const s = r.stack = { box: new THREE.BoxGeometry(1, 1, 1), bevel: chamferedBox(), slabs: [], cuts: [], rings: [], particles: [], lastEvent: 0, lastLevel: m.level, lastAttempt: m.attempt, rise: 0, lastTime: m.time, palette: [] };
  r.scene.background = new THREE.Color(0xf0d9ce);
  r.scene.fog = new THREE.Fog(0xf0d9ce, 24, 68);
  for (let i = 0; i < 32; i++) {
    const minerals=[0x729991,0x93b7a7,0xbcc5ab,0xd4bb94,0xc48d71,0xaf8592,0x9199af,0x729bad],c=new THREE.Color(minerals[Math.floor(i/4)%minerals.length]);c.lerp(new THREE.Color(0xf4ebd6),(i%4)*.06);
    s.palette.push({body:surface(r,'marble',c,{roughness:.32,repeat:[2,1]}),top:surface(r,'marble',c.clone().lerp(new THREE.Color(0xffffff),.23),{roughness:.25,repeat:[2,2]}),base:surface(r,'metal',0xb3996b,{metalness:.72,roughness:.4})});
  }
  const sky = r.group();
  // A quiet, layered skyline provides scale without competing with the moving tile.
  for (let i = 0; i < 34; i++) {
    const x = Math.sin(i * 2.37) * 24, z = -7 - i % 8 * 3.3;
    const h = 2.5 + (i * 7 % 11) * .62;
    const tint = [0xbed9d5, 0xc6d5d5, 0xd2cdc9, 0xd7d7ca, 0xb6d1d5][i % 5];
    r.box(sky, x, -13 + h / 2, z, 1.6 + i % 3 * .65, h, 1.6 + i % 4 * .36, tint);
    r.box(sky, x, -13 + h + .13, z, 1.8 + i % 3 * .65, .25, 1.8 + i % 4 * .36, 0xe6e4d9);
    if(i%3===0){r.cylinder(sky,x,-13+h+.52,z,.22,.5,.85,surface(r,'metal',0x9faead),8);r.box(sky,x,-13+h+1.2,z,.08,.7,.08,0xb3c1c0);}else if(i%3===1){r.box(sky,x,-13+h+.47,z,1.1,.65,1.05,0xc3ccc4);r.box(sky,x,-13+h+.88,z,.65,.2,.65,0xe5d8b6);}
    for (let j = 0; j < 4; j++) r.box(sky, x - .48 + j * .32, -13 + h * .62, z + (1.6 + i % 4 * .36) / 2 + .015, .1, h * .45, .025, 0xe7e2d2);
  }
  r.mergeStatic(sky);
  s.clouds = [];
  const cloudGeo = new THREE.SphereGeometry(1, 12, 8);
  const cloudMat = r.mat(0xfff7e8, { transparent: true, opacity: .68, roughness: 1, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const g = r.group(r.scene, Math.sin(i * 2.4) * 15, -7.5 + i % 3 * 1.2, -7 - i * 2.1);
    for (let j = 0; j < 4; j++) { const cloud = unit(r, cloudGeo, cloudMat, g, (j - 1.5) * .85, Math.sin(j * 1.4) * .15, 0, 1.2, .47, .76); cloud.castShadow = false; }
    s.clouds.push(g);
  }
  s.pedestal = r.group();
  unit(r, s.bevel, r.mat(0x367d8f, { roughness: .35, metalness: .2 }), s.pedestal, 0, -.72, 0, 4.25, .94, 4.25);
  unit(r, s.bevel, 0x75b9c5, s.pedestal, 0, -1.33, 0, 4.55, .34, 4.55);
  unit(r, s.bevel, 0xb4dada, s.pedestal, 0, -1.62, 0, 5, .26, 5);
  unit(r,s.box,surface(r,'stone',0x6c9697,{repeat:[2,6]}),s.pedestal,0,-5.65,0,2.9,7.85,2.9);
  const gold=surface(r,'metal',0xc5a879,{roughness:.4,metalness:.72}),pedestalStone=surface(r,'marble',0xc8d4c6,{roughness:.4});
  for(const x of [-1.33,1.33])for(const z of [-1.33,1.33]){r.cylinder(s.pedestal,x,-5.35,z,.15,.22,7.9,pedestalStone,12);for(const y of [-8.9,-3.8,-1.74])r.cylinder(s.pedestal,x,y,z,.27,.27,.1,gold,12);}
  for(const side of [-1,1]){r.box(s.pedestal,side*1.463,-5.35,0,.03,6.7,.045,gold);r.box(s.pedestal,0,-5.35,side*1.463,.045,6.7,.03,gold);}
  const slab = parent => {
    const group = r.group(parent);
    const body = unit(r, s.bevel, s.palette[0].body, group, 0, 0, 0);
    const top = unit(r, s.box, s.palette[0].top, group, 0, .455, 0, .908, .035, .908);
    const bottom = unit(r, s.box, s.palette[0].base, group, 0, -.454, 0, .912, .036, .912);
    return { group, body, top, bottom };
  };
  for (let i = 0; i < 20; i++) s.slabs.push(slab(r.scene));
  s.active = slab(r.scene);
  for (let i = 0; i < 8; i++) s.cuts.push(slab(r.scene));
  s.guide = r.group();
  for (const side of [-1, 1]) {
    unit(r, s.box, r.mat(0xfff3cf, { emissive: 0xffedb9, emissiveIntensity: .38, transparent: true, opacity: .8 }), s.guide, side * .5, 0, 0, .014, .035, 1);
    unit(r, s.box, r.mat(0xfff3cf, { emissive: 0xffedb9, emissiveIntensity: .38, transparent: true, opacity: .8 }), s.guide, 0, 0, side * .5, 1, .035, .014);
  }
  s.shadow = unit(r, s.box, new THREE.MeshBasicMaterial({ color: 0x125060, transparent: true, opacity: .2, depthWrite: false }), r.scene, 0, .28, 0, 1, .004, 1); s.shadow.castShadow = false;
  for (let i = 0; i < 6; i++) {
    const group = r.group();
    const material = new THREE.MeshBasicMaterial({ color: 0xfff7c8, transparent: true, opacity: .9, depthWrite: false });
    for (const side of [-1, 1]) {
      unit(r, s.box, material, group, side * .5, 0, 0, .024, .03, 1);
      unit(r, s.box, material, group, 0, 0, side * .5, 1, .03, .024);
    }
    group.visible = false; s.rings.push({ group, material, born: -5, level: 0, x: 0, z: 0, w: 1, d: 1 });
  }
  for (let i = 0; i < 32; i++) {
    const mesh = unit(r, s.box, i % 3 ? 0xfff0bd : 0xffffff, r.scene, 0, 0, 0, .055, .055, .055);
    mesh.visible = false; mesh.castShadow = false; s.particles.push({ mesh, born: -5, level: 0 });
  }
  s.flash = label(r, r.scene, 3.4, 1, '#ffffff', '#ba7067');
  s.flash.sprite.position.set(0, 2.4, 0); s.flash.sprite.visible = false;
  r.camera.position.set(8, 8, 11); r.camera.lookAt(0, -1.5, 0);
  r.sun.position.set(-8, 14, 10); r.sun.target.position.set(0, -2, 0);
}
function setSlab(s, view, piece, y, rotation = 0) {
  view.group.visible = !!piece;
  if (!piece) return;
  const colors = s.palette[((piece.level % s.palette.length) + s.palette.length) % s.palette.length];
  view.body.material = colors.body; view.top.material = colors.top; view.bottom.material = colors.base;
  view.group.position.set(piece.x, y, piece.z); view.group.scale.set(piece.w, .52, piece.d);
  view.group.rotation.set(0, 0, rotation);
}
function updateStack(r, m) {
  const s = r.stack, dt = clamp(m.time - s.lastTime, 0, .05); s.lastTime = m.time;
  if (s.lastAttempt !== m.attempt) {
    s.lastAttempt = m.attempt; s.lastLevel = m.level; s.rise = 0;
    s.rings.forEach(x => x.born = -5); s.particles.forEach(x => x.born = -5);
  }
  if (m.level !== s.lastLevel) { s.rise += (m.level - s.lastLevel) * .52; s.lastLevel = m.level; }
  s.rise *= Math.exp(-dt * 7);
  const rise = r.lowMotion ? 0 : s.rise;
  for (let i = 0; i < s.slabs.length; i++) {
    const b = m.blocks[i]; setSlab(s, s.slabs[i], b, b ? (b.level - m.level) * .52 + rise : 0);
  }
  s.pedestal.position.y = -m.level * .52 + rise;
  s.pedestal.visible = m.level < 23;
  if (!s.pedestal.visible) s.pedestal.position.y = -15;
  setSlab(s, s.active, m.dead ? null : m.active, .52 + rise);
  s.guide.position.set(m.top.x, .274 + rise, m.top.z); s.guide.scale.set(m.top.w + .04, 1, m.top.d + .04);
  s.guide.visible = !m.dead;
  const a = m.active, b = m.top;
  const left = Math.max(a.x - a.w / 2, b.x - b.w / 2), right = Math.min(a.x + a.w / 2, b.x + b.w / 2);
  const back = Math.max(a.z - a.d / 2, b.z - b.d / 2), front = Math.min(a.z + a.d / 2, b.z + b.d / 2);
  s.shadow.visible = !m.dead && right > left && front > back;
  if (s.shadow.visible) { s.shadow.position.set((left + right) / 2, .278 + rise, (front + back) / 2); s.shadow.scale.set(right - left, .004, front - back); }
  for (let i = 0; i < s.cuts.length; i++) {
    const cut = m.offcuts[i], t = cut ? m.time - cut.born : 0;
    setSlab(s, s.cuts[i], cut, cut ? (cut.level - m.level) * .52 + rise - t * t * 5 - t * .55 : 0, cut?.axis === 'x' ? -t * cut.direction * 2.5 : 0);
    if (cut) {
      const group = s.cuts[i].group;
      group.position[cut.axis] += cut.direction * t * .5;
      group.rotation.x = cut.axis === 'z' ? t * cut.direction * 2.5 : 0;
    }
  }
  for (const e of m.events) {
    if (e.id <= s.lastEvent) continue;
    s.lastEvent = e.id;
    if (e.type === 'perfect') {
      const ring = s.rings[e.id % s.rings.length]; Object.assign(ring, { born: m.time, level: e.level, x: e.x, z: e.z, w: e.w, d: e.d });
      for (let i = 0; i < s.particles.length; i++) Object.assign(s.particles[i], { born: m.time, level: e.level, x: e.x, z: e.z, w: e.w, d: e.d, angle: i * 2.399 });
    }
  }
  for (const f of s.rings) {
    const t = m.time - f.born;
    f.group.visible = !r.lowMotion && t >= 0 && t < .72;
    if (f.group.visible) {
      f.group.position.set(f.x, (f.level - m.level) * .52 + rise + .275, f.z);
      f.group.scale.set(f.w + t * 3.2, 1, f.d + t * 3.2); f.material.opacity = Math.max(0, .9 - t * 1.25);
    }
  }
  s.particles.forEach((f, i) => {
    const t = m.time - f.born;
    f.mesh.visible = !r.lowMotion && t >= 0 && t < .8;
    if (f.mesh.visible) {
      f.mesh.position.set(f.x + Math.cos(f.angle) * (f.w / 2 + t), (f.level - m.level) * .52 + rise + .3 + t * 1.3 - t * t * 2, f.z + Math.sin(f.angle) * (f.d / 2 + t));
      f.mesh.rotation.set(t * 3 + i, t * 5, 0); f.mesh.scale.setScalar(.055 * (1 - t));
    }
  });
  s.flash.sprite.visible = !!m.message && m.message.startsWith('PERFECT');
  if (s.flash.sprite.visible) {
    s.flash.set(m.combo > 1 ? '×' + m.combo : 'PERFECT');
    s.flash.sprite.position.y = 2.15 + (1 - m.messageTime / .8) * .4;
    s.flash.sprite.material.opacity = Math.min(1, m.messageTime * 3);
  }
  const time = r.lowMotion ? 0 : m.time;
  s.clouds.forEach((g, i) => g.position.x = Math.sin(i * 2.4) * 15 + Math.sin(time * .06 + i) * .65);
  r.camera.position.set(8, 8, 11); r.camera.lookAt(0, -1.5, 0);
}

export const GAME_RENDERERS = {
  gates: { build: buildGates, update: updateGates, height: aspect => Math.max(20.5, 9.5 / Math.max(.3, aspect)) },
  stack: { build: buildStack, update: updateStack, height: aspect => Math.max(12.5, 12 / Math.max(.3, aspect)) }
};
