import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RunnerGame} from './dist/engine.js';
import {AD_GAMES,AdSession,AdShuffleBag} from './dist/ads-engine.js';

// Controller/engine integration with deterministic RAF and DOM stubs, not browser visual QA.
class Element {
  constructor(){this.events={};this.dataset={};this.style={};this.hidden=true;this.disabled=false;this.attrs={};this.classes=new Set();this.classAdds=[];this.captures=new Set();this.classList={add:(s)=>{this.classes.add(s);this.classAdds.push(s)},remove:s=>this.classes.delete(s),contains:s=>this.classes.has(s)};this.offsetHeight=900;}
  addEventListener(t,f){(this.events[t]??=[]).push(f)}
  dispatch(t,e={}){for(const f of this.events[t]??[])f({preventDefault(){},...e})}
  setAttribute(k,v){this.attrs[k]=v}
  focus(){doc.activeElement=this}
  getBoundingClientRect(){return {left:0,top:0,width:1440,height:900}}
  querySelectorAll(){return [elements['ad-skip'],elements['ad-restart']].filter(e=>!e.disabled)}
  setPointerCapture(id){this.captures.add(id)}
  hasPointerCapture(id){return this.captures.has(id)}
  releasePointerCapture(id){this.captures.delete(id)}
}
const elements=Object.fromEntries(['ad-screen','ad-canvas','ad-skip','ad-restart','ad-title','ad-hint','ad-keys','ad-progress',...Array.from({length:3},(_,i)=>'ad-stat-'+i),...Array.from({length:3},(_,i)=>'ad-stat-label-'+i)].map(k=>[k,new Element()]));
const win=new Element(),doc=new Element(),arcade=new Element();
Object.assign(doc,{body:new Element(),hidden:false,getElementById:k=>elements[k],querySelector:()=>arcade,activeElement:new Element()});
let nextFrame=0,now=1000;const frames=new Map();
class StubRenderer{constructor(){this.scale=1}resize(){this.resizeCount=(this.resizeCount||0)+1}render(){}world(x,z){return{x,z}}}
const sandbox={document:doc,window:win,AdRenderer:StubRenderer,AD_GAMES,AdSession,AdShuffleBag,requestAnimationFrame:f=>{const id=++nextFrame;frames.set(id,f);return id},cancelAnimationFrame:id=>frames.delete(id),Math};
vm.createContext(sandbox);vm.runInContext(readFileSync('./dist/ads.js','utf8').replace(/^import .*;$/gm,'').replace('export class PlayableAds','globalThis.PlayableAds=class PlayableAds'),sandbox);
const game=new RunnerGame();let revivals=0,restarts=0;
const ads=new sandbox.PlayableAds({onRevive:()=>{revivals++;assert(game.revive())},onRestart:()=>{restarts++;game.start()},availableGames:()=>['snow','hole','helix']});
const tick=ms=>{assert.equal(frames.size,1,'only one ad RAF may be queued');const [id,fn]=frames.entries().next().value;frames.delete(id);now+=ms;fn(now)};
const assertFrozen=(before)=>assert.deepEqual([game.score,game.distance,game.stageIndex,game.coins,game.elapsed,game.boostEnergy],before);
game.start();assert(!game.revive());assert(!game.beginAd());let lastKind;const firstCycle=[];
for(let cycle=1;cycle<=12;cycle++){
  game.shield=0;game.fever=0;game.boostTime=0;
  game.obstacles=[{x:108,y:game.ground-52,w:34,h:47}];game.update(.001);
  assert.equal(game.state,'over','actual collision must end each run segment');
  const before=[game.score,game.distance,game.stageIndex,game.coins,game.elapsed,game.boostEnergy];
  assert(game.beginAd());assert(ads.start());assert(!game.beginAd());assert(!ads.start());
  assert(!elements['ad-screen'].hidden);assert(arcade.inert);assert(doc.body.classes.has('ad-open'));
  assert(elements['ad-screen'].classes.has('ad-enter'));
  assert.equal(elements['ad-screen'].classAdds.filter(s=>s==='ad-enter').length,cycle);
  assert.notEqual(ads.session.kind,lastKind);lastKind=ads.session.kind;if(cycle<=10)firstCycle.push(lastKind);
  assert.equal(ads.session.elapsed,0);assert(elements['ad-skip'].disabled);assert(!ads.finish());
  tick(16);tick(4990);assert(ads.session.elapsed<5);assert(!ads.finish());
  const elapsed=ads.session.elapsed;
  win.dispatch('resize');win.dispatch('keydown',{code:'ArrowLeft'});
  assert.equal(ads.session.elapsed,elapsed);assert.equal(elements['ad-screen'].classAdds.filter(s=>s==='ad-enter').length,cycle,'input/resize must not restart entrance');
  win.dispatch('blur');tick(10000);tick(10000);assert.equal(ads.session.elapsed,elapsed);assert.equal(ads.session.model.keys.size,0);
  win.dispatch('focus');tick(10000);assert.equal(ads.session.elapsed,elapsed,'focus must reset clock baseline');
  doc.hidden=true;doc.dispatch('visibilitychange');tick(10000);tick(10000);assert.equal(ads.session.elapsed,elapsed);
  doc.hidden=false;doc.dispatch('visibilitychange');tick(10000);assert.equal(ads.session.elapsed,elapsed,'visibility restoration must reset clock baseline');
  tick(11);assert(ads.session.ready);assert(!elements['ad-skip'].disabled);
  tick(600000);assert(ads.active,'five seconds must never auto-close');assert.equal(game.state,'ad');game.update(60);assertFrozen(before);
  elements['ad-canvas'].dispatch('pointerdown',{pointerId:cycle,clientX:200,clientY:250});assert.equal(elements['ad-canvas'].captures.size,1);
  assert(ads.finish());assert(!ads.finish());assert(!game.revive());assert.equal(revivals,cycle);assert.equal(game.revivesUsed,cycle);
  assert.equal(game.state,'running');assertFrozen(before);assert.equal(game.shield,3);assert.equal(game.obstacles.length,0);assert.equal(game.pickups.length,0);
  assert.equal(frames.size,0);assert.equal(ads.raf,0);assert.equal(ads.pointer,null);assert.equal(elements['ad-canvas'].captures.size,0);
  assert(elements['ad-screen'].hidden);assert(!elements['ad-screen'].classes.has('ad-enter'));assert(!arcade.inert);assert(!doc.body.classes.has('ad-open'));
  game.obstacles=[{x:108,y:game.ground-52,w:34,h:47}];game.update(.001);assert.equal(game.state,'running','each revive shield blocks another immediate death');
}
assert.equal(new Set(firstCycle).size,10,'first ten rewarded ads include every game even with only three LAB games available');
game.state='over';assert(game.beginAd());assert(ads.start());elements['ad-restart'].dispatch('click');assert.equal(restarts,1);assert.equal(game.state,'running');assert.equal(game.score,0);assert.equal(game.revivesUsed,0);assert.equal(frames.size,0);assert(!ads.active);
const css=readFileSync('./dist/style.css','utf8'),html=readFileSync('./dist/index.html','utf8');
assert.match(css,/\.ad-screen\.ad-enter\{animation:ad-slide-up \.4s cubic-bezier\(\.16,1,\.3,1\) both\}/);
assert.match(css,/@keyframes ad-slide-up\{from\{transform:translate3d\(0,100%,0\)\}to\{transform:translate3d\(0,0,0\)\}\}/);
assert.match(css,/\.motion-low \.ad-screen\.ad-enter\{animation:none;transform:translate3d\(0,0,0\)\}/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.ad-screen\.ad-enter\{animation:none;transform:translate3d\(0,0,0\)\}\}/);
assert.match(css,/\.ad-screen\[hidden\]\{display:none!important\}/);
assert(!html.includes('1 RUN / 1回'));assert(!html.includes('1走につき1回'));
console.log('PASS: 12 actual collision → ad → five-active-second unlock → unlimited play → revive cycles; same score/stage/resources; no repeat ad, early/double guards, one RAF, blur/visibility timer isolation, input/resize entrance stability, 3-second shield every time, pointer/RAF/modal cleanup, restart reset, 400 ms bottom-up and reduced-motion CSS rules. Controller DOM/CSS checks are not browser visual QA.');

for(const phrase of ['架空広告','無限に遊べます','これは5秒','好きなだけ遊べます','スキップ解放','そのまま遊び続け']){assert(!html.includes(phrase));assert(!readFileSync('./dist/ads.js','utf8').includes(phrase));}
assert(!html.includes('ad-tagline'));assert(!html.includes('ad-game-message'));assert(!html.includes('ad-time-note'));console.log('PASS: compact ad controls have no explanatory slogans');
