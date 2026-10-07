export const STAGES = [
  {id:'city',name:'NEON CITY',label:'ネオンシティ',tag:'夜の街をぶっちぎれ',gravity:1750,jump:650,color:'#64e7de'},
  {id:'desert',name:'SUNSET DUNES',label:'サンセット砂漠',tag:'砂煙を置き去りに',gravity:1750,jump:650,color:'#ffbb70'},
  {id:'space',name:'LUNAR ORBIT',label:'宇宙・月面',tag:'低重力！ふわっと大ジャンプ',gravity:1000,jump:540,color:'#b7a1ff'},
  {id:'aurora',name:'AURORA RUSH',label:'オーロラ氷原',tag:'極彩色のラストスパート',gravity:1500,jump:615,color:'#82f5cb'}
];
export class RunnerGame {
  constructor({width=1000,height=420,random=Math.random,onEvent=()=>{}}={}){this.width=width;this.height=height;this.random=random;this.onEvent=onEvent;this.state='ready';this.reset();}
  reset(){Object.assign(this,{score:0,distance:0,coins:0,combo:0,maxCombo:0,comboTime:0,charge:0,fever:0,elapsed:0,spawnTime:1.8,obstacles:[],pickups:[],boostEnergy:100,boostTime:0,boostCooldown:0,boosts:0,shield:0,stageIndex:0,stageBanner:0,stageClears:0,currentSpeed:this.width<800?230:295,nextId:1,revivesUsed:0});this.ground=this.height-76;this.dino={x:100,y:this.ground,vy:0,jumps:0,duck:false};}
  emit(type,data={}){this.onEvent({type,...data});}
  get stage(){return STAGES[this.stageIndex%STAGES.length];}
  get stageProgress(){return (this.distance%600)/600;}
  get lap(){return Math.floor(this.stageIndex/STAGES.length)+1;}
  get maxSpeed(){return this.width<800?490:820;}
  get targetSpeed(){return Math.min(this.maxSpeed,(295+Math.min(235,this.elapsed*2.4))*(this.width<800?.78:1)*(this.boostTime>0?1.72:1)*(this.fever>0?1.08:1));}
  get speed(){return this.currentSpeed;}
  get gravity(){return this.stage.gravity;}
  get powered(){return this.boostTime>0||this.fever>0;}
  get protected(){return this.powered||this.shield>0;}
  get canBoost(){return this.state==='running'&&this.boostTime===0&&this.boostCooldown===0&&this.boostEnergy>=100;}
  start(){this.reset();this.state='running';this.emit('start');}
  title(){this.reset();this.state='ready';this.emit('title');}
  pause(){if(this.state==='running'){this.state='paused';this.dino.duck=false;this.emit('pause');}}
  resume(){if(this.state==='paused'){this.state='running';this.emit('resume');}}
  beginAd(){if(this.state!=='over')return false;this.state='ad';this.emit('ad');return true;}
  revive(){if(this.state!=='ad')return false;this.revivesUsed++;this.obstacles=[];this.pickups=[];this.spawnTime=2;this.shield=3;this.dino.y=this.ground;this.dino.vy=0;this.dino.jumps=0;this.dino.duck=false;this.comboTime=Math.max(this.comboTime,3);this.currentSpeed=Math.min(this.currentSpeed,this.width<800?260:330);this.state='running';this.emit('revive');return true;}
  boost(){if(!this.canBoost)return false;this.boostEnergy=0;this.boostTime=2.6;this.boosts++;this.emit('boost');return true;}
  jump(){if(this.state!=='running'||this.dino.jumps>=2)return false;this.dino.duck=false;this.dino.vy=-this.stage.jump*(this.dino.jumps===0?1:.87);this.dino.jumps++;this.emit('jump',{double:this.dino.jumps===2});return true;}
  duck(value){if(this.state==='running'){this.dino.duck=value;if(value&&this.dino.y<this.ground)this.dino.vy=Math.max(this.dino.vy,550);}}
  get box(){const d=this.dino;return d.duck&&d.y>=this.ground-1?{x:d.x+5,y:d.y-26,w:60,h:24}:{x:d.x+8,y:d.y-52,w:34,h:47};}
  spawn(){const safeGap=this.maxSpeed*(this.gravity<1200?2.05:1.62),x=this.width+60;const last=this.obstacles.at(-1);if(last&&x-(last.x+last.w)<safeGap){this.spawnTime=.1;return false;}let type=this.elapsed>13&&this.random()<.28?'bird':'cactus';const h=type==='bird'?30:40+Math.floor(this.random()*15),w=type==='bird'?46:26+Math.floor(this.random()*13);this.obstacles.push({id:this.nextId++,type,x,y:this.ground-(type==='bird'?64:h),w,h,passed:false});for(let i=0;i<7;i++){this.pickups.push({id:this.nextId++,x:x-90+i*35,y:type==='bird'?this.ground-17:this.ground-79-Math.sin(i/6*Math.PI)*45,r:11});}this.spawnTime=1.5+this.random()*.5;return true;}
  collect(c){this.coins++;this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);this.comboTime=4.5;const multiplier=1+Math.floor(Math.min(this.combo,40)/5);this.score+=10*multiplier*(this.fever>0?2:1)*(this.boostTime>0?2:1);if(this.boostTime===0)this.boostEnergy=Math.min(100,this.boostEnergy+5);if(this.fever<=0){this.charge+=12.5;if(this.charge>=100){this.charge=0;this.fever=6;this.emit('fever');}}this.emit('coin',{x:c.x,y:c.y,multiplier});}
  advanceStage(){const next=Math.floor(this.distance/600);if(next===this.stageIndex)return;this.stageIndex=next;this.stageClears=next;this.stageBanner=2.8;this.shield=Math.max(this.shield,1.2);this.obstacles=[];this.pickups=[];this.spawnTime=1.4;this.score+=250;this.boostEnergy=Math.min(100,this.boostEnergy+35);this.emit('stage',{stage:this.stage,index:next});}
  update(dt){if(this.state!=='running')return;dt=Math.min(Math.max(dt,0),.035);this.elapsed+=dt;const target=this.targetSpeed;this.currentSpeed+=(target-this.currentSpeed)*Math.min(1,dt*(this.boostTime>0?3:2));this.currentSpeed=Math.min(this.maxSpeed,this.currentSpeed);this.distance+=this.speed*dt/10;this.score+=dt*10*(this.fever>0?2:1)*(this.boostTime>0?2:1);this.advanceStage();this.stageBanner=Math.max(0,this.stageBanner-dt);this.shield=Math.max(0,this.shield-dt);this.comboTime=Math.max(0,this.comboTime-dt);if(!this.comboTime)this.combo=0;
    if(this.boostTime>0){this.boostTime=Math.max(0,this.boostTime-dt);if(!this.boostTime){this.boostCooldown=3;this.shield=Math.max(this.shield,.6);this.emit('boostEnd');}}else{this.boostCooldown=Math.max(0,this.boostCooldown-dt);this.boostEnergy=Math.min(100,this.boostEnergy+dt*10);}
    if(this.fever>0){this.fever=Math.max(0,this.fever-dt);if(!this.fever){this.shield=Math.max(this.shield,.45);this.emit('feverEnd');}}
    const d=this.dino;d.vy+=this.gravity*dt;d.y+=d.vy*dt;if(d.y<65){d.y=65;d.vy=Math.max(0,d.vy);}if(d.y>=this.ground){d.y=this.ground;d.vy=0;d.jumps=0;}this.spawnTime-=dt;if(this.spawnTime<=0)this.spawn();const speed=this.speed;
    for(const c of this.pickups){c.x-=speed*dt;if(this.powered&&c.x<d.x+290&&c.x>d.x-55){c.x+=(d.x+25-c.x)*dt*13;c.y+=(d.y-35-c.y)*dt*13;}const b=this.box;if(c.x+c.r>b.x&&c.x-c.r<b.x+b.w&&c.y+c.r>b.y&&c.y-c.r<b.y+b.h){c.hit=true;this.collect(c);}}this.pickups=this.pickups.filter(c=>!c.hit&&c.x>-20);
    for(const o of this.obstacles){o.x-=speed*dt;const b=this.box;if(b.x+b.w>o.x+4&&b.x<o.x+o.w-4&&b.y+b.h>o.y+4&&b.y<o.y+o.h-4){if(this.protected){o.hit=true;this.score+=this.powered?50:0;this.emit('smash',{x:o.x,y:o.y,points:this.powered?50:0});}else{this.state='over';this.dino.duck=false;this.emit('over');break;}}if(!o.hit&&o.x+o.w<d.x&&!o.passed){o.passed=true;this.score+=25;this.emit('dodge',{x:d.x,y:d.y-70});}}this.obstacles=this.obstacles.filter(o=>!o.hit&&o.x+o.w>-10);
  }
}
