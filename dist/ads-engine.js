import { GAME_META as FPS_META, GAME_MODELS as FPS_MODELS } from './ads-fps.js';
import { GAME_META as PIN_MERGE_META, GAME_MODELS as PIN_MERGE_MODELS } from './ads-pin-merge.js';
import { GAME_META as GATES_STACK_META, GAME_MODELS as GATES_STACK_MODELS } from './ads-gates-stack.js';
import { GAME_META as GOLF_BREAKER_META, GAME_MODELS as GOLF_BREAKER_MODELS } from './ads-golf-breaker.js';
import { inflationForRound, makeRiskReward, armRiskReward, settleRiskReward } from './ad-inflation.js';
export { inflationForRound, makeRiskReward, armRiskReward, settleRiskReward } from './ad-inflation.js';
export const AD_GAMES = [
  {id:'snow',name:'FROSTFIRE CAMP',hint:'ドラッグで移動',keys:'↑ ↓ ← → / WASD',accent:'#ffb34d'},
  {id:'hole',name:'CITY FEAST',hint:'ドラッグで移動',keys:'↑ ↓ ← → / WASD',accent:'#69dfff'},
  {id:'helix',name:'SPIRAL DROP',hint:'左右にドラッグで回転',keys:'← → / A D',accent:'#ff9454'},
  ...GATES_STACK_META,...GOLF_BREAKER_META,...FPS_META,...PIN_MERGE_META
];
export const AD_ROTATION_KEY='dino-overdrive-ad-rotation';
export const AD_MISSION_ROTATION_KEY='dino-overdrive-mission-rotation';
const AD_POOL=AD_GAMES.map(g=>g.id),AD_POOL_ID=AD_POOL.join(',');
// Rewarded ads always visit all games, independently of the LAB's unlocks.
// Save only the remaining bag and last draw, so reloads do not restart a cycle.
export class AdShuffleBag {
  constructor(random=Math.random,storage,key=AD_ROTATION_KEY){
    this.random=random;this.bag=[];this.last=null;this.readOnly=false;this.key=key;
    try{
      this.storage=storage===undefined?globalThis.localStorage:storage;
      const saved=JSON.parse(this.storage?.getItem(this.key)||'null');
      this.readOnly=saved?.version>1;
      if(saved?.version===1&&saved.pool===AD_POOL_ID&&Array.isArray(saved.bag)&&saved.bag.length<AD_POOL.length&&new Set(saved.bag).size===saved.bag.length&&saved.bag.every(id=>AD_POOL.includes(id))&&AD_POOL.includes(saved.last)&&!saved.bag.includes(saved.last)){
        this.bag=[...saved.bag];this.last=saved.last;
      }
    }catch{}
  }
  next(){
    if(!this.bag.length){
      this.bag=[...AD_POOL];
      for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
      if(this.bag.length>1&&this.bag[0]===this.last){const j=1+Math.floor(this.random()*(this.bag.length-1));[this.bag[0],this.bag[j]]=[this.bag[j],this.bag[0]];}
    }
    this.last=this.bag.shift();
    if(!this.readOnly)try{this.storage?.setItem(this.key,JSON.stringify({version:1,pool:AD_POOL_ID,bag:this.bag,last:this.last}));}catch{}
    return this.last;
  }
}
export const ROUND_RULES={
  range:{limit:45,goal:12,label:'ドローン12機を撃破',value:m=>m.hits,win:m=>m.outcome==='success',fail:m=>m.outcome==='failure'},
  pins:{limit:90,goal:12,label:'12個の宝石を救う',value:m=>m.saved,win:m=>m.outcome==='success',fail:m=>m.outcome==='failure'},
  merge:{limit:150,goal:1,label:'同じ数字を合体',value:m=>Math.max(0,(2**m.bestTier-2)/(2**m.targetTier-2)),win:m=>m.outcome==='success',fail:m=>m.outcome==='failure'},
  snow:{limit:75,goal:18,label:'薪を18本届ける',value:m=>m.delivered,win:m=>m.delivered>=18},
  hole:{limit:60,goal:24,label:'街の物を24個吸い込む',value:m=>m.eaten,win:m=>m.eaten>=24},
  helix:{limit:90,goal:18,label:'18段降りる',value:m=>m.depth,win:m=>m.depth>=18,fail:m=>m.dead>0},
  gates:{limit:90,goal:1,label:'ボスを倒す',value:m=>m.cleared||Math.min(.9,m.distance/65),win:m=>m.cleared>0,fail:m=>m.dead>0},
  stack:{limit:90,goal:12,label:'12段積む',value:m=>m.level,win:m=>m.level>=12,fail:m=>m.dead>0},
  golf:{limit:120,goal:1,label:'10打以内にカップへ',value:m=>m.sinking?1:m.strokes?Math.max(0,.8*(1-Math.hypot(m.ball.x-m.cup.x,m.ball.z-m.cup.z)/8)):0,win:m=>m.sinking>0,fail:m=>m.strokes>=10&&m.canShoot},
  breaker:{limit:150,goal:28,label:'ブロックを全て壊す',value:m=>m.destroyed,win:m=>m.wavePause>0||m.wave>1,fail:m=>m.dead>0}
};
export class AdSession {
  constructor(kind,{round=1,receipt='',missionId=kind}={}){this.kind=kind;this.missionId=missionId;this.elapsed=0;this.roundTime=0;this.closed=false;this.round=round;this.receipt=receipt;this.result=null;this.settled=false;const Model={snow:SnowCamp,hole:HoleCity,helix:HelixTower,...GATES_STACK_MODELS,...GOLF_BREAKER_MODELS,...FPS_MODELS,...PIN_MERGE_MODELS}[kind];if(!Model)throw new Error('Unknown game: '+kind);this.model=new Model(round);const baseRule=ROUND_RULES[kind]||{limit:120,goal:1,label:'CLEAR',value:m=>m.progress||0,win:m=>m.outcome==='success',fail:m=>m.outcome==='failure'};this.rule=(kind==='range'||kind==='breaker')?{...baseRule,goal:kind==='range'?this.model.goal:this.model.waveBricks,label:kind==='range'?`ドローン${this.model.goal}機を撃破`:baseRule.label}:baseRule;}
  get ready(){return this.elapsed>=5&&!this.closed;}
  get remaining(){return Math.max(0,Math.ceil(5-this.elapsed));}
  get progress(){return Math.min(1,Math.max(0,this.rule.value(this.model)/this.rule.goal));}
  get seconds(){return Math.max(0,Math.ceil(this.rule.limit-this.roundTime));}
  checkResult(){if(this.result||this.closed)return this.result;const outcome=this.rule.win(this.model)?'success':this.rule.fail?.(this.model)||this.model.outcome==='failure'||this.roundTime>=this.rule.limit?'failure':null;if(outcome){this.model.keys.clear();this.model.pointerCancel?.();this.result={outcome,progress:this.progress,seconds:this.roundTime,metric:this.model.resultMetric||`${Math.floor(this.rule.value(this.model))} / ${this.rule.goal}`,receipt:this.receipt,rewardMultiplier:Math.max(1,Math.min(4,Number.isFinite(this.model.riskBonus)?this.model.riskBonus:1))};}return this.result;}
  update(dt,active=true){if(this.closed||!active)return;dt=Number.isFinite(dt)?Math.max(0,dt):0;this.elapsed+=dt;if(this.result)return;const step=Math.min(dt,.05);this.roundTime+=step;this.model.update(step);this.checkResult();}
  // Closing is a one-shot transition. A second close must not look successful:
  // callers use the return value to guard revive/settlement side effects.
  // A player who clears/fails early may return immediately; an idle timeout
  // still honors the five-second skip gate before it can close.
  close(){if(this.closed||(!this.ready&&(!this.result||this.roundTime>=this.rule.limit)))return false;this.closed=true;return true;}
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function move(p,target,keys,dt,speed,bounds){let dx=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),dz=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);if(dx||dz){p.target=null;const n=Math.hypot(dx,dz);p.x+=dx/n*speed*dt;p.z+=dz/n*speed*dt;}else if(target){dx=target.x-p.x;dz=target.z-p.z;const d=Math.hypot(dx,dz),s=Math.min(d,speed*dt);if(d>.04){p.x+=dx/d*s;p.z+=dz/d*s;}}p.x=clamp(p.x,-bounds,bounds);p.z=clamp(p.z,-bounds,bounds);}
export class SnowCamp {
  constructor(round=1){this.round=Math.max(1,Math.floor(Number.isFinite(round)?round:1));this.inflation=inflationForRound(this.round);this.riskReward=makeRiskReward(2);this.time=0;this.eventId=0;this.events=[];this.keys=new Set();this.player={x:0,z:3,target:null};this.wood=0;this.delivered=0;this.heat=26;this.level=1;this.warm=2;this.chop=0;this.pop=0;this.nodes=[{x:-3.8,z:1,logs:99},{x:3.5,z:2.6,logs:99},{x:-2.8,z:-3.8,logs:99},{x:3.4,z:-2.5,logs:99}];this.message='薪を集めて、炉に届けよう';}
  emit(type,data={}){this.events.push({id:++this.eventId,type,time:this.time,...data});if(this.events.length>20)this.events.shift();}
  point(x,z){this.player.target={x:clamp(x,-5,5),z:clamp(z,-5,5)};}
  update(dt){this.time+=dt;this.pop=Math.max(0,this.pop-dt);move(this.player,this.player.target,this.keys,dt,4,5);this.heat=Math.max(4,this.heat-dt*.6*this.inflation.speed);const node=this.nodes.find(n=>dist(n,this.player)<1.2);if(node&&this.wood<6){this.chop+=dt;if(this.chop>=.28*this.inflation.difficulty){this.chop=0;this.wood++;this.emit('chop',{wood:this.wood});this.pop=.4;this.message='薪 +1　中央の炉に届けよう';}}else this.chop=0;if(dist(this.player,{x:0,z:0})<1.3&&this.wood){const previousLevel=this.level;this.emit('furnace',{wood:this.wood});this.delivered+=this.wood;this.heat=Math.min(100,this.heat+this.wood*9);this.wood=0;this.level=1+Math.floor(this.delivered/6);if(this.level>previousLevel)this.emit('upgrade',{level:this.level});this.warm=Math.min(12,2+this.delivered);this.message=this.warm>=12?'みんな、あったかい！ 炉をもっと育てよう':'炉がレベルアップ！ 街が暖まった';this.pop=1;}}
}
// Nine deterministic city chunks. Leaving a chunk recycles its content instead of
// retaining an ever-growing map of meshes or visited coordinates.
export const CITY_CHUNK_SIZE=16;
export class HoleCity {
  constructor(round=1){this.round=Math.max(1,Math.floor(Number.isFinite(round)?round:1));this.inflation=inflationForRound(this.round);this.time=0;this.eventId=0;this.events=[];this.keys=new Set();this.player={x:-1,z:4.8,target:null};this.radius=.65;this.eaten=0;this.score=0;this.combo=0;this.pop=0;this.level=1;this.chunks=new Map();this.items=[];this.chunkX=Infinity;this.chunkZ=Infinity;this.message='';this.makeCity();}
  hash(x,z,n=0){let v=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(n+17,1274126177);v=Math.imul(v^(v>>>13),1274126177);return (v^(v>>>16))>>>0;}
  makeChunk(cx,cz){const items=[],colors=['#ed9583','#7ba8d7','#ebc373','#b49bcc','#86bbc4'];let id=0;const add=(x,z,type,size,h,variant=0)=>items.push({id:`${cx}:${cz}:${id++}`,x:cx*CITY_CHUNK_SIZE+x,z:cz*CITY_CHUNK_SIZE+z,type,size,h,variant,color:colors[variant%5],fall:0,eaten:false,rotation:type==='car'?Math.PI/2:0});
    for(const x of [-4.2,4.2])for(const z of [-4.2,4.2]){const v=this.hash(cx,cz,id)%5;add(x,z,'building',1.3,1.7+v*.57,v);add(x+1.8,z+1.7,'tree',.35,.9);add(x-1.7,z-1.8,'tree',.35,.9);}
    for(let i=0;i<8;i++){const z=-6.5+i*1.8;add(i%2?-1.8:1.8,z,i%3?'tree':'cone',.32,i%3?.8:.4);}
    for(const z of [-5.5,3.7]){add(0,z,'car',.8,.7,this.hash(cx,cz,id)%4);add(6.4,z,'bench',.45,.7);add(-6.4,z,'bench',.45,.7);}
    return {cx,cz,items};
  }
  makeCity(){const cx=Math.floor((this.player.x+8)/CITY_CHUNK_SIZE),cz=Math.floor((this.player.z+8)/CITY_CHUNK_SIZE);if(cx===this.chunkX&&cz===this.chunkZ&&this.chunks.size===9)return;this.chunkX=cx;this.chunkZ=cz;const keep=new Set();for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++){const key=x+':'+z;keep.add(key);if(!this.chunks.has(key))this.chunks.set(key,this.makeChunk(x,z));}for(const key of this.chunks.keys())if(!keep.has(key))this.chunks.delete(key);this.items=Array.from(this.chunks.values()).flatMap(c=>c.items);}
  emit(type,data={}){this.events.push({id:++this.eventId,type,time:this.time,...data});if(this.events.length>20)this.events.shift();}
  point(x,z){if(Number.isFinite(x)&&Number.isFinite(z))this.player.target={x,z};}
  update(dt){this.time+=dt;this.pop=Math.max(0,this.pop-dt);move(this.player,this.player.target,this.keys,dt,(4.5+Math.min(1.4,this.radius*.25))*this.inflation.speed,Infinity);this.makeCity();for(const o of this.items){if(o.eaten)continue;if(o.fall){o.fall+=dt*2.1;if(o.fall>=1){o.eaten=true;this.eaten++;this.emit('swallow',{size:o.size,kind:o.type});const previousLevel=this.level;this.score+=o.type==='building'?100:o.type==='car'?40:10;this.radius=Math.min(3.4,.65+Math.sqrt(this.eaten)*.20/this.inflation.difficulty);this.level=1+Math.floor(this.eaten/12);if(this.level>previousLevel)this.emit('grow',{level:this.level});this.pop=.45;}continue;}if(o.size<=this.radius&&dist(o,this.player)<this.radius*.78){o.fall=.001;o.sinkX=this.player.x;o.sinkZ=this.player.z;}}}
  get stats(){return [['SIZE','Lv.'+this.level],['EATEN',this.eaten],['SCORE',this.score]];}
}
const tau=Math.PI*2,angle=a=>((a%tau)+tau)%tau;
export class HelixTower {
  constructor(round=1){this.round=Math.max(1,Math.floor(Number.isFinite(round)?round:1));this.inflation=inflationForRound(this.round);this.time=0;this.keys=new Set();this.rotation=0;this.hits=0;this.attempt=1;this.eventId=0;this.events=[];this.resetAttempt();}
  resetAttempt(){this.floor=0;this.depth=0;this.ball=0;this.velocity=-3.1*this.inflation.speed;this.streak=0;this.charged=false;this.score=0;this.flash=0;this.pop=0;this.dead=0;this.broken=new Set();this.message='3段続けて落ちると、炎で床を突き破る';this.rings=Array.from({length:24},(_,i)=>({gap:angle(2.8+Math.floor(i/4)*1.7+(i%4)*.4),gapWidth:Math.max(1.1,1.72-this.inflation.step*.035),red:angle(2.8+Math.floor(i/4)*1.7+(i%4)*.4+2.48)}));}
  emit(type,extra={}){this.events.push({id:++this.eventId,type,time:this.time,floor:this.floor,speed:this.velocity,...extra});if(this.events.length>16)this.events.shift();}
  drag(dx){this.rotation-=dx*.012;}
  ring(){return this.rings[this.floor%this.rings.length];}
  inArc(a,start,size){return angle(a-start)<size;}
  passFloor(smash=false){const crossed=this.floor;this.emit(smash?'smash':'drop',{streak:this.streak,rotation:this.rotation});if(smash){this.broken.add(crossed);this.charged=false;this.streak=0;this.message='SMASH! 赤い床も突破';this.pop=.45;}else{this.streak++;this.charged=this.streak>=3;this.message=this.charged?'FIREBALL! 次の床を突き破れ':this.streak+'段連続！ あと'+(3-this.streak)+'段で炎';this.pop=.18;}this.floor++;this.depth++;this.score+=smash?50:10*Math.max(1,this.streak);this.ball-=1;for(const i of this.broken)if(i<this.floor-10)this.broken.delete(i);}
  update(dt){dt=Math.max(0,Math.min(dt,.05));this.time+=dt;this.flash=Math.max(0,this.flash-dt);this.pop=Math.max(0,this.pop-dt);if(this.dead){this.dead=Math.max(0,this.dead-dt);if(!this.dead){this.attempt++;this.resetAttempt();this.emit('restart');}return;}this.rotation-=((this.keys.has('ArrowRight')||this.keys.has('KeyD')?1:0)-(this.keys.has('ArrowLeft')||this.keys.has('KeyA')?1:0))*dt*3.1;
    // Small integration steps plus swept floor crossings preserve momentum and prevent tunnelling.
    for(let remaining=dt;remaining>1e-8;){const step=Math.min(remaining,1/120);remaining-=step;this.ball+=this.velocity*step+4.8*step*step;this.velocity=Math.min(14,this.velocity+9.6*step);while(this.ball>=0&&this.velocity>0){const a=angle(Math.PI/2-this.rotation),r=this.ring();if(this.inArc(a,r.gap,r.gapWidth)){this.passFloor();continue;}if(this.charged){this.passFloor(true);continue;}if(this.inArc(a,r.red,.58)){this.hits++;this.dead=.65;this.flash=.65;this.emit('hazard');this.message='赤い床！ もう一度';this.streak=0;this.velocity=0;this.ball=0;return;}this.emit('bounce');this.streak=0;this.charged=false;this.ball=0;this.velocity=-3.1;this.message='すき間をつないで、3段連続を狙おう';}}
  }
}
