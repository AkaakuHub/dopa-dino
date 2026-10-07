import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.min.js';
import {AdRenderer} from './dist/ads-render.js';
import {GAME_META,GAME_MODELS,PocketGolf,NeonBreaker} from './dist/ads-golf-breaker.js';
import {GAME_RENDERERS} from './dist/ads-golf-breaker-render.js';
const advance=(m,seconds)=>{for(let t=0;t<seconds;t+=1/120)m.update(1/120);};
assert.deepEqual(GAME_META.map(g=>g.id),['golf','breaker']);
for(const id of ['golf','breaker']){const m=new GAME_MODELS[id]();assert(m.keys instanceof Set);assert.equal(m.stats.length,3);assert(m.stats.every(x=>Array.isArray(x)&&x.length===2));assert.equal(typeof m.message,'string');}
{
 const g=new PocketGolf();const b={...g.ball};g.pointerDown(0,0,b);g.pointerMove(0,0,{x:b.x,z:b.z+2});assert(g.dragging);assert(g.power>.6);assert(Math.abs(g.aim)<1e-9);assert(g.aimPath().length>10);g.pointerUp(0,0,{x:b.x,z:b.z+2});assert.equal(g.strokes,1);assert(g.ball.vz<0);assert(g.speed>6);const start=g.ball.z;advance(g,.3);assert(g.ball.z<start);assert(!g.shoot(),'cannot hit moving ball');advance(g,10);assert(g.canShoot);
 const strokes=g.strokes;g.pointerDown(0,0,{...g.ball});g.pointerMove(0,0,{x:g.ball.x-2,z:g.ball.z});g.pointerCancel();g.pointerUp();assert.equal(g.strokes,strokes);assert(!g.dragging);
 const aim=g.aim,power=g.power;g.keys.add('ArrowRight');g.keys.add('ArrowUp');advance(g,.3);g.keys.clear();assert(g.aim>aim);assert(g.power>power);g.action('Space');assert.equal(g.strokes,strokes+1);
 const wall=new PocketGolf();wall.ball={x:3.58,z:3.5,vx:8,vz:0};wall.strokes=1;advance(wall,.06);assert(wall.ball.vx<0,'rail banks reverse horizontal velocity');assert(wall.ball.x<=3.64);
 const obstacle=new PocketGolf();obstacle.ball={x:0,z:.22,vx:0,vz:-7};obstacle.strokes=1;advance(obstacle,.04);assert(obstacle.ball.vz>0,'course block banks the shot');
 const grass=new PocketGolf(),sand=new PocketGolf();grass.ball={x:-2,z:2,vx:0,vz:.2};sand.ball={x:2.35,z:1.35,vx:1,vz:0};grass.ball.vx=1;grass.ball.vz=0;advance(grass,.1);advance(sand,.1);assert(sand.speed<grass.speed*.8,'sand meaningfully slows a shot');
 const hill=new PocketGolf();hill.holeNumber=3;hill.makeHole();assert(hill.terrainAt(0,-.65).height>.55);assert(hill.terrainAt(0,-1.5).slope>0);assert(hill.terrainAt(0,.2).slope<0);
 const sinking=new PocketGolf();sinking.ball={x:sinking.cup.x,z:sinking.cup.z+.24,vx:0,vz:-.4};sinking.strokes=2;advance(sinking,.04);assert(sinking.sinking>0);assert.equal(sinking.score,0);advance(sinking,1);assert.equal(sinking.holeNumber,2);assert.equal(sinking.strokes,0);assert.equal(sinking.totalStrokes,2);
 const fast=new PocketGolf();fast.ball={x:fast.cup.x,z:fast.cup.z+.4,vx:0,vz:-9};fast.strokes=1;advance(fast,.05);assert.equal(fast.sinking,0,'overhit putts do not teleport into cup');
 const layouts=new Set();for(let i=1;i<=60;i++){sinking.holeNumber=i;sinking.makeHole();layouts.add(JSON.stringify([sinking.ball.x,sinking.blocks,sinking.ramps]));assert(sinking.blocks.length<=5);assert(sinking.ramps.length<=2);sinking.strokes=sinking.par;sinking.ball.x=sinking.cup.x;sinking.ball.z=sinking.cup.z;sinking.update(.02);advance(sinking,1);}assert(layouts.size>=12);assert(sinking.events.length<=18);
 console.log('PASS Golf: drag, power, cancellation, keyboard aim/shoot, banks, obstacles, sand, ramp slopes, cup speed limit, scoring, endless varied holes');
}
{
 const b=new NeonBreaker();assert(b.serving>0);advance(b,1.2);assert.equal(b.serving,0);assert(b.ball.vz<0);b.pointerMove(1,0,{x:4});advance(b,.5);assert(b.paddle.x>3);b.keys.add('ArrowLeft');advance(b,.5);b.keys.clear();assert(b.paddle.x<0);b.prepareBall();b.action('Space');assert.equal(b.serving,0);
 b.ball={x:4.32,z:1,vx:6,vz:-2,r:.16};b.update(.03);assert(b.ball.vx<0,'side wall ricochet');
 b.paddle.x=b.paddle.target=0;b.ball={x:.7,z:4.57,vx:0,vz:7,r:.16};b.update(.025);assert(b.ball.vz<0);assert(b.ball.vx>0,'edge paddle rebound controls angle');
 const brick=[...b.bricks].reverse().find(q=>q.hp===1);b.ball={x:brick.x,z:brick.z+brick.d/2+.19,vx:0,vz:-7,r:.16};b.update(.03);assert.equal(brick.hp,0);assert(b.score>0);assert(b.ball.vz>0);assert(b.events.some(e=>e.type==='brick'));
 for(const kind of ['wide','fire','slow']){b.collect({kind,x:0,z:4.8});assert(b.power[kind]>0);}b.update(.02);assert.equal(b.paddle.w,3);const slower=b.baseSpeed();b.power.slow=0;assert(b.baseSpeed()>slower);b.power.wide=.01;b.update(.02);assert.equal(b.paddle.w,1.9);
 b.pickups=[{kind:'wide',x:b.paddle.x,z:4.8,phase:0}];b.update(.02);assert.equal(b.pickups.length,0);assert(b.power.wide>10);
 const before=b.wave;b.bricks.forEach(q=>q.hp=0);b.destroyed=b.waveBricks;b.ball={x:0,z:0,vx:1,vz:-6,r:.16};b.update(.02);assert(b.wavePause>0);advance(b,1.3);assert.equal(b.wave,before+1);assert(b.bricks.some(q=>q.hp===2));assert(b.bricks.length<=42);
 const formations=new Set();for(let i=1;i<50;i++){b.wave=i;b.makeWave();formations.add(JSON.stringify(b.bricks.map(q=>[q.x,q.z])));assert(b.bricks.length<=42);}assert(formations.size>=6);
 b.lives=1;b.serving=0;b.ball={x:0,z:6.09,vx:0,vz:8,r:.16};b.update(.02);assert(b.dead>0);assert.equal(b.lives,0);advance(b,1.4);assert.equal(b.lives,3);assert.equal(b.wave,1);assert.equal(b.attempt,2);
 // A simple human-like tracker should sustain play, break real bricks and reach later waves.
 const play=new NeonBreaker();for(let i=0;i<120*180;i++){play.paddle.target=clamp(play.ball.x+Math.sin(i*.011)*.38,-3.55,3.55);play.update(1/120);}assert(play.eventId>100);assert(play.best>0||play.score>0);assert(play.events.length<=22);assert(play.pickups.length<=6);assert(play.trail.length<=16);assert(Number.isFinite(play.ball.x)&&Number.isFinite(play.ball.z));
 console.log(`PASS Breaker: pointer/keyboard paddle, auto/manual serve, ricochets, paddle angles, brick destruction, powers, waves, lives/restart, 180-second play test (wave ${play.wave}, score ${play.score})`);
}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
for(const [width,height] of [[1440,900],[390,844]])for(const id of ['golf','breaker']){
 const canvas={dataset:{},getBoundingClientRect:()=>({width,height})};const r=new AdRenderer(canvas),m=new GAME_MODELS[id]();r.scene=new THREE.Scene();r.camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,120);r.lights(id);const impl=GAME_RENDERERS[id];impl.build(r,m);const h=impl.height(width/height);r.camera.left=-h*width/height/2;r.camera.right=h*width/height/2;r.camera.top=h/2;r.camera.bottom=-h/2;r.camera.updateProjectionMatrix();r.camera.updateMatrixWorld();r.w=width;r.h=height;
 const inventory=()=>{const geos=new Set(),mats=new Set();let meshes=0,triangles=0;r.scene.traverse(q=>{if(q.geometry){geos.add(q.geometry);assert(q.geometry.attributes.position.count>0);}if(q.material)(Array.isArray(q.material)?q.material:[q.material]).forEach(x=>mats.add(x));if(q.isMesh){meshes++;triangles+=(q.geometry.index?.count??q.geometry.attributes.position.count)/3;}});return {geos,mats,meshes,triangles};};const initial=inventory();assert(initial.meshes<430);assert(initial.triangles<95000);
 for(const [x,z] of [[0,0],[-3,4],[3,-4]]){const p=r.p(x,z),q=r.world(p.x,p.y);assert(Math.abs(q.x-x)<1e-6&&Math.abs(q.z-z)<1e-6,'orthographic pointer inverse');assert(p.x>0&&p.x<width&&p.y>0&&p.y<height,'playfield visible at portrait and desktop aspect ratios');}
 for(let i=0;i<90;i++){if(id==='golf'){m.holeNumber=i+1;m.makeHole();m.emit('cup',{x:m.cup.x,z:m.cup.z});}else{m.wave=i+1;m.makeWave();m.emit('brick',{x:0,z:0,color:i%5});}m.update(.016);impl.update(r,m);}const last=inventory();assert.equal(last.geos.size,initial.geos.size);assert.equal(last.mats.size,initial.mats.size);assert.equal(last.meshes,initial.meshes);
 r.lowMotion=true;impl.update(r,m);assert((id==='golf'?r.golf.burst:r.breaker.burst).every(q=>!q.visible));let disposedGeo=0,disposedMat=0;last.geos.forEach(q=>q.addEventListener('dispose',()=>disposedGeo++));last.mats.forEach(q=>q.addEventListener('dispose',()=>disposedMat++));r.disposeScene();assert.equal(disposedGeo,last.geos.size);assert.equal(disposedMat,last.mats.size);assert.equal(r.cache.size,0);
 console.log(`PASS ${id} ${width}×${height}: ${initial.meshes} meshes / ${Math.round(initial.triangles)} triangles, fixed resources over 90 layouts, camera/pointer, reduced motion, disposal`);
}
console.log('Scene graph tests validate model/geometry lifecycle; browser pixels and GPU performance require separate QA.');
