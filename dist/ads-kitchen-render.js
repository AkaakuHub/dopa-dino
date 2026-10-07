import * as THREE from './vendor/three.module.min.js';
import { surface } from './ads-visuals.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const stationColor={crate:0x9a6c45,board:0xd3a168,pot:0x657b8a,pass:0xd9aa5e};
const kitchen={
  height:aspect=>aspect<.8?15.6:13.2,
  world(r,x,y){if(!r.camera)return{x:0,z:0};r.ray.setFromCamera(new THREE.Vector2(x/r.w*2-1,1-y/r.h*2),r.camera);if(r.ray.ray.intersectPlane(r.groundPlane,r.hit))return{x:r.hit.x,z:r.hit.z};return{x:0,z:0};},
  build(r,m){
    r.scene.background=new THREE.Color(0x23384b);r.scene.fog=new THREE.Fog(0x23384b,24,48);r.sun.position.set(-7,15,8);r.sun.intensity=2.1;r.sun.color.setHex(0xffe4bc);
    const arch=r.group(),floor=surface(r,'stone',0x526678,{repeat:[24,24]}),counter=surface(r,'wood',0x8d6346,{repeat:[3,2]}),enamel=surface(r,'ceramic',0xb7c8ca,{repeat:[3,3]});r.box(arch,0,-.34,0,140,.55,140,floor);r.box(arch,0,-.045,0,11,.08,11,enamel);
    // Cabin kitchen counter and four readable stations.
    r.box(arch,0,.18,-3.8,10,.36,1.1,counter);r.box(arch,0,.42,-3.8,9.7,.14,.92,counter);
    r.box(arch,-4,.18,2,1.45,.36,1.35,stationColor.crate);r.box(arch,-1.8,.18,-2.8,1.55,.36,1.25,stationColor.board);
    r.box(arch,2.1,.2,-2.8,1.45,.4,1.35,stationColor.pot);r.box(arch,4,.18,2,1.55,.36,1.35,stationColor.pass);
    for(let i=0;i<9;i++){const x=-4.8+i*1.2;r.box(arch,x,.01,4.9,.7,.04,.12,i%2?0xffd77f:0x90b7cb);}
    for(const p of [[-5,-5],[5,-5],[-5,5],[5,5]]){const tree=r.group(arch,p[0],0,p[1]);r.cylinder(tree,0,.65,0,.11,.15,1.3,0x6c4c39,8);r.sphere(tree,0,1.45,0,.55,0x568774);r.sphere(tree,.22,1.7,.1,.39,0x7ca77e);}
    r.mergeStatic(arch);
    const g=r.kitchen={lastEvent:0};g.stationRings=[];for(const s of m.stations){const q=r.ring(r.scene,s.x,.06,s.z,.82,.045,0xffe4a4);q.visible=false;g.stationRings.push(q);}
    g.player=r.group();r.cylinder(g.player,0,.44,0,.27,.29,.6,0xe78643,12);r.sphere(g.player,0,.92,0,.24,0xf4c0a3);r.box(g.player,0,.98,.03,.43,.13,.36,0xcce4ef);
    g.carry=r.group(g.player);r.box(g.carry,0,.55,.27,.34,.24,.3,0xffcf6f);g.carry.visible=false;
    g.orders=[];for(let i=0;i<3;i++){const plate=r.group(r.scene,-3.5+i*3.5,1.05,-4.55);r.cylinder(plate,0,0,0,.47,.47,.07,0xd9e6e9,24);r.sphere(plate,0,.12,0,.24,[0xe5a85d,0xbd8ce8,0x86d2aa][i],{emissive:[0xe5a85d,0xbd8ce8,0x86d2aa][i],emissiveIntensity:.25});g.orders.push(plate);}
    g.burst=[];const geo=new THREE.IcosahedronGeometry(.08,0);for(let i=0;i<18;i++){const q=r.mesh(geo,i%2?0xffd268:0xff8c5c);q.visible=false;q.userData={born:-10};g.burst.push(q);}
    r.camera.position.set(8.5,13.8,13.2);r.camera.lookAt(0,0,0);
  },
  update(r,m){
    const g=r.kitchen,t=r.lowMotion?0:m.time;g.player.position.set(m.player.x,0,m.player.z);g.player.rotation.y=Math.atan2(m.player.x-(m.player.target?.x??m.player.x),m.player.z-(m.player.target?.z??m.player.z));g.carry.visible=!!m.carry;g.carry.rotation.y=t*1.5;
    for(let i=0;i<g.stationRings.length;i++){const s=m.stations[i],q=g.stationRings[i];const near=m.nearest?.();q.visible=!!near&&near.id===s.id;q.position.set(s.x,.06,s.z);q.scale.setScalar(1+Math.sin(t*4)*.04);}
    for(let i=0;i<g.orders.length;i++){const order=m.orders[i];g.orders[i].visible=!order.served;g.orders[i].scale.setScalar(order.served?.2:1+Math.sin(t*3+i)*.035);}
    for(const e of m.events){if(e.id<=g.lastEvent)continue;g.lastEvent=e.id;if(['serve','chop','cook','pickup'].includes(e.type)){for(let i=0;i<5;i++){const q=g.burst[(e.id*3+i)%g.burst.length];q.userData={born:m.time,x:m.player.x,z:m.player.z,a:i*1.7,s:.5+(i%3)*.2};q.visible=true;}}}
    for(const q of g.burst){const d=q.userData,age=m.time-d.born;q.visible=!r.lowMotion&&age>=0&&age<.55;if(q.visible){q.position.set((d.x||0)+Math.cos(d.a)*d.s*age,.4+age*1.2-2*age*age,(d.z||0)+Math.sin(d.a)*d.s*age);q.scale.setScalar(1-age);}}
    r.camera.position.set(m.player.x+8.5,13.8,m.player.z+13.2);r.camera.lookAt(m.player.x,0,m.player.z);
  }
};

export const GAME_RENDERERS={kitchen:kitchen};

