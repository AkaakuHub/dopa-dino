import assert from 'node:assert/strict';
import { ArcadeAudio, MUSIC } from './dist/audio.js';
import { SnowCamp, HoleCity, AdSession, AD_GAMES } from './dist/ads-engine.js';

// Web Audio contract test, including scheduled node cleanup. It does not test
// real speakers, browser autoplay policy, perceived loudness, or device latency.
class Param {
  constructor(value=0){this.value=value;this.changes=[];}
  setValueAtTime(value,at){assert(Number.isFinite(value)&&Number.isFinite(at));this.value=value;this.changes.push([value,at]);}
  exponentialRampToValueAtTime(value,at){assert(value>0);this.setValueAtTime(value,at);}
}
class Node {
  constructor(ctx){this.ctx=ctx;this.connected=false;this.gain=new Param();this.frequency=new Param();this.pan=new Param();for(const k of ['threshold','knee','ratio','attack','release'])this[k]=new Param();ctx.nodes.add(this);}
  connect(){this.connected=true;}
  disconnect(){this.connected=false;this.ctx.nodes.delete(this);}
  start(at){assert(at>=this.ctx.currentTime);this.startAt=at;this.ctx.sources.add(this);this.ctx.history.push({type:this.type||'noise',at,f:this.frequency.value,gain:this.gain.value});}
  stop(at=this.ctx.currentTime){this.stopAt=at;}
}
class Context {
  constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=44100;this.nodes=new Set();this.sources=new Set();this.destination={};this.history=[];this.resumes=0;}
  createGain(){return new Node(this)}createDynamicsCompressor(){return new Node(this)}createBiquadFilter(){return new Node(this)}createStereoPanner(){return new Node(this)}createBufferSource(){return new Node(this)}createOscillator(){return new Node(this)}
  createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData(){return data}};}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}
  suspend(){this.state='suspended';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
  advance(dt){this.currentTime+=dt;for(const s of this.sources)if(s.stopAt<=this.currentTime){this.sources.delete(s);s.onended?.();}}
}
let created=0;const contexts=[],audio=new ArcadeAudio({enabled:true,contextFactory:()=>{created++;const c=new Context();contexts.push(c);return c;}});
audio.setGame('dino');audio.tick();assert.equal(created,0,'saved sound-on must not autoplay or construct a context');
audio.setEnabled(false);audio.unlock();assert.equal(created,0,'muted input must not allocate audio');audio.setEnabled(true);const c=contexts[0];assert.equal(created,1);assert(audio.audible);
audio.tick();assert(audio.voices.size>0);assert(c.history.every(n=>n.at<=.14));
const fingerprints=new Set();
for(const kind of ['dino',...AD_GAMES.map(g=>g.id)]){
  const old=[...audio.voices];audio.setGame(kind);if(kind!=='dino')assert(old.every(v=>!audio.voices.has(v)),'previous soundtrack voices stop on transition');
  c.history=[];
  for(let i=0;i<720;i++){audio.tick();assert(audio.voices.size<=48);assert(c.nodes.size<=48*4+4);c.advance(1/60);}
  assert(c.history.length>30,kind+' has a continuous score');
  fingerprints.add(JSON.stringify(c.history.slice(0,30).map(n=>[n.type,Math.round(n.f),Math.round((n.at-c.history[0].at)*100)])));
}
assert.equal(fingerprints.size,8,'all eight scores have distinct notes, rhythm, and timbre');
assert.equal(new Set(Object.values(MUSIC).map(t=>t.bpm)).size,8);
audio.setGame('helix');audio.tick();audio.setForeground(false);assert.equal(c.state,'suspended');assert.equal(audio.voices.size,0);const before=c.history.length;c.advance(1000);audio.tick();assert.equal(c.history.length,before,'no hidden scheduling');
audio.setForeground(true);await Promise.resolve();audio.tick();assert(c.history.length-before<12,'no burst of missed background bars');assert.equal(created,1);
audio.setEnabled(false);assert.equal(audio.voices.size,0);assert.equal(audio.master.gain.value,0);const muted=c.history.length;audio.effect('helix','smash');audio.tick();assert.equal(c.history.length,muted);audio.setEnabled(true);await Promise.resolve();await Promise.resolve();assert.equal(created,1);
const effects={dino:['start','jump','coin','boost','stage','fever','smash','over','revive'],snow:['chop','furnace','upgrade'],hole:['swallow','grow'],helix:['bounce','drop','smash','hazard','restart'],gates:['gate','battle','shot','impact','victory','fail','restart'],stack:['perfect','cut','miss','restart'],golf:['shot','bank','cup','hole'],breaker:['launch','wall','paddle','brick','armor','power','loss','clear','wave','restart']};
for(const [kind,events] of Object.entries(effects))for(const type of events){audio.setGame(kind);c.advance(1);const before=c.history.length;assert(audio.effect(kind,type,{combo:3,streak:3,size:1,color:2,kind:'fire',boss:true,strokes:1}));assert(c.history.length>before,kind+':'+type+' emits its own cue');}
for(let i=0;i<500;i++){audio.effect('dino','boost');c.advance(.026);}assert(audio.voices.size<=48);assert(c.nodes.size<=196);assert(audio.lastEffects.size<70,'event throttles are bounded');
const seen={events:[{id:1,type:'brick'},{id:2,type:'power'}]};audio.setGame('breaker');c.advance(1);audio.observe('breaker',seen);const once=c.history.length;c.advance(1);audio.observe('breaker',seen);assert.equal(c.history.length,once,'rendering the same retained event never replays it');
audio.setEnabled(false);seen.events.push({id:3,type:'clear'});audio.observe('breaker',seen);audio.setEnabled(true);c.advance(1);audio.observe('breaker',seen);assert.equal(c.history.length,once,'events during mute do not replay on unmute');
// Race reconciliation: a queued resume that finishes after muting must suspend.
audio.resumePending=null;let finishResume;c.state='suspended';c.resume=()=>new Promise(resolve=>{finishResume=()=>{c.state='running';resolve()}});audio.unlock();audio.setEnabled(false);finishResume();await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.equal(c.state,'suspended');
audio.dispose();assert.equal(audio.context,null);assert.equal(c.state,'closed');assert.equal(c.nodes.size,0);assert.equal(audio.voices.size,0);audio.unlock();assert.equal(created,1);audio.dispose();
const unavailable=new ArcadeAudio({enabled:true,contextFactory:()=>null});unavailable.unlock();unavailable.tick();unavailable.effect('dino','jump');unavailable.dispose();

