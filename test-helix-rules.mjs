import assert from 'node:assert/strict';
import {AD_GAMES,AdShuffleBag,HelixTower,AdSession} from './dist/ads-engine.js';
import {AdRenderer} from './dist/ads-render.js';
const tau=2*Math.PI;
const at=(m,start)=>{m.rotation=Math.PI/2-start-.15};
const setRings=(m,mode)=>{m.rings=Array.from({length:24},()=>mode==='gap'?{gap:1,gapWidth:2,red:4}:{gap:3,gapWidth:1.5,red:1.4});m.rotation=0};
const step=(m,t,dt=1/120)=>{for(let left=t;left>1e-8;left-=dt)m.update(Math.min(dt,left));};
let m=new HelixTower();setRings(m,'gap');m.ball=-.2;m.velocity=2;
const v0=m.velocity;let priorFloor=m.floor,priorY=m.floor+m.ball,priorV=m.velocity,crossings=0;
for(let i=0;i<1000&&m.floor<3;i++){m.update(1/120);const y=m.floor+m.ball;assert(y>=priorY-1e-9,'continuous downward position');assert(m.velocity>=priorV,'gap must never brake velocity');if(m.floor!==priorFloor){crossings++;assert(y-priorY<.2,'gap crossing must not teleport');priorFloor=m.floor;}priorY=y;priorV=m.velocity;}
assert.equal(m.floor,3);assert.equal(crossings,3);assert(m.charged);assert(m.velocity>v0+3);assert.equal(m.streak,3);
setRings(m,'solid');m.ball=-.08;const speed=m.velocity,score=m.score;m.update(.05);assert.equal(m.floor,4);assert(m.broken.has(3));assert(!m.charged);assert.equal(m.streak,0);assert.equal(m.hits,0);assert(m.velocity>=speed,'charged smash keeps downward velocity');assert.equal(m.score,score+50);assert(m.events.some(e=>e.type==='smash'&&e.floor===3));
// The charge applies to one solid floor; another forbidden solid kills the attempt.
m.ball=-.01;m.update(.01);assert.equal(m.hits,1);assert(m.dead>0);const attempt=m.attempt;step(m,.7);assert.equal(m.attempt,attempt+1);assert.equal(m.depth,0);assert.equal(m.floor,0);assert.equal(m.score,0);assert(!m.charged);assert.equal(m.broken.size,0);
// A normal safe bounce breaks the fall combo, while two drops alone never smash.
m=new HelixTower();m.rings=[{gap:3,gapWidth:1.4,red:4.8}];m.streak=2;m.ball=-.001;m.velocity=6;m.update(.01);assert.equal(m.floor,0);assert.equal(m.streak,0);assert(m.velocity<0);assert(!m.dead);assert(!m.charged);assert.equal(m.events.at(-1).type,'bounce');
// High velocity still detects a red floor rather than tunnelling through it.
m=new HelixTower();setRings(m,'solid');m.velocity=22;m.ball=-.02;m.update(.05);assert.equal(m.floor,0);assert(m.dead);assert.equal(m.hits,1);
// Coarse and fine display frames agree on continuously aligned falling position.
const a=new HelixTower(),b=new HelixTower();for(const q of [a,b]){setRings(q,'gap');q.velocity=1;q.ball=-.3;}step(a,1,.05);step(b,1,1/120);assert.equal(a.floor,b.floor);assert(Math.abs((a.floor+a.ball)-(b.floor+b.ball))<1e-8);assert(Math.abs(a.velocity-b.velocity)<1e-8);
// Death freezes an explicit failure result without resetting or closing the five-second session.
const ad=new AdSession('helix');ad.elapsed=5.2;setRings(ad.model,'solid');ad.model.ball=0;ad.model.velocity=1;ad.update(.01);step(ad,2);assert(ad.ready);assert(!ad.closed);assert.equal(ad.model.attempt,1);assert.equal(ad.result.outcome,'failure');const frozen=ad.model.time;ad.update(.05);assert.equal(ad.model.time,frozen);
// Seeded bags visit all seven exactly once, including no repeats across every boundary.
const counts=Object.fromEntries(AD_GAMES.map(g=>[g.id,0]));
for(let seed=1;seed<=300;seed++){let state=Math.imul(seed,0x9e3779b9)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const bag=new AdShuffleBag(random);let last=null;for(let round=0;round<100;round++){const three=AD_GAMES.map(()=>bag.next());assert.equal(new Set(three).size,AD_GAMES.length);for(const k of three){assert.notEqual(k,last);last=k;}if(round===0)counts[three[0]]++;}}
assert(Object.values(counts).every(n=>n>8));for(const value of [0,.499999,.999999]){const bag=new AdShuffleBag(()=>value);let last;for(let i=0;i<1000;i++){const next=bag.next();assert(next);assert.notEqual(next,last);last=next;}}
// Actual destroyed floor meshes disappear and produce bounded moving platform fragments.
m=new HelixTower();const r=new AdRenderer({dataset:{},getBoundingClientRect:()=>({width:390,height:844})});r.initialize=function(){this.renderer??={setSize(){},render(){},renderLists:{dispose(){}}}};r.render('helix',m);setRings(m,'solid');m.charged=true;m.streak=3;m.ball=0;m.velocity=7;m.update(.01);r.render('helix',m);assert(r.fragments.length>8);assert(r.helixRings.find(g=>g.userData.floor===0).visible===false);assert(r.fragments.length<=40);m.time+=1.2;r.render('helix',m);assert.equal(r.fragments.length,0);r.stop();
console.log('PASS: 3 accelerating continuous gaps arm fireball; one red-floor smash preserves descent; next red kills; automatic retry; safe bounce resets; swept collision; frame-rate consistency; ad remains open; 210,000 seeded shuffle draws and constant-RNG exhaustion; actual platform fragments and cleanup. No browser pixels claimed.');

// The visible front rim must track horizontal finger motion in the same direction.
m=new HelixTower();const before=Math.cos(Math.PI/2+m.rotation);m.drag(40);const after=Math.cos(Math.PI/2+m.rotation);assert(after>before);m.keys.add('ArrowLeft');const rot=m.rotation;m.update(.05);assert(m.rotation>rot);
console.log('PASS: right drag moves front geometry right; left key moves it left');
