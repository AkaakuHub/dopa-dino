export const AD_GAMES = [
  {id:'snow',name:'FROSTFIRE CAMP',tag:'その薪で、街を救え。',hint:'雪原をドラッグして移動。木で薪を集め、中央の炉へ！',keys:'矢印 / WASD で移動',accent:'#f78835'},
  {id:'hole',name:'CITY FEAST',tag:'ビルまで、丸のみ。',hint:'ドラッグで穴を動かそう。小さな物から食べて巨大化！',keys:'矢印 / WASD で移動',accent:'#d3ff45'},
  {id:'helix',name:'SPIRAL DROP',tag:'あと一段、落とせる？',hint:'左右にドラッグで回転。3段連続で落ちると、次の床を突き破る！',keys:'← → / A D で回転',accent:'#ffd63d'}
];
// One randomly ordered visit to each game per round, with no repeat at a round boundary.
export class AdShuffleBag {
  constructor(random=Math.random){this.random=random;this.bag=[];this.last=null;}
  next(){if(!this.bag.length){this.bag=AD_GAMES.map(g=>g.id);for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}if(this.bag[0]===this.last){const j=1+Math.floor(this.random()*(this.bag.length-1));[this.bag[0],this.bag[j]]=[this.bag[j],this.bag[0]];}}this.last=this.bag.shift();return this.last;}
}
export class AdSession {
  constructor(kind){this.kind=kind;this.elapsed=0;this.closed=false;this.model=kind==='snow'?new SnowCamp():kind==='hole'?new HoleCity():new HelixTower();}
  get ready(){return this.elapsed>=5&&!this.closed;}
  get remaining(){return Math.max(0,Math.ceil(5-this.elapsed));}
  update(dt,active=true){if(this.closed||!active)return;this.elapsed+=Math.max(0,dt);this.model.update(Math.min(Math.max(dt,0),.05));}
  close(){if(!this.ready)return false;this.closed=true;return true;}
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function move(p,target,keys,dt,speed,bounds){let dx=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),dz=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);if(dx||dz){p.target=null;const n=Math.hypot(dx,dz);p.x+=dx/n*speed*dt;p.z+=dz/n*speed*dt;}else if(target){dx=target.x-p.x;dz=target.z-p.z;const d=Math.hypot(dx,dz),s=Math.min(d,speed*dt);if(d>.04){p.x+=dx/d*s;p.z+=dz/d*s;}}p.x=clamp(p.x,-bounds,bounds);p.z=clamp(p.z,-bounds,bounds);}
export class SnowCamp {
  constructor(){this.time=0;this.keys=new Set();this.player={x:0,z:3,target:null};this.wood=0;this.delivered=0;this.heat=26;this.level=1;this.warm=2;this.chop=0;this.pop=0;this.nodes=[{x:-3.8,z:1,logs:99},{x:3.5,z:2.6,logs:99},{x:-2.8,z:-3.8,logs:99},{x:3.4,z:-2.5,logs:99}];this.message='薪を集めて、炉に届けよう';}
  point(x,z){this.player.target={x:clamp(x,-5,5),z:clamp(z,-5,5)};}
  update(dt){this.time+=dt;this.pop=Math.max(0,this.pop-dt);move(this.player,this.player.target,this.keys,dt,4,5);this.heat=Math.max(4,this.heat-dt*.6);const node=this.nodes.find(n=>dist(n,this.player)<1.2);if(node&&this.wood<6){this.chop+=dt;if(this.chop>=.28){this.chop=0;this.wood++;this.pop=.4;this.message='薪 +1　中央の炉に届けよう';}}else this.chop=0;if(dist(this.player,{x:0,z:0})<1.3&&this.wood){this.delivered+=this.wood;this.heat=Math.min(100,this.heat+this.wood*9);this.wood=0;this.level=1+Math.floor(this.delivered/6);this.warm=Math.min(12,2+this.delivered);this.message=this.warm>=12?'みんな、あったかい！ 炉をもっと育てよう':'炉がレベルアップ！ 街が暖まった';this.pop=1;}}
}
export class HoleCity {
  constructor(){this.time=0;this.keys=new Set();this.player={x:-1,z:4.8,target:null};this.radius=.65;this.eaten=0;this.score=0;this.combo=0;this.pop=0;this.level=1;this.items=[];this.message='小さな街路樹から食べよう';this.makeCity();}
  makeCity(){let n=0;for(const bx of [-3,3])for(const bz of [-3,3])for(let k=0;k<4;k++){const x=bx+(k%2-.5)*1.7,z=bz+(Math.floor(k/2)-.5)*1.7;this.items.push({id:n++,x,z,type:'building',size:1.3,h:1.7+(n%5)*.57,color:['#ed9583','#7ba8d7','#ebc373','#b49bcc','#86bbc4'][n%5],fall:0,eaten:false});}for(let i=0;i<18;i++){const x=-4.8+(i%9)*1.2,z=i<9?4.9:-.75;this.items.push({id:n++,x,z,type:i%3===0?'cone':'tree',size:.35,h:i%3===0?.4:.9,color:'#72b66c',fall:0,eaten:false});}for(let i=0;i<8;i++)this.items.push({id:n++,x:i%2?-1:1,z:-4.2+Math.floor(i/2)*2.5,type:'car',size:.8,h:.7,color:['#efb847','#e5807e','#8eb8e0','#b09acd'][i%4],fall:0,eaten:false});for(let i=0;i<8;i++)this.items.push({id:n++,x:i%2?-4.5:4.5,z:-3.8+Math.floor(i/2)*2.4,type:'bench',size:.45,h:.7,color:'#b78655',fall:0,eaten:false});}
  point(x,z){this.player.target={x:clamp(x,-5,5),z:clamp(z,-5,5)};}
  update(dt){this.time+=dt;this.pop=Math.max(0,this.pop-dt);move(this.player,this.player.target,this.keys,dt,3.8,5);for(const o of this.items){if(o.eaten)continue;if(o.fall){o.fall+=dt*2.7;if(o.fall>=1){o.eaten=true;this.eaten++;this.score+=o.type==='building'?100:10;this.radius=Math.min(2.25,.65+this.eaten*.075);this.level=1+Math.floor(this.eaten/6);this.pop=.6;this.message=this.radius>=1.35?'巨大化！ ビルも飲み込める':'もっと食べて、もっと大きく';}continue;}if(o.size<=this.radius&&dist(o,this.player)<this.radius*.85)o.fall=.01;}if(this.items.every(o=>o.eaten)){this.items=[];this.makeCity();this.message='街を完食！ 次の街もいただきます';}}
}
const tau=Math.PI*2,angle=a=>((a%tau)+tau)%tau;
export class HelixTower {
  constructor(){this.time=0;this.keys=new Set();this.rotation=0;this.hits=0;this.attempt=1;this.eventId=0;this.events=[];this.resetAttempt();}
  resetAttempt(){this.floor=0;this.depth=0;this.ball=0;this.velocity=-3.1;this.streak=0;this.charged=false;this.score=0;this.flash=0;this.pop=0;this.dead=0;this.broken=new Set();this.message='3段続けて落ちると、炎で床を突き破る';this.rings=Array.from({length:24},(_,i)=>({gap:angle(2.8+Math.floor(i/4)*1.7+(i%4)*.4),gapWidth:1.72,red:angle(2.8+Math.floor(i/4)*1.7+(i%4)*.4+2.48)}));}
  emit(type,extra={}){this.events.push({id:++this.eventId,type,time:this.time,floor:this.floor,speed:this.velocity,...extra});if(this.events.length>16)this.events.shift();}
  drag(dx){this.rotation+=dx*.012;}
  ring(){return this.rings[this.floor%this.rings.length];}
  inArc(a,start,size){return angle(a-start)<size;}
  passFloor(smash=false){const crossed=this.floor;this.emit(smash?'smash':'drop',{streak:this.streak});if(smash){this.broken.add(crossed);this.charged=false;this.streak=0;this.message='SMASH! 赤い床も突破';this.pop=.45;}else{this.streak++;this.charged=this.streak>=3;this.message=this.charged?'FIREBALL! 次の床を突き破れ':this.streak+'段連続！ あと'+(3-this.streak)+'段で炎';this.pop=.18;}this.floor++;this.depth++;this.score+=smash?50:10*Math.max(1,this.streak);this.ball-=1;for(const i of this.broken)if(i<this.floor-10)this.broken.delete(i);}
  update(dt){dt=Math.max(0,Math.min(dt,.05));this.time+=dt;this.flash=Math.max(0,this.flash-dt);this.pop=Math.max(0,this.pop-dt);if(this.dead){this.dead=Math.max(0,this.dead-dt);if(!this.dead){this.attempt++;this.resetAttempt();this.emit('restart');}return;}this.rotation+=((this.keys.has('ArrowRight')||this.keys.has('KeyD')?1:0)-(this.keys.has('ArrowLeft')||this.keys.has('KeyA')?1:0))*dt*3.1;
    // Small integration steps plus swept floor crossings preserve momentum and prevent tunnelling.
    for(let remaining=dt;remaining>1e-8;){const step=Math.min(remaining,1/120);remaining-=step;this.ball+=this.velocity*step+4.8*step*step;this.velocity=Math.min(22,this.velocity+9.6*step);while(this.ball>=0&&this.velocity>0){const a=angle(Math.PI/2-this.rotation),r=this.ring();if(this.inArc(a,r.gap,r.gapWidth)){this.passFloor();continue;}if(this.charged){this.passFloor(true);continue;}if(this.inArc(a,r.red,.58)){this.hits++;this.dead=.65;this.flash=.65;this.emit('hazard');this.message='赤い床！ もう一度';this.streak=0;this.velocity=0;this.ball=0;return;}this.emit('bounce');this.streak=0;this.charged=false;this.ball=0;this.velocity=-3.1;this.message='すき間をつないで、3段連続を狙おう';}}
  }
}