const snow=new SnowCamp();snow.player={x:snow.nodes[0].x,z:snow.nodes[0].z,target:null};for(let i=0;i<36;i++)snow.update(.05);assert.equal(snow.wood,6);assert.equal(snow.events.filter(e=>e.type==='chop').length,6);snow.player={x:0,z:0,target:null};snow.update(.01);assert(snow.events.some(e=>e.type==='furnace'));assert(snow.events.some(e=>e.type==='upgrade'));
const hole=new HoleCity();for(let i=0;i<24;i++){hole.items=[{type:'tree',size:.3,fall:.99,eaten:false}];hole.update(.05);}assert.equal(hole.eaten,24);assert(hole.events.some(e=>e.type==='swallow'));assert(hole.events.some(e=>e.type==='grow'));assert(hole.events.length<=20);
for(const kind of AD_GAMES.map(g=>g.id)){const session=new AdSession(kind);session.update(600);assert(!session.closed,'audio additions do not impose any play limit');}
console.log('PASS: eight distinct continuous scores; gesture-only context; shared mute; every gameplay cue; 48-voice/node cap; cross-game stop; hidden pause/resume without backlog; async mute/resume race; deduplicated model events; bounded snow/city queues; cleanup and silent unsupported-WebAudio fallback. Web Audio is mocked, not audible browser QA.');
