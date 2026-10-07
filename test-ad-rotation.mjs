import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AD_GAMES,AD_ROTATION_KEY,AdShuffleBag,AdSession} from './dist/ads-engine.js';
import {Progression,SAVE_KEY} from './dist/progression.js';
import {RunnerGame} from './dist/engine.js';
import {paintProgression} from './dist/progression-ui.js';

const ids=AD_GAMES.map(g=>g.id),pool=ids.join(',');
const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
// Reconstruct between every draw, including cycle boundaries, as on page reload.
for(let seed=1;seed<=30;seed++){
  let state=seed;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const storage=memory();let last;
  for(let cycle=0;cycle<30;cycle++){
    const draws=[];
    for(let n=0;n<ids.length;n++){
      const kind=new AdShuffleBag(random,storage).next();assert.notEqual(kind,last);last=kind;draws.push(kind);
      const saved=JSON.parse(storage.getItem(AD_ROTATION_KEY));assert.equal(saved.version,1);assert.equal(saved.bag.length,ids.length-1-n);assert(!saved.bag.includes(kind));assert(storage.getItem(AD_ROTATION_KEY).length<300);
    }
    assert.deepEqual(new Set(draws),new Set(ids),'every ad opening cycle visits all games exactly once');
  }
}
for(const malformed of ['{', 'null', JSON.stringify({version:0}),JSON.stringify({version:1,pool,bag:['snow','snow'],last:'hole'}),JSON.stringify({version:1,pool,bag:['unknown'],last:'hole'}),JSON.stringify({version:1,pool,bag:['hole'],last:'hole'}),JSON.stringify({version:1,pool:'old-catalog',bag:[],last:'snow'}),JSON.stringify({version:1,pool,bag:ids,last:'unknown'})]){
  const storage=memory();storage.setItem(AD_ROTATION_KEY,malformed);const bag=new AdShuffleBag(()=>.4,storage);assert.deepEqual(new Set(ids.map(()=>bag.next())),new Set(ids));
}
const future=memory(),futureState=JSON.stringify({version:2,privateFutureField:true});future.setItem(AD_ROTATION_KEY,futureState);new AdShuffleBag(()=>.4,future).next();assert.equal(future.getItem(AD_ROTATION_KEY),futureState,'never overwrite an unknown future schema');
const unavailable={getItem(){throw Error('storage unavailable')},setItem(){throw Error('quota exceeded')}};const volatile=new AdShuffleBag(()=>.4,unavailable);assert.deepEqual(new Set(ids.map(()=>volatile.next())),new Set(ids),'storage failure keeps the full in-memory rotation playable');
console.log('PASS: 9,000 persisted ad draws across reloads, all ten once per cycle, no adjacent boundary repeats, bounded/validated save, future-schema preservation and unavailable-storage fallback.');

