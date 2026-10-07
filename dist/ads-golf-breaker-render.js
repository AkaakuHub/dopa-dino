import * as THREE from './vendor/three.module.min.js';

const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const brickColors=[0x7cf4ff,0xb5a0ff,0xff80c0,0xffc47d,0x93f4cb];
const powerColors={wide:0x71edff,fire:0xffa36d,slow:0xc3a0ff};
const noShadow=o=>{o.castShadow=false;return o;};
function pooledMesh(r,geometry,material,parent=r.scene){return r.mesh(geometry,material,parent);}
function pools(r,n,geometry,material,parent=r.scene){return Array.from({length:n},()=>{const q=pooledMesh(r,geometry,material,parent);q.visible=false;return q;});}
function glowMat(r,color,amount=.7,opacity=1){return r.mat(color,{emissive:color,emissiveIntensity:amount,roughness:.4,metalness:.2,...(opacity<1?{transparent:true,opacity,depthWrite:false}:{})});}
function roundedShape(w,d,rad){const s=new THREE.Shape(),x=-w/2,z=-d/2;s.moveTo(x+rad,z);s.lineTo(x+w-rad,z);s.quadraticCurveTo(x+w,z,x+w,z+rad);s.lineTo(x+w,z+d-rad);s.quadraticCurveTo(x+w,z+d,x+w-rad,z+d);s.lineTo(x+rad,z+d);s.quadraticCurveTo(x,z+d,x,z+d-rad);s.lineTo(x,z+rad);s.quadraticCurveTo(x,z,x+rad,z);return s;}
function slab(r,parent,w,d,h,color,y,bevel=.08){const g=new THREE.ExtrudeGeometry(roundedShape(w,d,.28),{depth:h,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:5});g.rotateX(-Math.PI/2);const q=r.mesh(g,color,parent);q.position.y=y;return q;}
function mountainGeometry(){const positions=[],normals=[];const tri=(a,b,c)=>positions.push(...a,...b,...c);const n=20;for(let i=0;i<n;i++){const a=i/n,b=(i+1)/n,za=a-.5,zb=b-.5,ha=Math.sin(a*Math.PI),hb=Math.sin(b*Math.PI);tri([-.5,ha,za],[.5,ha,za],[.5,hb,zb]);tri([-.5,ha,za],[.5,hb,zb],[-.5,hb,zb]);tri([-.5,0,za],[-.5,ha,za],[-.5,hb,zb]);tri([-.5,0,za],[-.5,hb,zb],[-.5,0,zb]);tri([.5,0,za],[.5,hb,zb],[.5,ha,za]);tri([.5,0,za],[.5,0,zb],[.5,hb,zb]);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();return geo;}
function makeBurst(r,colors,count=36){const geo=new THREE.BoxGeometry(.08,.08,.08),materials=colors.map(c=>glowMat(r,c,.28));return Array.from({length:count},(_,i)=>{const q=r.mesh(geo,materials[i%materials.length]);q.visible=false;q.castShadow=false;q.userData={born:-100};return q;});}
function burst(pool,time,x,z,colorIndex=0,strength=1,y=.4){for(let i=0;i<Math.min(14,pool.length);i++){const q=pool[(colorIndex*7+i)%pool.length];q.userData={born:time,x,z,y,a:i*2.399+colorIndex,speed:strength*(.7+(i%4)*.35),lift:1.8+(i%3)*.65};}}
function updateBurst(pool,time,lowMotion){for(const q of pool){const d=q.userData,t=time-d.born;q.visible=!lowMotion&&t>=0&&t<.72;if(!q.visible)continue;q.position.set(d.x+Math.cos(d.a)*d.speed*t,d.y+d.lift*t-4.5*t*t,d.z+Math.sin(d.a)*d.speed*t);q.rotation.set(t*5+d.a,t*3,t*6);q.scale.setScalar(Math.max(.05,1-t/.72));}}

function buildGolf(r,m){
  r.scene.background=new THREE.Color(0xc6e7d8);r.scene.fog=new THREE.Fog(0xc6e7d8,32,75);
  const g=r.golf={lastHole:0,lastEvent:0};const scenery=r.group();
  // A tiny garden, complete with a layered porcelain court and pebbled landscaping.
  r.box(scenery,0,-1.24,0,140,.5,140,0xb4d3c2);slab(r,scenery,8.9,12.05,.45,0xe7f1d8,-.8,.07);slab(r,scenery,8.5,11.7,.12,0x8bc8a0,-.26,.04);slab(r,scenery,7.65,10.85,.035,0x68b98a,-.055,.015);
  for(let i=0;i<11;i++)r.box(scenery,0,.002,-5+i,7.58,.008,.49,i%2?0x7ac69a:0x72c193);
  // Warm ivory cushioned rails are part of the bank-shot collision boundary.
  for(const x of [-3.94,3.94]){r.box(scenery,x,.2,0,.26,.43,11.18,0xf0efd7);r.box(scenery,x,.43,0,.3,.055,11.22,0xfff9e7);for(let k=0;k<9;k++)r.box(scenery,x,.468,-4.8+k*1.2,.18,.025,.075,0xe2c574);}
  for(const z of [-5.54,5.54]){r.box(scenery,0,.2,z,8.1,.43,.27,0xf0efd7);r.box(scenery,0,.43,z,8.14,.055,.31,0xfff9e7);}
  const treeGeo=new THREE.IcosahedronGeometry(1,1);for(let i=0;i<9;i++){const side=i%2?1:-1,x=side*(5.05+(i%3)*.3),z=-5.1+i*1.22;const trunk=r.cylinder(scenery,x,-.05,z,.09,.16,1.5,0x956b4d,8);const crown=pooledMesh(r,treeGeo,r.mat([0x4e9b79,0x74b789,0x99c892][i%3]),scenery);crown.position.set(x,.92+(i%2)*.2,z);crown.scale.set(.56,.74,.6);r.cylinder(scenery,x,-.94,z,.65,.7,.22,0xa3be9b,12);}
  for(let i=0;i<24;i++){const x=(i%2?1:-1)*(4.73+(i%3)*.17),z=-5.1+Math.floor(i/2)*.93,rock=pooledMesh(r,treeGeo,r.mat(i%2?0xe3e3c6:0xcdd7b8),scenery);rock.position.set(x,-.64,z);rock.scale.set(.17+(i%3)*.045,.14,.19);}
  for(const x of [-2.8,2.8]){r.box(scenery,x,-.65,6.35,1.5,.2,.62,0xb99562);r.box(scenery,x,-.42,6.61,1.5,.38,.12,0xcfa970);for(const dx of [-.56,.56])r.box(scenery,x+dx,-.87,6.35,.12,.4,.58,0x657b67);}
  // Small flower beds use shared, low-poly geometry.
  const petalGeo=new THREE.IcosahedronGeometry(.11,0),stemGeo=new THREE.CylinderGeometry(.012,.017,.3,5);for(let i=0;i<14;i++){const x=-3.7+i*.57,z=-6.25+Math.sin(i*1.6)*.1;const s=pooledMesh(r,stemGeo,r.mat(0x5b9975),scenery);s.position.set(x,-.7,z);const f=pooledMesh(r,petalGeo,r.mat(i%3?0xffdb98:0xf6a6a9),scenery);f.position.set(x,-.5,z);}
  r.mergeStatic(scenery);
  g.blocks=[];const unit=new THREE.BoxGeometry(1,1,1);for(let i=0;i<5;i++){const block=r.group();const wall=pooledMesh(r,unit,r.mat(0x4d9477),block);wall.position.y=.26;wall.scale.y=.52;const cap=pooledMesh(r,unit,r.mat(0xe8edcc),block);cap.position.y=.55;cap.scale.y=.065;const stripe=pooledMesh(r,unit,r.mat(0xd7bb68),block);stripe.position.set(0,.591,0);stripe.scale.set(.75,.012,.24);block.visible=false;g.blocks.push(block);}
  g.sand=pools(r,3,unit,r.mat(0xead7a7));g.sand.forEach(o=>o.castShadow=false);
  g.sandSpecks=pools(r,30,new THREE.CircleGeometry(.035,5),r.mat(0xc3ae7f));g.sandSpecks.forEach(q=>{q.rotation.x=-Math.PI/2;q.castShadow=false;});
  g.ramps=pools(r,2,mountainGeometry(),r.mat(0x91d59e));
  g.rampTicks=pools(r,14,new THREE.SphereGeometry(.038,6,4),r.mat(0xeaf4bc));g.rampTicks.forEach(q=>q.castShadow=false);
  g.cup=r.group();const inner=r.cylinder(g.cup,0,.012,0,.255,.255,.018,0x172e2a,40);inner.castShadow=false;r.ring(g.cup,0,.023,0,.26,.026,0xddecc4);r.ring(g.cup,0,.026,0,.35,.014,0xbee0a7);
  g.flag=r.group();r.cylinder(g.flag,0,.95,0,.022,.025,1.9,0xefe9c9,10);r.cylinder(g.flag,0,.09,0,.053,.07,.16,0x748a61,12);r.sphere(g.flag,0,1.96,0,.057,0xe6bd5a);const flagGeo=new THREE.PlaneGeometry(.67,.42,6,3);g.flagCloth=r.mesh(flagGeo,r.mat(0xff906f,{side:THREE.DoubleSide,roughness:.8}),g.flag);g.flagCloth.position.set(.35,1.7,0);g.flagCloth.userData.base=new Float32Array(flagGeo.attributes.position.array);r.box(g.flag,.22,1.7,.01,.085,.25,.012,0xffe8b0);r.box(g.flag,.35,1.7,.01,.085,.25,.012,0xffe8b0);
  g.ball=r.group();g.ballBody=r.sphere(g.ball,0,0,0,.16,0xfffdf3,{roughness:.28,metalness:.03});const logo=r.sphere(g.ball,0,.13,.075,.042,0xf78d6b);logo.scale.z=.3;g.ballShadow=r.mesh(new THREE.CircleGeometry(.2,24),r.mat(0x286d54,{transparent:true,opacity:.25,depthWrite:false}));g.ballShadow.rotation.x=-Math.PI/2;g.ballShadow.castShadow=false;
  g.selection=r.ring(r.scene,0,.017,0,.31,.018,0xf8ecc0);g.selection.castShadow=false;
  g.aim=pools(r,42,new THREE.SphereGeometry(.047,7,5),glowMat(r,0xfff4c0,.17));g.aim.forEach(q=>q.castShadow=false);
  g.power=pools(r,20,new THREE.SphereGeometry(.034,6,4),r.mat(0xf9da82));g.power.forEach(q=>q.castShadow=false);
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0],3));g.pullLine=new THREE.Line(lineGeo,new THREE.LineDashedMaterial({color:0xec8566,dashSize:.1,gapSize:.08,transparent:true,opacity:.9}));r.scene.add(g.pullLine);
  g.putter=r.group();r.box(g.putter,0,.12,0,.55,.16,.11,0xc7d4cf,{metalness:.75,roughness:.25});r.cylinder(g.putter,.16,.68,0,.019,.019,1.12,0x72958c,9);r.cylinder(g.putter,.16,1.23,0,.035,.035,.26,0x4c7362,9);
  g.burst=makeBurst(r,[0xffc887,0xeff7d4,0x8cf0bf,0xf59b91],42);
  g.ripples=pools(r,4,new THREE.TorusGeometry(.32,.018,6,40),r.mat(0xfff4c4,{transparent:true,opacity:.65,depthWrite:false}));g.ripples.forEach(q=>{q.rotation.x=Math.PI/2;q.castShadow=false;q.userData.born=-100;});
  r.camera.position.set(8.5,16.5,15.4);r.camera.lookAt(0,-.1,0);r.sun.position.set(-8,17,6);r.sun.intensity=2.35;
  updateGolf(r,m);
}
function updateGolf(r,m){const g=r.golf,t=r.lowMotion?0:m.time;if(g.lastHole!==m.holeNumber){g.lastHole=m.holeNumber;
    g.blocks.forEach((q,i)=>{const b=m.blocks[i];q.visible=!!b;if(b){q.position.set(b.x,0,b.z);q.scale.set(b.w,1,b.d);}});
    g.sand.forEach((q,i)=>{const s=m.sand[i];q.visible=!!s;if(s){q.position.set(s.x,.009,s.z);q.scale.set(s.w,.008,s.d);}});
    g.sandSpecks.forEach((q,i)=>{const s=m.sand[Math.floor(i/15)];q.visible=!!s;if(s)q.position.set(s.x+Math.sin(i*3.4)*s.w*.41,.018,s.z+Math.cos(i*5.1)*s.d*.41);});
    g.ramps.forEach((q,i)=>{const s=m.ramps[i];q.visible=!!s;if(s){q.position.set(s.x,.014,s.z);q.scale.set(s.w,s.h,s.d);}});
    g.rampTicks.forEach((q,i)=>{const s=m.ramps[Math.floor(i/7)];q.visible=!!s;if(s){const f=(i%7)/6;q.position.set(s.x-s.w*.46,.025+s.h*Math.sin(f*Math.PI),s.z+s.d*(f-.5));}});
    g.cup.position.set(m.cup.x,0,m.cup.z);g.flag.position.set(m.cup.x+.055,0,m.cup.z-.065);
  }
  const fall=m.sinking?1-m.sinking/.85:0;g.ball.position.set(m.ball.x,.17+m.ballHeight-fall*.28,m.ball.z);g.ball.scale.setScalar(Math.max(.02,1-fall*.83));g.ball.rotation.set(m.ballSpin*Math.cos(m.aim),0,m.ballSpin*Math.sin(m.aim));g.ballShadow.position.set(m.ball.x,.014+m.ballHeight,m.ball.z);g.ballShadow.visible=!m.sinking;g.selection.position.set(m.ball.x,.025+m.ballHeight,m.ball.z);g.selection.visible=m.canShoot;g.selection.scale.setScalar(1+Math.sin(t*3)*.035);
  const showAim=m.canShoot&&(!m.dragging||m.dragPower>.035),path=showAim?m.aimPath():[];g.aim.forEach((q,i)=>{q.visible=i<path.length&&showAim;if(q.visible){const p=path[i];q.position.set(p.x,.078+p.h,p.z);q.scale.setScalar(.55+.65*(1-i/42));}});
  g.power.forEach((q,i)=>{q.visible=m.canShoot&&i<Math.ceil(m.power*20);if(q.visible){const a=-Math.PI/2+i*TAU/20;q.position.set(m.ball.x+Math.cos(a)*.45,.035+m.ballHeight,m.ball.z+Math.sin(a)*.45);}});
  g.pullLine.visible=m.dragging&&m.dragPower>.025;if(g.pullLine.visible){const a=g.pullLine.geometry.attributes.position;a.setXYZ(0,m.ball.x,.055+m.ballHeight,m.ball.z);const d=Math.min(3.25,Math.hypot(m.dragPoint.x-m.ball.x,m.dragPoint.z-m.ball.z));a.setXYZ(1,m.ball.x-Math.sin(m.aim)*d,.055,m.ball.z+Math.cos(m.aim)*d);a.needsUpdate=true;g.pullLine.computeLineDistances();}
  g.putter.visible=m.canShoot;g.putter.rotation.y=-m.aim;const pull=m.dragging?m.power*.9:.32;g.putter.position.set(m.ball.x-Math.sin(m.aim)*(.33+pull),m.ballHeight,m.ball.z+Math.cos(m.aim)*(.33+pull));
  const verts=g.flagCloth.geometry.attributes.position,base=g.flagCloth.userData.base;for(let i=0;i<verts.count;i++)verts.setZ(i,Math.sin(t*3+base[i*3]*7)*.055*(base[i*3]+.34));verts.needsUpdate=true;
  for(const e of m.events){if(e.id<=g.lastEvent)continue;g.lastEvent=e.id;if(e.type==='cup')burst(g.burst,m.time,e.x,e.z,e.id,2,.23);if(e.type==='bank'||e.type==='shot'){const q=g.ripples[e.id%g.ripples.length];q.userData.born=m.time;q.position.set(e.x,.045+m.terrainAt(e.x,e.z).height,e.z);}}
  g.ripples.forEach(q=>{const age=m.time-q.userData.born;q.visible=!r.lowMotion&&age<.4&&age>=0;if(q.visible)q.scale.setScalar(.2+age*2);});updateBurst(g.burst,m.time,r.lowMotion);
}

