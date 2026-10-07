import * as THREE from './vendor/three.module.min.js';
import {surface,roundedBox} from './ads-visuals.js';

const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const brickColors=[0x4d9b9a,0xd4b465,0xd47751,0xc5d5c5,0x697faa];
const powerColors={wide:0x71edff,fire:0xffa36d,slow:0xc3a0ff,multi:0xffe47a};
const noShadow=o=>{o.castShadow=false;return o;};
function pooledMesh(r,geometry,material,parent=r.scene){return r.mesh(geometry,material,parent);}
function pools(r,n,geometry,material,parent=r.scene){return Array.from({length:n},()=>{const q=pooledMesh(r,geometry,material,parent);q.visible=false;return q;});}
function glowMat(r,color,amount=.7,opacity=1){return r.mat(color,{emissive:color,emissiveIntensity:amount,roughness:.4,metalness:.2,...(opacity<1?{transparent:true,opacity,depthWrite:false}:{})});}
function roundedShape(w,d,rad){const s=new THREE.Shape(),x=-w/2,z=-d/2;s.moveTo(x+rad,z);s.lineTo(x+w-rad,z);s.quadraticCurveTo(x+w,z,x+w,z+rad);s.lineTo(x+w,z+d-rad);s.quadraticCurveTo(x+w,z+d,x+w-rad,z+d);s.lineTo(x+rad,z+d);s.quadraticCurveTo(x,z+d,x,z+d-rad);s.lineTo(x,z+rad);s.quadraticCurveTo(x,z,x+rad,z);return s;}
function slab(r,parent,w,d,h,color,y,bevel=.08){const g=new THREE.ExtrudeGeometry(roundedShape(w,d,.28),{depth:h,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:5});g.rotateX(-Math.PI/2);const q=r.mesh(g,color,parent);q.position.y=y;return q;}
function softBox(r,parent,x,y,z,w,h,d,material,radius=.06){const q=r.mesh(roundedBox(w,h,d,Math.min(radius,w*.45,h*.45,d*.45),2),material,parent);q.position.set(x,y,z);return q;}
function mountainGeometry(){const positions=[];const tri=(a,b,c)=>positions.push(...a,...b,...c);const n=20;for(let i=0;i<n;i++){const a=i/n,b=(i+1)/n,za=a-.5,zb=b-.5,ha=Math.sin(a*Math.PI),hb=Math.sin(b*Math.PI);tri([-.5,ha,za],[.5,ha,za],[.5,hb,zb]);tri([-.5,ha,za],[.5,hb,zb],[-.5,hb,zb]);tri([-.5,0,za],[-.5,ha,za],[-.5,hb,zb]);tri([-.5,0,za],[-.5,hb,zb],[-.5,0,zb]);tri([.5,0,za],[.5,hb,zb],[.5,ha,za]);tri([.5,0,za],[.5,0,zb],[.5,hb,zb]);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const uv=[];for(let i=0;i<positions.length;i+=3)uv.push(positions[i]+.5,positions[i+2]+.5);geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return geo;}
function makeBurst(r,colors,count=36){const geo=new THREE.BoxGeometry(.08,.08,.08),materials=colors.map(c=>glowMat(r,c,.28));return Array.from({length:count},(_,i)=>{const q=r.mesh(geo,materials[i%materials.length]);q.visible=false;q.castShadow=false;q.userData={born:-100};return q;});}
function burst(pool,time,x,z,colorIndex=0,strength=1,y=.4){for(let i=0;i<Math.min(14,pool.length);i++){const q=pool[(colorIndex*7+i)%pool.length];q.userData={born:time,x,z,y,a:i*2.399+colorIndex,speed:strength*(.7+(i%4)*.35),lift:1.8+(i%3)*.65};}}
function updateBurst(pool,time,lowMotion){for(const q of pool){const d=q.userData,t=time-d.born;q.visible=!lowMotion&&t>=0&&t<.72;if(!q.visible)continue;q.position.set(d.x+Math.cos(d.a)*d.speed*t,d.y+d.lift*t-4.5*t*t,d.z+Math.sin(d.a)*d.speed*t);q.rotation.set(t*5+d.a,t*3,t*6);q.scale.setScalar(Math.max(.05,1-t/.72));}}

function buildGolf(r,m){
  r.scene.background=new THREE.Color(0xcdd9c8);r.scene.fog=new THREE.Fog(0xcdd9c8,30,68);
  const g=r.golf={lastHole:0,lastEvent:0};const scenery=r.group();
  const stone=surface(r,'stone',0xd6d1b9,{repeat:[3,4],roughness:.86,bumpScale:.06}),stoneDark=surface(r,'stone',0x7b8770,{repeat:[3,3],roughness:.94}),timber=surface(r,'wood',0x987250,{repeat:[1,3],roughness:.67}),oak=surface(r,'wood',0xc39d65,{repeat:[1,4],roughness:.62}),turf=surface(r,'turf',0x4d8d57,{repeat:[7,10],roughness:.98,bumpScale:.055}),turfLight=surface(r,'turf',0x689b63,{repeat:[6,8],roughness:.98,bumpScale:.04}),leafDark=r.mat(0x366548,{roughness:.94}),leafMid=r.mat(0x568354,{roughness:.9}),leafLight=r.mat(0x7da15e,{roughness:.86}),brass=surface(r,'metal',0xc7a362,{repeat:[2,2],roughness:.38,metalness:.62});
  // The course is an actual constructed garden: limestone footing, timber fascia,
  // a layered living lawn and a slender oak cap over the collision rails.
  r.box(scenery,0,-1.13,0,140,.35,140,surface(r,'stone',0xbac4b0,{repeat:[70,70],bumpScale:.05,roughness:.95}));
  slab(r,scenery,9.4,12.7,.37,stone,-.94,.07);slab(r,scenery,9.06,12.36,.23,timber,-.5,.045);slab(r,scenery,8.7,12,.12,stone,-.24,.035);slab(r,scenery,7.65,10.85,.05,turf,-.068,.018);
  for(let i=0;i<11;i++)r.box(scenery,0,.004,-5+i,7.54,.006,.49,i%2?turf:turfLight);
  for(const side of [-1,1]){
    softBox(r,scenery,side*3.94,.18,0,.27,.4,11.18,stone,.07);softBox(r,scenery,side*3.94,.402,0,.32,.074,11.23,oak,.028);
    r.box(scenery,side*4.11,.02,0,.05,.09,11.35,timber);
    for(let k=0;k<12;k++){const z=-5.07+k*.92;r.box(scenery,side*4.475,-.4,z,.018,.17,.012,stoneDark);r.cylinder(scenery,side*3.94,.447,z,.034,.034,.012,brass,8);}
  }
  for(const z of [-5.54,5.54]){softBox(r,scenery,0,.18,z,8.1,.4,.27,stone,.065);softBox(r,scenery,0,.402,z,8.14,.074,.32,oak,.028);r.box(scenery,0,.025,z+Math.sign(z)*.19,8.35,.04,.05,timber);}
  // Small-cut pavers, stepped stone planters and varied botanical silhouettes.
  const rockGeo=new THREE.IcosahedronGeometry(1,1),leafGeo=new THREE.SphereGeometry(1,9,7),trunkMat=surface(r,'wood',0x766044,{repeat:[1,2],roughness:.95});
  const botanical=(x,z,size,variant)=>{
    const plant=r.group(scenery,x,-.77,z);plant.scale.setScalar(size);
    r.cylinder(plant,0,0,0,.49,.43,.27,stoneDark,12);r.cylinder(plant,0,.13,0,.49,.49,.045,stone,12);r.cylinder(plant,0,.158,0,.4,.4,.025,surface(r,'sand',0x594c36,{repeat:[2,2]}),12);
    if(variant===0){
      const stem=r.cylinder(plant,0,.69,0,.055,.095,1.08,trunkMat,7);stem.rotation.z=.1;
      for(let j=0;j<5;j++){const a=j*2.4,branch=r.cylinder(plant,Math.cos(a)*.13,1+j*.035,Math.sin(a)*.13,.026,.045,.55,trunkMat,6);branch.rotation.z=Math.cos(a)*.62;branch.rotation.x=Math.sin(a)*.62;const crown=r.mesh(rockGeo,[leafDark,leafMid,leafLight][j%3],plant);crown.position.set(Math.cos(a)*.29,1.32+(j%2)*.22,Math.sin(a)*.27);crown.scale.set(.49,.5,.43);}
    }else if(variant===1){
      r.cylinder(plant,0,.6,0,.06,.08,.94,trunkMat,7);
      for(let j=0;j<3;j++){const crown=r.mesh(leafGeo,j%2?leafLight:leafMid,plant);crown.position.y=.58+j*.42;crown.scale.set(.48-j*.09,.36,.46-j*.08);}
    }else{
      for(let j=0;j<11;j++){const a=j*2.4,leaf=r.mesh(leafGeo,j%3?leafMid:leafLight,plant);leaf.position.set(Math.cos(a)*.25,.37+(.5-j%3*.11),Math.sin(a)*.25);leaf.scale.set(.09,.53-j%3*.06,.15);leaf.rotation.z=-Math.cos(a)*.62;leaf.rotation.x=Math.sin(a)*.62;}
    }
  };
  for(let i=0;i<8;i++){const side=i%2?1:-1,x=side*(5.05+(i%3)*.17),z=-4.9+Math.floor(i/2)*3.03;botanical(x,z,.74+(i%3)*.12,i%3);}
  for(const side of [-1,1])for(let i=0;i<13;i++){const z=-5.5+i*.91;softBox(r,scenery,side*4.6,-.905,z,.44,.1,.63,i%3?stone:stoneDark,.06);}
  for(let i=0;i<32;i++){const a=i*2.4,x=(i%2?1:-1)*(4.92+(i%4)*.24),z=-5.7+Math.floor(i/2)*.77,rock=r.mesh(rockGeo,i%3?stone:stoneDark,scenery);rock.position.set(x,-.91,z);rock.rotation.set(a,a*.4,0);rock.scale.set(.13+i%3*.035,.1,.18);}
  // Slatted benches with cast legs, plus tiny terracotta beds of flowering plants.
  const iron=surface(r,'metal',0x53685a,{roughness:.65,metalness:.35}),terracotta=surface(r,'ceramic',0xaf7358,{roughness:.78,repeat:[3,1]}),flowerMats=[r.mat(0xe1ac67,{roughness:.8}),r.mat(0xd89b91,{roughness:.8}),r.mat(0xefdd9d,{roughness:.8})];
  for(const x of [-2.7,2.7]){for(let j=0;j<4;j++){softBox(r,scenery,x,-.64,6.18+j*.12,1.55,.065,.094,oak,.02);softBox(r,scenery,x,-.38+j*.08,6.67,1.55,.05,.07,timber,.015);}for(const dx of [-.57,.57]){r.box(scenery,x+dx,-.87,6.37,.065,.4,.44,iron);r.box(scenery,x+dx,-.55,6.66,.06,.65,.07,iron);}}
  const petalGeo=new THREE.IcosahedronGeometry(.076,0),stemGeo=new THREE.CylinderGeometry(.012,.017,.27,5);
  for(const side of [-1,1]){softBox(r,scenery,side*2.6,-.78,-6.2,2.8,.32,.65,terracotta,.08);softBox(r,scenery,side*2.6,-.606,-6.2,2.6,.018,.47,surface(r,'sand',0x6b5940),.006);for(let i=0;i<10;i++){const x=side*2.6-1.11+i*.247,z=-6.2+Math.sin(i*1.6)*.13;const stem=r.mesh(stemGeo,leafDark,scenery);stem.position.set(x,-.48,z);for(let j=0;j<3;j++){const f=r.mesh(petalGeo,flowerMats[i%3],scenery);f.position.set(x+Math.cos(j*TAU/3)*.055,-.31+(i%2)*.04,z+Math.sin(j*TAU/3)*.055);}const leaf=r.mesh(leafGeo,leafMid,scenery);leaf.position.set(x+.055,-.49,z);leaf.scale.set(.11,.035,.055);}}
  // A carved brass course crest and flush corner inlays finish the plinth.
  r.cylinder(scenery,0,.445,5.55,.24,.24,.026,brass,24);r.ring(scenery,0,.462,5.55,.17,.012,stoneDark);r.box(scenery,0,.474,5.55,.06,.017,.2,stoneDark);
  r.mergeStatic(scenery);
  g.blocks=[];for(let i=0;i<5;i++){const block=r.group();softBox(r,block,0,.245,0,1,.49,1,surface(r,'stone',0xb2b69a,{repeat:[2,2],bumpScale:.045}),.07);softBox(r,block,0,.519,0,1.035,.075,1.035,oak,.028);r.box(block,0,.562,0,.82,.012,.035,brass);for(const side of [-1,1])r.box(block,side*.39,.246,.503,.065,.37,.016,timber);block.visible=false;g.blocks.push(block);}
  g.sand=pools(r,3,roundedBox(1,1,1,.1,3),surface(r,'sand',0xd6bd8a,{repeat:[5,5],roughness:.98,bumpScale:.045}));g.sand.forEach(o=>o.castShadow=false);
  g.sandSpecks=pools(r,30,new THREE.CircleGeometry(.035,5),r.mat(0xbba476));g.sandSpecks.forEach(q=>{q.rotation.x=-Math.PI/2;q.castShadow=false;});
  g.ramps=pools(r,2,mountainGeometry(),surface(r,'turf',0x83a267,{repeat:[4,4],bumpScale:.06,roughness:.95}));
  g.rampTicks=pools(r,14,new THREE.SphereGeometry(.038,6,4),r.mat(0xeaf4bc));g.rampTicks.forEach(q=>q.castShadow=false);
  g.cup=r.group();const inner=r.cylinder(g.cup,0,.012,0,.255,.255,.018,0x172e2a,40);inner.castShadow=false;r.ring(g.cup,0,.023,0,.26,.026,0xddecc4);r.ring(g.cup,0,.026,0,.35,.014,0xbee0a7);
  g.flag=r.group();r.cylinder(g.flag,0,.95,0,.022,.025,1.9,0xefe9c9,10);r.cylinder(g.flag,0,.09,0,.053,.07,.16,0x748a61,12);r.sphere(g.flag,0,1.96,0,.057,0xe6bd5a);const flagGeo=new THREE.PlaneGeometry(.67,.42,6,3);g.flagCloth=r.mesh(flagGeo,surface(r,'fabric',0xcf7755,{side:THREE.DoubleSide,roughness:.85,repeat:[2,1],bumpScale:.025}),g.flag);g.flagCloth.position.set(.35,1.7,0);g.flagCloth.userData.base=new Float32Array(flagGeo.attributes.position.array);r.box(g.flag,.22,1.7,.01,.085,.25,.012,0xffe8b0);r.box(g.flag,.35,1.7,.01,.085,.25,.012,0xffe8b0);
  g.ball=r.group();g.ballBody=r.sphere(g.ball,0,0,0,.16,surface(r,'ceramic',0xfffdf3,{roughness:.28,metalness:.03,repeat:[3,2],bumpScale:.018}));const logo=r.sphere(g.ball,0,.13,.075,.042,0xf78d6b);logo.scale.z=.3;g.ballShadow=r.mesh(new THREE.CircleGeometry(.2,24),r.mat(0x286d54,{transparent:true,opacity:.25,depthWrite:false}));g.ballShadow.rotation.x=-Math.PI/2;g.ballShadow.castShadow=false;
  g.selection=r.ring(r.scene,0,.017,0,.31,.018,0xf8ecc0);g.selection.castShadow=false;
  g.aim=pools(r,42,new THREE.SphereGeometry(.047,7,5),glowMat(r,0xfff4c0,.17));g.aim.forEach(q=>q.castShadow=false);
  g.power=pools(r,20,new THREE.SphereGeometry(.034,6,4),r.mat(0xf9da82));g.power.forEach(q=>q.castShadow=false);
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0],3));g.pullLine=new THREE.Line(lineGeo,new THREE.LineDashedMaterial({color:0xec8566,dashSize:.1,gapSize:.08,transparent:true,opacity:.9}));r.scene.add(g.pullLine);
  g.putter=r.group();softBox(r,g.putter,0,.12,0,.55,.16,.13,surface(r,'metal',0xc7d4cf,{metalness:.8,roughness:.24}),.04);r.cylinder(g.putter,.16,.68,0,.019,.019,1.12,0x72958c,9);r.cylinder(g.putter,.16,1.23,0,.035,.035,.26,0x4c7362,9);
  g.burst=makeBurst(r,[0xffc887,0xeff7d4,0x8cf0bf,0xf59b91],42);
  g.ripples=pools(r,4,new THREE.TorusGeometry(.32,.018,6,40),r.mat(0xfff4c4,{transparent:true,opacity:.65,depthWrite:false}));g.ripples.forEach(q=>{q.rotation.x=Math.PI/2;q.castShadow=false;q.userData.born=-100;});
  r.camera.position.set(8.5,16.5,15.4);r.camera.lookAt(0,-.1,0);r.sun.position.set(-8,17,6);r.sun.color.setHex(0xffead0);r.sun.intensity=2.15;
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
  r.scene.background=new THREE.Color(0x273d3e);r.scene.fog=new THREE.Fog(0x273d3e,28,65);r.sun.intensity=2.1;r.sun.position.set(-7,14,4);r.sun.color.setHex(0xffebd4);
  const g=r.breaker={lastEvent:0};const architecture=r.group();
  const enamel=surface(r,'ceramic',0xd5d1b9,{repeat:[3,3],roughness:.34,metalness:.14,bumpScale:.022}),enamelDark=surface(r,'ceramic',0x3e6260,{repeat:[2,5],roughness:.4,metalness:.3}),brass=surface(r,'metal',0xb99762,{repeat:[2,6],roughness:.36,metalness:.77}),steel=surface(r,'metal',0x879590,{repeat:[2,5],roughness:.34,metalness:.78}),rubber=surface(r,'fabric',0x273d3d,{repeat:[5,5],roughness:.85}),ink=r.mat(0x2a4242,{roughness:.87}),mutedInk=r.mat(0x567475,{roughness:.72}),signal=glowMat(r,0xdfa34f,.36),cyan=glowMat(r,0x82d2cc,.42);
  // A 1970s instrument cabinet: rounded enamel shell, warm anodized rails,
  // timber cheeks and a silk-screened recessed playing surface.
  r.box(architecture,0,-1.16,0,150,.35,150,surface(r,'stone',0x344847,{repeat:[70,70],roughness:.93}));
  slab(r,architecture,10.65,13.6,.35,rubber,-.88,.1);slab(r,architecture,10.42,13.36,.28,enamelDark,-.49,.08);slab(r,architecture,10.14,13.08,.14,enamel,-.18,.06);
  softBox(r,architecture,0,-.004,-.05,9.02,.085,11.68,surface(r,'circuit',0x203a39,{repeat:[3,4],roughness:.65,metalness:.16,bumpScale:.015}),.13);
  // Sparse court markings give the ball room to read; small technical indexes
  // replace the visual noise of a fully luminous grid.
  for(const x of [-3,-1.5,0,1.5,3])for(let j=0;j<8;j++)r.box(architecture,x,.043,-4.7+j*1.34,.018,.006,.08,mutedInk);
  for(const x of [-3.7,3.7]){r.box(architecture,x,.043,-.15,.028,.007,10.2,mutedInk);for(let i=0;i<21;i++)r.box(architecture,x+Math.sign(x)*.095,.048,-5.1+i*.49,i%5===0?.2:.095,.008,.02,i%5===0?brass:mutedInk);}
  const centerLine=r.mesh(new THREE.RingGeometry(.91,.927,48),mutedInk,architecture);centerLine.rotation.x=-Math.PI/2;centerLine.position.set(0,.046,.1);centerLine.castShadow=false;
  r.box(architecture,0,.049,.1,.48,.008,.022,mutedInk);r.box(architecture,0,.05,.1,.022,.008,.48,mutedInk);
  for(const side of [-1,1]){
    softBox(r,architecture,side*4.74,.2,-.13,.49,.48,12.05,enamelDark,.11);softBox(r,architecture,side*4.78,.463,-.13,.3,.08,11.85,brass,.035);
    softBox(r,architecture,side*4.524,.22,-.13,.065,.21,11.79,rubber,.02);r.box(architecture,side*4.485,.257,-.13,.025,.055,11.71,cyan);
    softBox(r,architecture,side*5.105,-.31,-.13,.18,.42,11.94,surface(r,'wood',0x825f42,{repeat:[1,6],roughness:.57}),.06);
    for(let j=0;j<8;j++){const z=-5.12+j*1.47;softBox(r,architecture,side*4.76,.506,z,.4,.05,.52,enamel,.02);r.cylinder(architecture,side*4.76,.54,z-.14,.032,.032,.012,steel,8);r.box(architecture,side*4.76,.54,z+.03,.21,.012,.075,j%2?signal:ink);}
  }
  softBox(r,architecture,0,.22,-5.82,9.72,.46,.48,enamelDark,.09);softBox(r,architecture,0,.48,-5.83,9.55,.07,.31,brass,.026);softBox(r,architecture,0,.255,-5.56,8.95,.12,.055,rubber,.02);r.box(architecture,0,.325,-5.524,8.95,.024,.018,cyan);
  // Grille holes, fasteners and a center analog status panel are physical details.
  softBox(r,architecture,0,.145,-6.36,9.64,.31,.53,enamel,.075);
  for(const side of [-1,1])for(let i=0;i<7;i++)for(let j=0;j<3;j++)r.cylinder(architecture,side*(2.46+i*.23),.309,-6.36+(j-1)*.105,.024,.024,.007,ink,6);
  softBox(r,architecture,0,.315,-6.35,3.09,.06,.39,ink,.02);
  for(let i=0;i<3;i++){const x=-.95+i*.95;r.cylinder(architecture,x,.36,-6.35,.151,.151,.034,brass,20);r.cylinder(architecture,x,.381,-6.35,.122,.122,.016,enamel,20);const needle=r.box(architecture,x,.394,-6.34,.018,.012,.15,ink);needle.rotation.y=-.65+i*.63;}
  for(const x of [-4.88,4.88])for(const z of [-6.3,6.3]){r.cylinder(architecture,x,.031,z,.09,.09,.028,steel,12);r.box(architecture,x,.05,z,.1,.012,.02,ink);}
  softBox(r,architecture,0,.015,6.15,9.65,.13,.62,enamel,.065);for(let i=0;i<22;i++){const x=-4.28+i*.405;const hatch=r.box(architecture,x,.087,5.94,.22,.012,.16,i%2?brass:ink);hatch.rotation.y=-.55;}
  // Recessed lower vents and knurled front feet give the table a readable depth.
  for(const side of [-1,1]){softBox(r,architecture,side*2.8,-.135,6.525,2.9,.22,.044,ink,.01);for(let i=0;i<13;i++)r.box(architecture,side*2.8-.126*6+i*.126,-.13,6.556,.039,.14,.026,steel);r.cylinder(architecture,side*4.58,-.83,5.8,.22,.29,.24,rubber,14);r.cylinder(architecture,side*4.58,-.64,5.8,.17,.22,.2,steel,14);}
  // A simple geometric marquee is inset, rather than floating neon decoration.
  softBox(r,architecture,0,.09,6.23,1.34,.08,.32,enamelDark,.03);for(let i=0;i<4;i++)r.box(architecture,-.37+i*.245,.136,6.23,.12,.015,.15,i<3?signal:ink);
  r.mergeStatic(architecture);
  // Chrome-edged paddle with a rubber impact bumper and an ivory control insert.
  g.paddle=r.group();g.paddleCore=softBox(r,g.paddle,0,.27,0,1,.4,.4,steel,.095);g.paddleTop=softBox(r,g.paddle,0,.489,0,.88,.055,.29,enamelDark,.023);g.paddleGlow=softBox(r,g.paddle,0,.078,0,1.13,.018,.53,glowMat(r,0x91d9cc,.3,.11),.007);g.paddleGlow.castShadow=false;
  g.paddleEnds=[];for(const side of [-1,1]){const end=r.group(g.paddle);softBox(r,end,0,.285,0,.17,.46,.47,rubber,.065);softBox(r,end,0,.528,0,.135,.032,.32,brass,.012);r.cylinder(end,0,.553,0,.03,.03,.012,enamel,8);g.paddleEnds.push(end);}
  // Each target is a glazed, bevel-edged industrial key, with a dark socket,
  // a recessed legend strip and a removable cross-strap for armoured targets.
  g.bricks=[];const baseGeo=roundedBox(1.14,.17,.61,.048,2),bodyGeo=roundedBox(1.1,.46,.56,.075,2),capGeo=roundedBox(.91,.02,.058,.009,1),insetGeo=roundedBox(.82,.016,.19,.007,1),armorGeo=roundedBox(.13,.045,.5,.018,2),brickMats=brickColors.map(c=>surface(r,'ceramic',c,{repeat:[2,1],metalness:.12,roughness:.32,bumpScale:.022})),trimMats=brickColors.map(c=>surface(r,'metal',new THREE.Color(c).multiplyScalar(.68).getHex(),{repeat:[2,1],metalness:.55,roughness:.35})),shadowMaterial=rubber,armorMaterial=brass,legendMaterial=surface(r,'ceramic',0xe2dcc1,{repeat:[2,1],roughness:.46});
  for(let i=0;i<42;i++){const q=r.group();const base=r.mesh(baseGeo,shadowMaterial,q);base.position.y=.115;const body=r.mesh(bodyGeo,brickMats[i%5],q);body.position.y=.37;const cap=r.mesh(capGeo,trimMats[i%5],q);cap.position.set(0,.613,-.159);const inset=r.mesh(insetGeo,legendMaterial,q);inset.position.set(0,.609,.045);const armor=r.mesh(armorGeo,armorMaterial,q);armor.position.set(0,.642,0);q.visible=false;g.bricks.push({group:q,body,cap,armor,inset});}
  g.brickMats=brickMats;g.trimMats=trimMats;
  g.ball=r.sphere(r.scene,0,.29,0,.165,surface(r,'metal',0xf8fbeb,{metalness:.58,roughness:.19,emissive:0x8aa49b,emissiveIntensity:.2,bumpScale:.008}));g.ballRing=r.ring(r.scene,0,.055,0,.25,.012,0xa4cdbf);g.ballRing.castShadow=false;g.ballHalo=r.sphere(r.scene,0,.29,0,.23,glowMat(r,0xaccfc1,.45,.065));g.ballHalo.castShadow=false;
  // Two recycled companion balls make the multiball power-up visible while
  // keeping the scene graph strictly bounded.
  g.extraBalls=[0,1].map(()=>r.sphere(r.scene,0,.29,0,.145,glowMat(r,0xffe47a,.38)));
  g.trail=pools(r,16,new THREE.SphereGeometry(.12,9,6),glowMat(r,0x8bd6c9,.45,.25));g.trail.forEach(q=>q.castShadow=false);
  g.pickups=[];const diamond=new THREE.OctahedronGeometry(.25,0);for(let i=0;i<6;i++){const q=r.group();const body=pooledMesh(r,diamond,new THREE.MeshStandardMaterial({color:powerColors.wide,emissive:powerColors.wide,emissiveIntensity:.65,metalness:.2,roughness:.4}),q);const line=r.ring(q,0,0,0,.35,.018,0xe2f8ff);line.rotation.x=.8;const shadow=r.mesh(new THREE.CircleGeometry(.24,12),r.mat(0x3d8cad,{transparent:true,opacity:.25,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;q.visible=false;shadow.visible=false;g.pickups.push({group:q,body,line,shadow});}
  g.burst=makeBurst(r,brickColors,56);
  g.ripples=pools(r,8,new THREE.TorusGeometry(.24,.024,6,32),glowMat(r,0xd9e9c6,.3,.5));g.ripples.forEach(q=>{q.rotation.x=Math.PI/2;q.castShadow=false;q.userData.born=-100;});
  g.serveDots=pools(r,9,new THREE.SphereGeometry(.035,7,5),glowMat(r,0xa6cabc,.3));g.serveDots.forEach(q=>q.castShadow=false);
  g.floorGlow=r.mesh(new THREE.CircleGeometry(1.5,40),glowMat(r,0x82c5a8,.15,.024));g.floorGlow.rotation.x=-Math.PI/2;g.floorGlow.position.y=.051;g.floorGlow.castShadow=false;
  // Mild perspective in an orthographic projection keeps paddle tracking exact.
  r.camera.position.set(0,17,11.8);r.camera.lookAt(0,0,-.2);updateBreaker(r,m);
}
function updateBreaker(r,m){const g=r.breaker,t=r.lowMotion?0:m.time;g.paddle.position.set(m.paddle.x,0,m.paddle.z);g.paddleCore.scale.x=m.paddle.w;g.paddleTop.scale.x=m.paddle.w;g.paddleGlow.scale.x=m.paddle.w;g.paddleEnds.forEach((q,i)=>q.position.x=(i?1:-1)*m.paddle.w*.48);
  g.bricks.forEach((q,i)=>{const b=m.bricks[i];q.group.visible=!!b&&b.hp>0;if(!q.group.visible)return;q.group.position.set(b.x,b.hit*.35,b.z);q.group.scale.set(1+b.hit*.22,1-b.hit*.7,1+b.hit*.22);q.body.material=g.brickMats[b.color];q.cap.material=g.trimMats[b.color];q.armor.visible=b.hp>1;q.inset.visible=b.maxHp===1||b.hp>1;});
  const balls=m.balls||[m.ball],primary=balls[0];g.ball.visible=!!primary&&!m.dead&&!m.wavePause;if(primary){g.ball.position.set(primary.x,.28,primary.z);g.ball.material.color.setHex(m.power.fire>0?0xffc56e:0xf7fdff);g.ball.material.emissive.setHex(m.power.fire>0?0xff9b46:0xbcefff);g.ballHalo.position.copy(g.ball.position);g.ballRing.position.set(primary.x,.055,primary.z);}g.ballHalo.visible=g.ball.visible;g.ballHalo.material.color.setHex(m.power.fire>0?0xffa165:0x8ceaff);g.ballHalo.scale.setScalar(1+Math.sin(t*10)*.12);g.ballRing.visible=g.ball.visible;
  g.extraBalls.forEach((q,i)=>{const ball=balls[i+1];q.visible=!!ball&&!m.dead&&!m.wavePause;if(ball)q.position.set(ball.x,.28,ball.z);q.material.emissiveIntensity=.32+Math.sin(t*8+i)*.08;});
  g.trail.forEach((q,i)=>{q.visible=!r.lowMotion&&!m.serving&&!m.dead&&!m.wavePause&&i<m.trail.length;if(q.visible){const p=m.trail[i];q.position.set(p.x,.265,p.z);q.scale.setScalar(1-i/17);q.material.color.setHex(m.power.fire>0?0xff9e62:0x76e6ff);}});
  g.pickups.forEach((q,i)=>{const p=m.pickups[i];q.group.visible=q.shadow.visible=!!p;if(p){q.group.position.set(p.x,.48+Math.sin(t*5+p.phase)*.09,p.z);q.group.rotation.y=t*2+p.phase;q.body.rotation.z=t+p.phase;q.body.material.color.setHex(powerColors[p.kind]);q.body.material.emissive.setHex(powerColors[p.kind]);q.line.rotation.y=t*1.7;q.shadow.position.set(p.x,.049,p.z);}});
  g.serveDots.forEach((q,i)=>{q.visible=!!m.serving&&!m.dead&&!m.wavePause;if(q.visible)q.position.set(m.ball.x+Math.sin(.22*Math.sin(m.wave*1.7+m.attempt))*i*.26,.09,m.ball.z-.45-i*.26);});
  g.floorGlow.position.set(m.paddle.x,.051,m.paddle.z-.08);g.floorGlow.scale.set(m.paddle.w,1,1);
  for(const e of m.events){if(e.id<=g.lastEvent)continue;g.lastEvent=e.id;if(e.type==='brick'||e.type==='armor'||e.type==='power')burst(g.burst,m.time,e.x,e.z,e.id,e.type==='armor'?.45:1.6,.47);if(['paddle','wall','loss','launch'].includes(e.type)){const q=g.ripples[e.id%g.ripples.length];q.userData.born=m.time;q.position.set(e.x,.05,e.z);}if(e.type==='clear')for(let i=0;i<4;i++)burst(g.burst,m.time,-3+i*2,-2,i,2.4,.7);}
  g.ripples.forEach(q=>{const age=m.time-q.userData.born;q.visible=!r.lowMotion&&age>=0&&age<.4;if(q.visible)q.scale.setScalar(.3+age*3);});updateBurst(g.burst,m.time,r.lowMotion);
}

export const GAME_RENDERERS={
  golf:{build:buildGolf,update:updateGolf,height:aspect=>Math.max(16.8,12.7/Math.max(.35,aspect))},
  breaker:{build:buildBreaker,update:updateBreaker,height:aspect=>Math.max(14.2,11.2/Math.max(.35,aspect))}
};