// Controller integration uses real fresh progression, sessions and runner; rendering is stubbed.
const html=readFileSync('./dist/index.html','utf8'),controller=readFileSync('./dist/ads.js','utf8');
assert(!html.includes('ad-next'));assert(!html.includes('ad-replay'));assert(!controller.includes('ad-next'));assert(!controller.includes('ad-replay'));assert(!controller.includes('replay('));
class Element {
  constructor(id=''){this.id=id;this.events={};this.dataset={};this.style={};this.hidden=false;this.disabled=false;this.attrs={};this.captures=new Set();this.classes=new Set();this.classList={add:s=>this.classes.add(s),remove:s=>this.classes.delete(s),contains:s=>this.classes.has(s)};}
  addEventListener(t,f){(this.events[t]??=[]).push(f)}
  dispatch(t,e={}){for(const f of this.events[t]??[])f({preventDefault(){},target:this,...e})}
  setAttribute(k,v){this.attrs[k]=v}
  focus(){doc.activeElement=this}
  closest(){return null}
  querySelectorAll(){return ['ad-sound','ad-skip','ad-restart','ad-return'].map(id=>elements[id]).filter(e=>!e.disabled)}
  getBoundingClientRect(){return {left:0,top:0,width:1440,height:900}}
  hasPointerCapture(id){return this.captures.has(id)}
  setPointerCapture(id){this.captures.add(id)}
  releasePointerCapture(id){this.captures.delete(id)}
}
const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])])),arcade=new Element(),doc=new Element(),win=new Element();
Object.assign(doc,{body:new Element(),hidden:false,getElementById:id=>elements[id],querySelector:()=>arcade,activeElement:null});
const storage=memory(),progression=new Progression(storage),initialPrestige=JSON.stringify(progression.prestige.snapshot());
const game=new RunnerGame({upgrades:progression.levels,meta:progression.features});game.start();let revives=0,rafId=0;const frames=new Set();
const sandbox={document:doc,window:win,Math,AD_GAMES,AdSession,AdShuffleBag,requestAnimationFrame:()=>{frames.add(++rafId);return rafId},cancelAnimationFrame:id=>frames.delete(id),AdRenderer:class{resize(){}render(){}stop(){}},console};
vm.createContext(sandbox);vm.runInContext(controller.replace(/^import .*;$/gm,'').replace('export class PlayableAds','globalThis.PlayableAds=class PlayableAds'),sandbox);
const ads=new sandbox.PlayableAds({progression,availableGames:()=>progression.features.games,onGrowth:()=>{game.setUpgrades(progression.levels);game.setMeta(progression.features)},onRevive:()=>{revives++;assert(game.revive())},onRestart:()=>game.start()});
const complete={snow:m=>m.delivered=18,hole:m=>m.eaten=24,helix:m=>m.depth=18,gates:m=>m.cleared=1,stack:m=>m.level=12,golf:m=>m.sinking=1,breaker:m=>m.wavePause=1,range:m=>{m.hits=12;m.outcome='success'},pins:m=>{m.saved=12;m.outcome='success'},merge:m=>{m.bestTier=m.targetTier;m.outcome='success'},kitchen:m=>{m.delivered=3;m.outcome='success'}};
const draws=[],missions=[];
for(let n=0;n<ids.length;n++){
  game.state='over';assert(game.beginAd());assert(ads.start());assert.equal(frames.size,1);const kind=ads.session.kind,rotation=storage.getItem(AD_ROTATION_KEY);draws.push(kind);missions.push(ads.session.missionId);
  assert(!ads.start());assert(!ads.start('snow'));assert(!ads.finish());assert.equal(storage.getItem(AD_ROTATION_KEY),rotation);
  complete[kind](ads.session.model);ads.paint();assert.equal(ads.session.result.outcome,'success');assert(!elements['ad-result'].hidden);const firstReceipt=ads.session.receipt,rounds=progression.state.rounds,resources=JSON.stringify(progression.state.resources);
  ads.paint();ads.showResult();assert.equal(progression.state.rounds,rounds);assert.equal(JSON.stringify(progression.state.resources),resources,'one result is never paid twice');assert.equal(progression.award(kind,firstReceipt,'success',1),null);
  assert.equal(typeof ads.replay,'undefined','completed ads have no replay action');assert.equal(ads.session.kind,kind);assert.equal(ads.session.missionId,missions[draws.indexOf(kind)]);assert.equal(elements['ad-screen'].dataset.kind,kind);assert.equal(storage.getItem(AD_ROTATION_KEY),rotation,'result cannot consume a future ad');assert.equal(progression.state.rounds,rounds,'result settled exactly once');
  assert(ads.finish());assert(!ads.finish());assert.equal(frames.size,0);assert.equal(game.state,'running');assert.equal(progression.state.rounds,rounds);assert.equal(JSON.stringify(progression.state.resources),resources,'return does not settle twice');assert.equal(storage.getItem(AD_ROTATION_KEY),rotation);
  assert.deepEqual(progression.features.games,['snow','hole','helix']);assert.equal(JSON.stringify(progression.prestige.snapshot()),initialPrestige);
}
assert.deepEqual(new Set(draws),new Set(ids));assert.deepEqual(new Set(missions),new Set(ids),'mission rewards also rotate independently across all games');assert.equal(revives,ids.length);
// Direct LAB launches reject locked/unknown choices, and never disturb ad rotation.
const afterAds=storage.getItem(AD_ROTATION_KEY),missionBefore=storage.getItem('dino-overdrive-mission-rotation');assert(!ads.start('range'));assert(!ads.start('unknown'));assert(!ads.start(null));assert.equal(storage.getItem(AD_ROTATION_KEY),afterAds);assert(ads.start('snow'));assert.equal(ads.session.missionId,'snow');assert(ids.includes(ads.session.kind),'LAB mission selection still uses the creative pool');ads.stop();assert.notEqual(storage.getItem(AD_ROTATION_KEY),afterAds);assert.equal(storage.getItem('dino-overdrive-mission-rotation'),missionBefore);
const reloaded=new Progression(storage);assert.deepEqual(reloaded.features.games,['snow','hole','helix']);for(const flag of ['passive','hyper','exponent','tower','autoBlaster'])assert.equal(reloaded.features[flag],false);assert.equal(JSON.stringify(reloaded.prestige.snapshot()),initialPrestige);assert(reloaded.level('range')>0);
const previousDocument=globalThis.document;globalThis.document=doc;try{paintProgression(reloaded);}finally{globalThis.document=previousDocument;}
for(const id of ids.slice(3))assert.match(elements['skill-grid'].innerHTML,new RegExp('class="skill-card locked" disabled data-play="'+id+'"'),'ad rewards do not unlock LAB cards');
const runner=new RunnerGame({upgrades:reloaded.levels,meta:reloaded.features});runner.start();runner.blasterCooldown=0;runner.obstacles=[{x:350,y:runner.ground-40,w:30,h:40}];runner.update(.01);assert.equal(runner.obstacles.length,1,'range materials never bypass tree blaster research');assert(!runner.obstacles[0].hit);
assert(storage.getItem(SAVE_KEY));console.log('PASS: fresh-save rewarded controller covers all ten games; one immutable game per opening; results/skip do not advance rotation or double-pay; blocked LAB cards, tree/economy/blaster gates survive rewards and reload; single RAF and exact-once return cleanup. DOM/renderer stubs are not browser pixel QA.');

// Input can finish a round before the next animation frame paints its result.
game.state='over';assert(game.beginAd());assert(ads.start('snow'));ads.session.elapsed=5;complete[ads.session.kind](ads.session.model);ads.session.checkResult();const completedReceipt=ads.session.receipt,roundsBefore=progression.state.rounds,snowBefore=progression.state.resources.snow;assert(!ads.session.settled);assert(ads.finish());assert.equal(progression.state.rounds,roundsBefore+1);assert(progression.state.resources.snow>snowBefore);assert(progression.state.receipts.includes(completedReceipt));assert(!ads.finish());assert.equal(progression.state.rounds,roundsBefore+1);assert.notEqual(storage.getItem(AD_ROTATION_KEY),afterAds);
console.log('PASS: completing a round then immediately returning before paint settles exactly once; plain skips still pay no round reward.');