function buildBreaker(r,m){
  r.scene.background=new THREE.Color(0x11182d);r.scene.fog=new THREE.Fog(0x11182d,30,70);r.sun.intensity=1.8;r.sun.position.set(-7,14,4);
  const g=r.breaker={lastEvent:0};const architecture=r.group();
  r.box(architecture,0,-1.1,0,150,.5,150,0x10172a);slab(r,architecture,10.2,13.05,.45,0x18263d,-.76,.08);slab(r,architecture,9.6,12.5,.1,0x293b55,-.18,.035);r.box(architecture,0,-.01,-.05,9,.045,11.7,0x111e33,{metalness:.35,roughness:.42});
  const gridMat=glowMat(r,0x254b66,.3);for(let i=-4;i<=4;i++)r.box(architecture,i,.016,-.02,.018,.014,11.6,gridMat);for(let i=-5;i<=5;i++)r.box(architecture,0,.016,i,9,.014,.018,gridMat);
  for(const side of [-1,1]){r.box(architecture,side*4.72,.19,-.1,.45,.42,11.95,0x34465f,{metalness:.55,roughness:.3});r.box(architecture,side*4.515,.26,-.1,.035,.105,11.95,glowMat(r,0x67e5fa,1.2));r.box(architecture,side*4.72,.418,-.1,.15,.023,11.95,glowMat(r,0x2c88ab,.55));for(let j=0;j<8;j++){r.box(architecture,side*4.75,.475,-5.2+j*1.5,.19,.1,.55,0x638599,{metalness:.65});r.box(architecture,side*4.756,.541,-5.2+j*1.5,.1,.02,.18,glowMat(r,j%2?0xf1ba75:0x8aecf1,.8));}}
  r.box(architecture,0,.2,-5.78,9.5,.4,.44,0x425575,{metalness:.55});r.box(architecture,0,.26,-5.54,8.98,.1,.035,glowMat(r,0x8bb9ff,1.3));
  for(let i=0;i<18;i++){const x=-4.25+i*.5;const hatch=r.box(architecture,x,.035,5.79,.24,.025,.23,i%2?0xe07887:0x41546f);hatch.rotation.y=-.4;}
  // Recessed corner bolts, circuit runs and side pylons establish a real 3D cabinet.
  for(const x of [-4.87,4.87])for(const z of [-6.16,6.16]){r.cylinder(architecture,x,.02,z,.105,.105,.035,0x8096ad,12,{metalness:.75});r.box(architecture,x,.044,z,.1,.014,.02,0x27354a);}
  for(let i=0;i<7;i++){const x=(i%2?1:-1)*(6.2+(i%3)*1.4),z=-6.4+i*1.85,h=1+(i%3)*.75;r.box(architecture,x,h/2-.95,z,.45,h,.65,0x1f304b);r.box(architecture,x,h-.95,z,.47,.07,.67,glowMat(r,i%2?0x625bc8:0x2975a9,.65));}
  r.mergeStatic(architecture);
  g.paddle=r.group();g.paddleCore=r.box(g.paddle,0,.27,0,1,.4,.39,0xc8e5ed,{metalness:.65,roughness:.22});g.paddleTop=r.box(g.paddle,0,.48,0,.88,.055,.29,glowMat(r,0x72eafa,1.15));g.paddleGlow=r.box(g.paddle,0,.08,0,1.13,.02,.59,glowMat(r,0x4bd9f0,.6,.18));g.paddleGlow.castShadow=false;
  g.paddleEnds=[];for(const side of [-1,1]){const end=r.group(g.paddle);r.box(end,0,.28,0,.17,.48,.47,0x304d69,{metalness:.6});r.box(end,0,.534,0,.12,.035,.36,glowMat(r,0xffc17c,.8));g.paddleEnds.push(end);}
  g.bricks=[];const cube=new THREE.BoxGeometry(1,1,1),brickMats=brickColors.map(c=>r.mat(c,{metalness:.28,roughness:.3})),trimMats=brickColors.map(c=>glowMat(r,c,.8)),shadowMaterial=r.mat(0x172941),armorMaterial=r.mat(0xe9f5fa,{metalness:.8,roughness:.2});
  for(let i=0;i<42;i++){const q=r.group();const base=pooledMesh(r,cube,shadowMaterial,q);base.scale.set(1.14,.17,.61);base.position.y=.115;const body=pooledMesh(r,cube,brickMats[i%5],q);body.scale.set(1.1,.46,.56);body.position.y=.37;const cap=pooledMesh(r,cube,trimMats[i%5],q);cap.scale.set(.94,.032,.075);cap.position.set(0,.622,-.15);const inset=pooledMesh(r,cube,r.mat(0xffffff,{transparent:true,opacity:.34,roughness:.4}),q);inset.scale.set(.9,.012,.19);inset.position.set(0,.607,.03);const armor=pooledMesh(r,cube,armorMaterial,q);armor.position.set(0,.643,0);armor.scale.set(.13,.045,.5);q.visible=false;g.bricks.push({group:q,body,cap,armor,inset});}
  g.brickMats=brickMats;g.trimMats=trimMats;
  g.ball=r.sphere(r.scene,0,.29,0,.165,glowMat(r,0xf8fbff,.5));g.ballRing=r.ring(r.scene,0,.044,0,.25,.012,0x8be6ff);g.ballRing.castShadow=false;g.ballHalo=r.sphere(r.scene,0,.29,0,.23,glowMat(r,0x8ceaff,1,.12));g.ballHalo.castShadow=false;
  g.trail=pools(r,16,new THREE.SphereGeometry(.12,9,6),glowMat(r,0x76e6ff,.8,.35));g.trail.forEach(q=>q.castShadow=false);
  g.pickups=[];const diamond=new THREE.OctahedronGeometry(.25,0);for(let i=0;i<6;i++){const q=r.group();const body=pooledMesh(r,diamond,new THREE.MeshStandardMaterial({color:powerColors.wide,emissive:powerColors.wide,emissiveIntensity:.65,metalness:.2,roughness:.4}),q);const line=r.ring(q,0,0,0,.35,.018,0xe2f8ff);line.rotation.x=.8;const shadow=r.mesh(new THREE.CircleGeometry(.24,12),r.mat(0x3d8cad,{transparent:true,opacity:.25,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;q.visible=false;shadow.visible=false;g.pickups.push({group:q,body,line,shadow});}
  g.burst=makeBurst(r,brickColors,56);
  g.ripples=pools(r,8,new THREE.TorusGeometry(.24,.024,6,32),glowMat(r,0xb8f8ff,.6,.65));g.ripples.forEach(q=>{q.rotation.x=Math.PI/2;q.castShadow=false;q.userData.born=-100;});
  g.serveDots=pools(r,9,new THREE.SphereGeometry(.035,7,5),glowMat(r,0x85d9ea,.55));g.serveDots.forEach(q=>q.castShadow=false);
  g.floorGlow=r.mesh(new THREE.CircleGeometry(1.5,40),glowMat(r,0x39b5d8,.3,.045));g.floorGlow.rotation.x=-Math.PI/2;g.floorGlow.position.y=.018;g.floorGlow.castShadow=false;
  // Mild perspective in an orthographic projection keeps paddle tracking exact.
  r.camera.position.set(0,17,11.8);r.camera.lookAt(0,0,-.2);updateBreaker(r,m);
}
function updateBreaker(r,m){const g=r.breaker,t=r.lowMotion?0:m.time;g.paddle.position.set(m.paddle.x,0,m.paddle.z);g.paddleCore.scale.x=m.paddle.w;g.paddleTop.scale.x=m.paddle.w;g.paddleGlow.scale.x=m.paddle.w;g.paddleEnds.forEach((q,i)=>q.position.x=(i?1:-1)*m.paddle.w*.48);
  g.bricks.forEach((q,i)=>{const b=m.bricks[i];q.group.visible=!!b&&b.hp>0;if(!q.group.visible)return;q.group.position.set(b.x,b.hit*.35,b.z);q.group.scale.set(1+b.hit*.22,1-b.hit*.7,1+b.hit*.22);q.body.material=g.brickMats[b.color];q.cap.material=g.trimMats[b.color];q.armor.visible=b.hp>1;q.inset.visible=b.maxHp===1||b.hp>1;});
  g.ball.visible=!m.dead&&!m.wavePause;g.ball.position.set(m.ball.x,.28,m.ball.z);g.ball.material.color.setHex(m.power.fire>0?0xffc56e:0xf7fdff);g.ball.material.emissive.setHex(m.power.fire>0?0xff9b46:0xbcefff);g.ballHalo.position.copy(g.ball.position);g.ballHalo.visible=g.ball.visible;g.ballHalo.material.color.setHex(m.power.fire>0?0xffa165:0x8ceaff);g.ballHalo.scale.setScalar(1+Math.sin(t*10)*.12);g.ballRing.position.set(m.ball.x,.043,m.ball.z);g.ballRing.visible=g.ball.visible;
  g.trail.forEach((q,i)=>{q.visible=!r.lowMotion&&!m.serving&&!m.dead&&!m.wavePause&&i<m.trail.length;if(q.visible){const p=m.trail[i];q.position.set(p.x,.265,p.z);q.scale.setScalar(1-i/17);q.material.color.setHex(m.power.fire>0?0xff9e62:0x76e6ff);}});
  g.pickups.forEach((q,i)=>{const p=m.pickups[i];q.group.visible=q.shadow.visible=!!p;if(p){q.group.position.set(p.x,.48+Math.sin(t*5+p.phase)*.09,p.z);q.group.rotation.y=t*2+p.phase;q.body.rotation.z=t+p.phase;q.body.material.color.setHex(powerColors[p.kind]);q.body.material.emissive.setHex(powerColors[p.kind]);q.line.rotation.y=t*1.7;q.shadow.position.set(p.x,.028,p.z);}});
  g.serveDots.forEach((q,i)=>{q.visible=!!m.serving&&!m.dead&&!m.wavePause;if(q.visible)q.position.set(m.ball.x+Math.sin(.22*Math.sin(m.wave*1.7+m.attempt))*i*.26,.09,m.ball.z-.45-i*.26);});
  g.floorGlow.position.set(m.paddle.x,.018,m.paddle.z-.08);g.floorGlow.scale.set(m.paddle.w,1,1);
  for(const e of m.events){if(e.id<=g.lastEvent)continue;g.lastEvent=e.id;if(e.type==='brick'||e.type==='armor'||e.type==='power')burst(g.burst,m.time,e.x,e.z,e.id,e.type==='armor'?.45:1.6,.47);if(['paddle','wall','loss','launch'].includes(e.type)){const q=g.ripples[e.id%g.ripples.length];q.userData.born=m.time;q.position.set(e.x,.05,e.z);}if(e.type==='clear')for(let i=0;i<4;i++)burst(g.burst,m.time,-3+i*2,-2,i,2.4,.7);}
  g.ripples.forEach(q=>{const age=m.time-q.userData.born;q.visible=!r.lowMotion&&age>=0&&age<.4;if(q.visible)q.scale.setScalar(.3+age*3);});updateBurst(g.burst,m.time,r.lowMotion);
}

export const GAME_RENDERERS={
  golf:{build:buildGolf,update:updateGolf,height:aspect=>Math.max(16.8,11.7/Math.max(.35,aspect))},
  breaker:{build:buildBreaker,update:updateBreaker,height:aspect=>Math.max(14.2,10.7/Math.max(.35,aspect))}
};
