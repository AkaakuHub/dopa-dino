// Original procedural scores and sound design. One context, no audio files or timers.
// The existing animation loop drives a bounded 140 ms Web Audio look-ahead queue.
const note = midi => 440 * 2 ** ((midi - 69) / 12);
const rest = null;
export const MUSIC = {
  dino: { bpm:132, root:45, bars:[0,5,8,7], lead:'square', bass:'sawtooth', steps:16, swing:0,
    melody:[12,rest,19,rest,24,19,22,rest,19,rest,15,rest,17,19,12,rest], bassline:[0,rest,0,12,rest,0,7,rest,0,rest,12,rest,7,rest,0,7], kick:[0,6,8,14], snare:[4,12], hats:[2,6,10,14], chord:[0,7,12], pad:0.5 },
  snow: { bpm:84, root:50, bars:[0,7,5,0], lead:'bell', bass:'sine', steps:12, swing:0,
    melody:[24,rest,rest,19,rest,21,rest,19,rest,16,rest,rest], bassline:[0,rest,rest,rest,7,rest,rest,rest,12,rest,rest,rest], kick:[0], snare:[], hats:[4,8], chord:[0,4,7], pad:1.4 },
  hole: { bpm:104, root:41, bars:[0,0,5,7], lead:'pluck', bass:'triangle', steps:16, swing:.16,
    melody:[rest,19,rest,24,rest,22,19,rest,rest,15,17,rest,19,rest,15,rest], bassline:[0,rest,12,rest,7,rest,0,10,rest,0,rest,7,12,rest,10,7], kick:[0,7,10], snare:[4,12], hats:[0,2,4,6,8,10,12,14], chord:[0,3,7], pad:.3 },
  helix: { bpm:144, root:50, bars:[0,3,8,7], lead:'pluck', bass:'sawtooth', steps:16, swing:0,
    melody:[24,19,15,19,22,19,15,19,24,19,17,19,27,22,19,22], bassline:[0,rest,12,rest,0,rest,12,rest,0,rest,12,rest,0,rest,7,rest], kick:[0,4,8,12], snare:[4,12], hats:[2,6,10,14], chord:[0,3,7], pad:.65 },
  gates: { bpm:126, root:43, bars:[0,5,3,7], lead:'brass', bass:'triangle', steps:16, swing:0,
    melody:[12,rest,12,19,rest,19,15,rest,12,rest,15,19,22,rest,19,rest], bassline:[0,rest,0,rest,7,rest,7,rest,0,rest,0,rest,7,rest,10,rest], kick:[0,6,8], snare:[4,11,12,15], hats:[2,6,10,14], chord:[0,3,7], pad:.4 },
  stack: { bpm:92, root:48, bars:[0,7,9,5], lead:'bell', bass:'sine', steps:16, swing:.08,
    melody:[24,rest,rest,19,rest,16,rest,rest,21,rest,rest,19,rest,28,rest,rest], bassline:[0,rest,rest,rest,rest,rest,7,rest,0,rest,rest,rest,rest,rest,12,rest], kick:[0,8], snare:[], hats:[6,14], chord:[0,4,7,11], pad:1.6 },
  golf: { bpm:78, root:53, bars:[0,2,7,5], lead:'pluck', bass:'sine', steps:16, swing:.22,
    melody:[19,rest,16,rest,rest,14,16,rest,19,rest,24,rest,rest,21,19,rest], bassline:[0,rest,rest,7,rest,rest,0,rest,12,rest,rest,7,rest,rest,0,rest], kick:[0,7,10], snare:[4,12], hats:[2,6,10,14], chord:[0,4,7,11], pad:.45 },
  breaker: { bpm:154, root:40, bars:[0,8,5,7], lead:'square', bass:'square', steps:16, swing:0,
    melody:[24,19,24,27,rest,24,19,rest,22,17,22,26,rest,22,17,19], bassline:[0,12,rest,7,0,rest,12,rest,0,12,rest,7,0,rest,10,7], kick:[0,6,8,10], snare:[4,12], hats:[0,2,4,6,8,10,12,14], chord:[0,3,7], pad:.24 }
};
const supported = {
  dino:['start','jump','coin','boost','stage','fever','smash','over','revive','toggle'],
  snow:['chop','furnace','upgrade'], hole:['swallow','grow'], helix:['bounce','drop','smash','hazard','restart'],
  gates:['gate','battle','shot','impact','victory','fail','restart'], stack:['perfect','cut','miss','restart'],
  golf:['shot','bank','cup','hole'], breaker:['launch','wall','paddle','brick','armor','power','loss','clear','wave','restart']
};
export class ArcadeAudio {
  constructor({ enabled=false, contextFactory=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;} }={}) {
    this.enabled=enabled;this.contextFactory=contextFactory;this.context=null;this.unlocked=false;this.foreground=true;this.disposed=false;
    this.game=null;this.step=0;this.next=0;this.voices=new Set();this.lastEffects=new Map();this.cursors=new WeakMap();this.maxVoices=48;this.resumePending=null;
  }
  // Called only from actual pointer/keyboard/button handlers, never on initial load.
  unlock(){
    if(this.disposed)return;this.unlocked=true;if(!this.enabled||!this.foreground)return;
    try { if(!this.context){this.context=this.contextFactory();if(!this.context)return;this.setup();}this.resume(); } catch { this.context=null; }
  }
  setup(){
    const c=this.context;this.master=c.createGain();this.master.gain.value=.42;
    this.music=c.createGain();this.music.gain.value=.27;this.effects=c.createGain();this.effects.gain.value=.65;
    this.music.connect(this.master);this.effects.connect(this.master);
    this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-14;this.compressor.knee.value=12;this.compressor.ratio.value=4;this.compressor.attack.value=.003;this.compressor.release.value=.16;
    this.master.connect(this.compressor);this.compressor.connect(c.destination);
    this.noise=c.createBuffer(1,Math.ceil(c.sampleRate*.32),c.sampleRate);const data=this.noise.getChannelData(0);let seed=731;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=seed/2147483648;}
    this.next=c.currentTime+.025;
  }
  resume(){
    const c=this.context;if(!c||!this.enabled||!this.foreground||!this.unlocked)return;
    this.master.gain.value=.42;
    if(c.state!=='running'&&!this.resumePending){try{this.resumePending=Promise.resolve(c.resume()).then(()=>{this.resumePending=null;if(!this.enabled||!this.foreground)this.suspend();else if(c.state==='suspended')this.resume();},()=>{this.resumePending=null;});}catch{}}
  }
  setEnabled(value){
    this.enabled=!!value;if(!this.enabled){if(this.master)this.master.gain.value=0;this.stopVoices();this.suspend();}
    else if(this.unlocked){this.unlock();this.next=(this.context?.currentTime||0)+.025;}
  }
  setForeground(value){
    value=!!value;if(this.foreground===value)return;this.foreground=value;
    if(!value){this.stopVoices();this.suspend();}else{this.next=(this.context?.currentTime||0)+.025;this.resume();}
  }
  suspend(){try{const p=this.context?.suspend();p?.then(()=>{if(this.enabled&&this.foreground&&this.unlocked)this.resume();}).catch(()=>{});}catch{}}
  setGame(kind){
    kind=MUSIC[kind]?kind:null;if(kind===this.game)return;
    this.stopVoices();this.game=kind;this.step=0;this.next=(this.context?.currentTime||0)+.025;this.lastEffects.clear();
  }
  get audible(){return !this.disposed&&this.enabled&&this.unlocked&&this.foreground&&this.context?.state==='running';}
  stopVoices(){for(const v of [...this.voices]){try{v.source.stop();}catch{}this.release(v);}}
  release(v){if(!this.voices.delete(v))return;v.source.onended=null;for(const n of v.nodes){try{n.disconnect();}catch{}}}
  voice({frequency=440,end=frequency,duration=.12,type='sine',gain=.15,at=this.context?.currentTime||0,bus='effects',cutoff=5000,noise=false,pan=0}){
    if(!this.audible)return;
    // Effects have priority; stealing a music voice is preferable to unbounded nodes.
    if(this.voices.size>=this.maxVoices){if(bus==='music')return;const old=[...this.voices].find(v=>v.bus==='music')||this.voices.values().next().value;try{old.source.stop();}catch{}this.release(old);}
    const c=this.context,source=noise?c.createBufferSource():c.createOscillator(),envelope=c.createGain(),filter=c.createBiquadFilter();
    const start=Math.max(c.currentTime,at),finish=start+duration;filter.type=noise?'highpass':'lowpass';filter.frequency.value=cutoff;
    if(noise)source.buffer=this.noise;else{source.type=type;source.frequency.setValueAtTime(Math.max(25,frequency),start);if(end!==frequency)source.frequency.exponentialRampToValueAtTime(Math.max(25,end),finish);}
    envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),start+.005);envelope.gain.exponentialRampToValueAtTime(.0001,finish);
    source.connect(filter);filter.connect(envelope);const nodes=[source,filter,envelope];
    if(c.createStereoPanner&&pan){const panner=c.createStereoPanner();panner.pan.value=pan;envelope.connect(panner);panner.connect(this[bus]);nodes.push(panner);}else envelope.connect(this[bus]);
    const v={source,nodes,bus,end:finish+.015};this.voices.add(v);source.onended=()=>this.release(v);source.start(start);source.stop(v.end);
  }
  instrument(midi,at,duration,style='pluck',gain=.15,pan=0,bus='music'){
    const f=note(midi),params={frequency:f,at,duration,gain,pan,bus};
    if(style==='bell'){this.voice({...params,type:'sine'});this.voice({...params,frequency:f*2.76,duration:duration*.48,gain:gain*.16});}
    else this.voice({...params,type:style==='pluck'?'triangle':style==='brass'?'sawtooth':style,cutoff:style==='brass'?1700:style==='square'?2600:4500});
  }
  tick(){
    if(!this.audible)return;const now=this.context.currentTime;for(const v of this.voices)if(v.end<now)this.release(v);
    if(!this.game)return;const t=MUSIC[this.game],stepTime=60/t.bpm/4;
    // Never replay a background tab's missed bars or build a huge catch-up queue.
    if(this.next<now-.05)this.next=now+.015;
    for(let count=0;this.next<now+.14&&count<4;count++){
      this.sequence(t,this.step,this.next);const swing=this.step%2===0?1+t.swing:1-t.swing;
      this.next+=stepTime*swing;this.step=(this.step+1)%(t.steps*t.bars.length*2);
    }
  }
  sequence(t,index,at){
    const s=index%t.steps,bar=Math.floor(index/t.steps),root=t.root+t.bars[bar%t.bars.length],beat=60/t.bpm/4;
    const melody=t.melody[s];if(melody!==null&&melody!==undefined)this.instrument(root+melody+(bar>=t.bars.length&&s===t.steps-2?12:0),at,beat*1.55,t.lead,.15,s%4<2?-.16:.16);
    const bass=t.bassline[s];if(bass!==null&&bass!==undefined)this.instrument(root+bass,at,beat*1.4,t.bass,.22);
    if(s===0)for(const [i,n] of t.chord.entries())this.instrument(root+12+n,at,t.pad,'triangle',.045,(i-1)*.24);
    if(t.kick.includes(s))this.voice({frequency:125,end:45,duration:.13,gain:.28,at,bus:'music'});
    if(t.snare.includes(s))this.voice({noise:true,cutoff:this.game==='golf'?1800:1100,duration:this.game==='golf'?.045:.1,gain:this.game==='golf'?.05:.115,at,bus:'music'});
    if(t.hats.includes(s))this.voice({noise:true,cutoff:6500,duration:.035,gain:.037,at,bus:'music',pan:.22});
  }
  observe(kind,model){
    if(!model?.events)return;const previous=this.cursors.get(model)||0;let latest=previous;
    for(const e of model.events)if(e.id>previous){latest=Math.max(latest,e.id);this.effect(kind,e.type,e);}
    this.cursors.set(model,latest);
  }
  effect(kind,type,data={}){
    if(!this.audible||!supported[kind]?.includes(type))return false;
    const now=this.context.currentTime,key=kind+':'+type,cooldown=type==='shot'?.065:type==='wall'?.045:.025;
    if(now-(this.lastEffects.get(key)??-10)<cooldown)return false;this.lastEffects.set(key,now);
    const v=(f,to=f,d=.12,g=.22,w='sine',delay=0)=>this.voice({frequency:f,end:to,duration:d,gain:g,type:w,at:now+delay});
    const n=(d=.08,g=.16,cutoff=1000,delay=0)=>this.voice({noise:true,duration:d,gain:g,cutoff,at:now+delay});
    const melody=(notes,style='bell',duration=.24,gain=.2,spacing=.065)=>notes.forEach((m,i)=>this.instrument(m,now+i*spacing,duration,style,gain,0,'effects'));
    if(kind==='dino'){
      if(type==='jump')v(data.double?560:310,data.double?980:600,.12,.19,'triangle');
      if(type==='coin'){v(790+(data.combo||0)%8*45,1300,.07,.18);v(1560,1900,.11,.1,'sine',.03);}
      if(type==='boost'){v(95,620,.3,.27,'sawtooth');n(.2,.12,2300);melody([57,64,69,76],'square',.14,.12);}
      if(type==='stage'||type==='fever')melody(type==='stage'?[69,73,76,81]:[64,67,71,76,83],'bell',.35,.23);
      if(type==='smash'){n(.14,.24,650);v(130,38,.17,.3,'triangle');}
      if(type==='over'){v(250,72,.28,.22,'sawtooth');v(110,45,.32,.18,'triangle',.09);}
      if(type==='start'||type==='revive')melody(type==='start'?[57,64,69]:[64,69,76,81],'pluck');
      if(type==='toggle')v(640,850,.09,.12);
    }else if(kind==='snow'){
      if(type==='chop'){n(.045,.22,700);v(175,80,.075,.27,'triangle');}
      if(type==='furnace'){n(.3,.17,500);v(78,165,.27,.18);melody([62,69,74],'bell',.42,.12,.08);}
      if(type==='upgrade')melody([74,78,81,86],'bell',.65,.2,.11);
    }else if(kind==='hole'){
      if(type==='swallow'){v(280+(data.size||0)*50,48,.2,.32);v(520,95,.14,.12,'triangle',.035);}
      if(type==='grow'){v(95,320,.34,.2,'triangle');melody([65,68,72,77],'pluck',.22,.18,.07);}
    }else if(kind==='helix'){
      if(type==='bounce')v(290,570,.115,.28,'sine');
      if(type==='drop'){const f=490+Math.min(7,data.streak||0)*95;v(f,f*1.55,.095,.22,'triangle');}
      if(type==='smash'){n(.18,.28,600);v(170,42,.23,.35,'sawtooth');melody([74,81,86],'square',.13,.12);}
      if(type==='hazard'){n(.15,.18,1500);v(350,65,.3,.2,'sawtooth');}
      if(type==='restart')melody([62,69,74],'pluck',.15,.12);
    }else if(kind==='gates'){
      if(type==='gate')melody([67,71,74,79],'brass',.16,.16,.038);
      if(type==='battle'){v(105,75,.2,.25,'triangle');n(.1,.15,650);}
      if(type==='shot'){n(.04,.13,1700);v(220,85,.055,.15,'square');}
      if(type==='impact'){n(.12,.25,550);v(130,44,.2,.26,'triangle');}
      if(type==='victory')melody(data.boss?[67,67,74,79,83,86]:[67,74,79],'brass',.29,.2,.09);
      if(type==='fail')v(220,45,.4,.23,'sawtooth');
      if(type==='restart')melody([55,62,67],'brass',.16,.12);
    }else if(kind==='stack'){
      if(type==='perfect'){const base=72+Math.min(data.combo||0,8);melody([base,base+7,base+12],'bell',.38,.2,.035);v(140,60,.08,.16);}
      if(type==='cut'){v(185,90,.09,.23,'triangle');n(.085,.14,2800,.03);melody([72,79],'pluck',.16,.13,.04);}
      if(type==='miss')v(440,90,.48,.2,'triangle');
      if(type==='restart')melody([60,67,72],'bell',.32,.13);
    }else if(kind==='golf'){
      if(type==='shot'){n(.027,.12,2400);v(860,230,.06,.22,'triangle');}
      if(type==='bank')v(1100,690,.06,.15,'sine');
      if(type==='cup'){v(590,190,.13,.21);melody(data.strokes===1?[77,81,84,89,93]:[77,81,84],'bell',.42,.18,.095);}
      if(type==='hole')melody([65,72,77],'pluck',.3,.12,.09);
    }else if(kind==='breaker'){
      if(type==='launch')v(240,950,.12,.18,'square');
      if(type==='wall')v(710,540,.04,.12,'square');
      if(type==='paddle')v(320,620,.075,.21,'triangle');
      if(type==='brick'){v(660+(data.color||0)*100,1400,.065,.19,'square');n(.055,.1,2600);}
      if(type==='armor'){v(930,410,.055,.17,'triangle');v(1470,750,.07,.08);}
      if(type==='power')melody(data.kind==='fire'?[64,68,72,76]:data.kind==='slow'?[76,72,69,64]:[64,71,76,83],'square',.15,.13,.055);
      if(type==='loss')v(420,70,.35,.22,'square');
      if(type==='clear')melody([64,68,71,76,80,83],'square',.25,.15,.08);
      if(type==='wave'||type==='restart')melody([52,59,64],'square',.14,.13);
    }
    return true;
  }
  dispose(){if(this.disposed)return;this.stopVoices();this.disposed=true;this.game=null;this.lastEffects.clear();this.cursors=new WeakMap();for(const n of [this.music,this.effects,this.master,this.compressor]){try{n?.disconnect();}catch{}}try{this.context?.close()?.catch(()=>{});}catch{}this.context=null;this.noise=null;}
}
