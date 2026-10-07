// Two self-contained games. All gameplay state is renderer-independent and bounded.
import { inflationForRound, makeRiskReward, armRiskReward, settleRiskReward } from './ad-inflation.js';
export const GAME_META = [
  {id:'golf',name:'POCKET PUTT',hint:'ボールから後ろへドラッグして、離すとショット',keys:'← → / A D で照準 · ↑ ↓ で強さ · Space で打つ',accent:'#83f0bf'},
  {id:'breaker',name:'NEON BREAKER',hint:'左右にドラッグしてパドルを動かす · タップで発射',keys:'← → / A D で移動 · Space で発射',accent:'#74eaff'}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const length=(x,z)=>Math.hypot(x,z);
const bounds={x:3.8,z:5.4};
const golfLayouts=[
  {par:2,start:[-1.75,4.2],hole:[1.7,-4.15],blocks:[[-.6,-.2,4.3,.48]],sand:[[2.35,1.35,1.6,1.4]],ramps:[]},
  {par:3,start:[2.25,4.25],hole:[-2.1,-4.15],blocks:[[1.35,1.2,4.55,.46],[-1.3,-1.75,4.6,.46]],sand:[],ramps:[[0,-.1,3,1.45,.43]]},
  {par:2,start:[0,4.2],hole:[0,-4.2],blocks:[[-2.55,-.55,1.6,.55],[2.55,-.55,1.6,.55]],sand:[[-1.9,2,2,1.1],[2,-2.65,1.8,1.2]],ramps:[[0,-.65,2.2,2.65,.58]]},
  {par:3,start:[-2.4,4.15],hole:[2.3,-4.15],blocks:[[-.75,1.8,.5,3.35],[.85,-2,.5,3.4]],sand:[[-2.25,-1.55,1.6,1.5],[2.3,1.7,1.5,1.3]],ramps:[]},
  {par:2,start:[2.25,4.2],hole:[-2.25,-4.1],blocks:[[0,-.8,3.65,.6]],sand:[[0,2.45,3.6,1.2]],ramps:[[-2.55,-1.05,1.3,2,.38]]},
  {par:3,start:[0,4.25],hole:[0,-4.3],blocks:[[-2.45,2,2.7,.42],[2.45,.4,2.7,.42],[-2.45,-1.3,2.7,.42],[2.45,-2.8,2.7,.42]],sand:[],ramps:[[0,1.15,1.6,1.6,.32]]}
];

function circleBox(p,box,r,restitution=.77){
  const x0=box.x-box.w/2,x1=box.x+box.w/2,z0=box.z-box.d/2,z1=box.z+box.d/2;
  const qx=clamp(p.x,x0,x1),qz=clamp(p.z,z0,z1);let dx=p.x-qx,dz=p.z-qz,d=length(dx,dz);
  if(d>=r)return false;
  if(d<1e-8){const sides=[{d:Math.abs(p.x-x0),x:-1,z:0},{d:Math.abs(x1-p.x),x:1,z:0},{d:Math.abs(p.z-z0),x:0,z:-1},{d:Math.abs(z1-p.z),x:0,z:1}].sort((a,b)=>a.d-b.d);dx=sides[0].x;dz=sides[0].z;d=0;p.x+=dx*(sides[0].d+r+.001);p.z+=dz*(sides[0].d+r+.001);}
  else{dx/=d;dz/=d;p.x+=dx*(r-d+.001);p.z+=dz*(r-d+.001);}
  const approach=p.vx*dx+p.vz*dz;if(approach<0){p.vx-=(1+restitution)*approach*dx;p.vz-=(1+restitution)*approach*dz;}return true;
}

export class PocketGolf {
  constructor(round=1){this.round=Math.max(1,Math.floor(Number.isFinite(round)?round:1));this.inflation=inflationForRound(this.round);this.keys=new Set();this.time=0;this.holeNumber=1;this.totalStrokes=0;this.totalPar=0;this.score=0;this.events=[];this.eventId=0;this.aim=0;this.power=.55;this.message='';this.messageTime=0;this.makeHole();}
  emit(type,data={}){this.events.push({id:++this.eventId,type,time:this.time,...data});if(this.events.length>18)this.events.shift();}
  say(text,seconds=1.7){this.message=text;this.messageTime=seconds;}
  makeHole(){const layout=golfLayouts[(this.holeNumber-1)%golfLayouts.length],flip=Math.floor((this.holeNumber-1)/golfLayouts.length)%2?-1:1;
    this.par=layout.par;this.ball={x:layout.start[0]*flip,z:layout.start[1],vx:0,vz:0};this.cup={x:layout.hole[0]*flip,z:layout.hole[1]};
    this.blocks=layout.blocks.map(([x,z,w,d])=>({x:x*flip,z,w,d}));this.sand=layout.sand.map(([x,z,w,d])=>({x:x*flip,z,w,d}));this.ramps=layout.ramps.map(([x,z,w,d,h])=>({x:x*flip,z,w,d,h}));
    this.strokes=0;this.sinking=0;this.dragging=false;this.aim=Math.atan2(this.cup.x-this.ball.x,this.ball.z-this.cup.z);this.power=.55;this.ballSpin=0;this.lastShot=0;this.restTime=0;
  }
  get speed(){return length(this.ball.vx,this.ball.vz);}
  get canShoot(){return !this.sinking&&this.speed<.035;}
  get stats(){return [['HOLE',String(this.holeNumber)],['STROKES',`${this.strokes} / PAR ${this.par}`],['SCORE',this.score===0?'EVEN':`${this.score>0?'+':''}${this.score}`]];}
  terrainAt(x,z){for(const q of this.ramps)if(Math.abs(x-q.x)<q.w/2&&Math.abs(z-q.z)<q.d/2){const t=(z-q.z)/q.d+.5;return {height:Math.sin(t*Math.PI)*q.h,slope:Math.cos(t*Math.PI)*q.h*Math.PI/q.d};}return {height:0,slope:0};}
  get ballHeight(){return this.terrainAt(this.ball.x,this.ball.z).height;}
  inSand(x=this.ball.x,z=this.ball.z){return this.sand.some(q=>Math.abs(x-q.x)<q.w/2&&Math.abs(z-q.z)<q.d/2);}
  pointerDown(u,v,world){if(!this.canShoot)return;const p=world||{x:u*5,z:-v*6};if(length(p.x-this.ball.x,p.z-this.ball.z)>1.25)return;this.dragging=true;this.dragAnchor={x:this.ball.x,z:this.ball.z};this.dragPoint={...p};this.dragPower=0;}
  pointerMove(u,v,world){if(!this.dragging)return;const p=world||{x:u*5,z:-v*6},dx=this.dragAnchor.x-p.x,dz=this.dragAnchor.z-p.z;this.dragPoint={...p};this.dragPower=clamp(length(dx,dz)/3.25,0,1);if(this.dragPower>.015)this.aim=Math.atan2(dx,-dz);this.power=this.dragPower;}
  pointerUp(u,v,world){if(!this.dragging)return;if(world)this.pointerMove(u,v,world);this.dragging=false;if(this.dragPower>.035)this.shoot();}
  pointerCancel(){this.dragging=false;this.dragPower=0;}
  action(code){if(code==='Space')this.shoot();}
  shoot(){if(!this.canShoot)return false;const velocity=1.35+clamp(this.power,0,1)*10.7;this.ball.vx=Math.sin(this.aim)*velocity;this.ball.vz=-Math.cos(this.aim)*velocity;this.strokes++;this.lastShot=this.time;this.restTime=0;this.dragging=false;this.emit('shot',{x:this.ball.x,z:this.ball.z,power:this.power});this.message='';this.messageTime=0;return true;}
  sink(){if(this.sinking)return;this.sinking=.85;this.ball.vx=this.ball.vz=0;this.dragging=false;this.totalStrokes+=this.strokes;this.totalPar+=this.par;this.score=this.totalStrokes-this.totalPar;const delta=this.strokes-this.par;this.say(this.strokes===1?'HOLE IN ONE!':delta<0?'BIRDIE!':delta===0?'PAR!':'NICE PUTT!',1.7);this.emit('cup',{x:this.cup.x,z:this.cup.z,strokes:this.strokes});}
  // Cheap dotted trajectory preview includes the first banks, so the geometry is readable.
  aimPath(){const p={x:this.ball.x,z:this.ball.z,vx:Math.sin(this.aim)*(1.35+this.power*10.7),vz:-Math.cos(this.aim)*(1.35+this.power*10.7)},points=[];for(let i=0;i<42;i++){const dt=.049;p.x+=p.vx*dt;p.z+=p.vz*dt;this.resolveWalls(p,false);for(const b of this.blocks)circleBox(p,b,.16);const speed=length(p.vx,p.vz),drag=(this.inSand(p.x,p.z)?3.8:1.12)*this.inflation.difficulty,scale=Math.max(0,1-drag*dt/Math.max(.01,speed)-.38*dt);p.vx*=scale;p.vz*=scale;points.push({x:p.x,z:p.z,h:this.terrainAt(p.x,p.z).height});if(speed<.13)break;}return points;}
  resolveWalls(p,events=true){let hit=false;for(const axis of ['x','z']){const limit=bounds[axis]-.16,v=axis==='x'?'vx':'vz';if(p[axis]<-limit){p[axis]=-limit;p[v]=Math.abs(p[v])*.8;hit=true;}else if(p[axis]>limit){p[axis]=limit;p[v]=-Math.abs(p[v])*.8;hit=true;}}if(hit&&events&&this.time-(this.lastBank||-1)>.06){this.lastBank=this.time;this.emit('bank',{x:p.x,z:p.z});}}
  update(dt){dt=clamp(Number.isFinite(dt)?dt:0,0,.05);this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);if(!this.messageTime)this.message='';
    if(this.sinking){this.sinking=Math.max(0,this.sinking-dt);this.ball.x+=(this.cup.x-this.ball.x)*Math.min(1,dt*12);this.ball.z+=(this.cup.z-this.ball.z)*Math.min(1,dt*12);if(!this.sinking){this.holeNumber++;this.makeHole();this.emit('hole');}return;}
    if(this.canShoot&&!this.dragging){const turn=(this.keys.has('ArrowRight')||this.keys.has('KeyD')?1:0)-(this.keys.has('ArrowLeft')||this.keys.has('KeyA')?1:0),charge=(this.keys.has('ArrowUp')||this.keys.has('KeyW')?1:0)-(this.keys.has('ArrowDown')||this.keys.has('KeyS')?1:0);this.aim+=turn*dt*1.65;this.power=clamp(this.power+charge*dt*.45,.08,1);}
    for(let remain=dt;remain>1e-8;){const step=Math.min(remain,1/180);remain-=step;let speed=this.speed;if(speed<.035){this.ball.vx=this.ball.vz=0;if(length(this.ball.x-this.cup.x,this.ball.z-this.cup.z)<.25&&this.strokes)this.sink();break;}
      this.ball.x+=this.ball.vx*step;this.ball.z+=this.ball.vz*step;this.ballSpin+=speed*step/.16;this.resolveWalls(this.ball);for(const b of this.blocks)if(circleBox(this.ball,b,.16)&&this.time-(this.lastBank||-1)>.08){this.lastBank=this.time;this.emit('bank',{x:this.ball.x,z:this.ball.z});}
      const terrain=this.terrainAt(this.ball.x,this.ball.z);this.ball.vz-=terrain.slope*4.8*step;
      speed=this.speed;const friction=this.inSand()?4.6*this.inflation.difficulty:1.12*this.inflation.difficulty,scale=Math.max(0,1-friction*step/Math.max(speed,.01)-.38*step);this.ball.vx*=scale;this.ball.vz*=scale;
      const cupDistance=length(this.ball.x-this.cup.x,this.ball.z-this.cup.z);if(cupDistance<.29&&this.speed<4.1&&this.strokes){this.sink();break;}if(cupDistance<.52&&this.speed<2.2&&cupDistance>.02){this.ball.vx+=(this.cup.x-this.ball.x)/cupDistance*step*2.7;this.ball.vz+=(this.cup.z-this.ball.z)/cupDistance*step*2.7;}
    }
    if(!this.sinking&&this.time-this.lastShot>15&&this.speed<.3){this.ball.vx=this.ball.vz=0;}
  }
}

export class NeonBreaker {
  constructor(round = 1){
    this.keys=new Set();this.time=0;this.eventId=0;this.events=[];this.best=0;this.attempt=1;
    this.round=Math.max(1,Math.floor(Number.isFinite(round)?round:1));
    this.inflation=inflationForRound(this.round);this.message='';this.messageTime=0;this.reset();
  }
  get ball(){return this.balls[0]||null;}
  set ball(value){if(value)this.balls[0]=value;else this.balls.shift();}
  get difficultyScale(){return this.inflation.difficulty;}
  get multiball(){return Math.max(0,this.balls.length-1);}
  get riskMultiplier(){return this.riskReward?.multiplier||1;}
  get scoreMultiplier(){return this._scoreMultiplier||1;}
  set scoreMultiplier(value){this._scoreMultiplier=Math.max(1,Math.min(16,Number.isFinite(value)?value:1));}
  get stats(){return [['WAVE',String(this.wave)],['SCORE',String(this.score)],['LIVES','♥'.repeat(this.lives)]];}
  say(text,seconds=1.5){this.message=text;this.messageTime=seconds;}
  emit(type,data={}){this.events.push({id:++this.eventId,type,time:this.time,...data});if(this.events.length>22)this.events.shift();}
  reset(){
    this.wave=1;this.score=0;this.lives=3;this.combo=0;this.chain=0;this.scoreMultiplier=this.inflation.reward;
    this.paddle={x:0,z:4.95,w:1.9,target:0,vx:0};
    this.power={wide:0,fire:0,slow:0,multi:0};this.pickups=[];this.trail=[];this.balls=[];
    this.riskReward=makeRiskReward(2);this.risk=this.riskReward;this.riskBonus=1;
    this.dead=0;this.wavePause=0;this.makeWave();this.prepareBall(1.05);
  }
  makeWave(){
    this.bricks=[];
    const rows=4+Math.min(2,Math.floor((this.wave-1+this.inflation.step)/2)),pattern=(this.wave-1)%4;
    let id=0;
    for(let row=0;row<rows;row++)for(let col=0;col<7;col++){
      const skip=pattern===1&&(row+col)%4===0||pattern===2&&Math.abs(col-3)>2+row%2||pattern===3&&row%2===1&&(col===1||col===5);if(skip)continue;
      const armor=this.wave>1&&(row+col+this.wave+this.inflation.step)%4===0?Math.min(3,2+Math.floor(this.inflation.step/8)):1;
      this.bricks.push({id:id++,x:(col-3)*1.25,z:-4.65+row*.73,w:1.1,d:.56,hp:armor,maxHp:armor,color:(row+this.wave-1)%5,hit:0});
    }
    this.waveBricks=this.bricks.length;this.pickups.length=0;this.destroyed=0;
  }
  prepareBall(delay=.65){this.balls=[{x:this.paddle.x,z:this.paddle.z-.44,vx:0,vz:0,r:.16}];this.serving=delay;this.trail.length=0;}
  baseSpeed(){return Math.min(15.2,(6.6+(this.wave-1)*.46+this.destroyed*.035)*this.inflation.speed*(this.power.slow>0?.73:1));}
  launch(){if(this.dead||this.wavePause||this.serving===0||!this.balls.length)return false;this.serving=0;const angle=.22*Math.sin(this.wave*1.7+this.attempt);const speed=this.baseSpeed();for(const ball of this.balls){ball.vx=Math.sin(angle)*speed;ball.vz=-Math.cos(angle)*speed;}if(this.power.multi>0&&this.balls.length===1)this.spawnMultiball();this.emit('launch',{x:this.ball.x,z:this.ball.z,balls:this.balls.length});this.message='';return true;}
  chooseRisk(multiplier=2){this.riskReward.multiplier=Math.max(2,Math.min(4,Math.floor(Number.isFinite(multiplier)?multiplier:2)));return armRiskReward(this.riskReward,1);}
  armRisk(multiplier=2){return this.chooseRisk(multiplier);}
  action(code){if(code==='Space')return this.launch();if(code==='KeyR'||code==='KeyX')return this.chooseRisk(2);return false;}
  pointerDown(u,v,world){this.pointerMove(u,v,world);this.launch();}
  pointerMove(u,v,world){this.paddle.target=clamp(world?.x??u*5,-4.5+this.paddle.w/2,4.5-this.paddle.w/2);}
  pointerUp(){}
  scorePoints(points){this.score+=Math.max(0,Math.round(points*this.scoreMultiplier));this.best=Math.max(this.best,this.score);}
  updateMultiplier(){this.scoreMultiplier=Math.min(16,this.inflation.reward*(1+Math.min(20,this.combo)*.08)*(1+Math.min(12,this.chain)*.12));}
  spawnMultiball(){
    if(this.serving||this.dead||!this.balls.length)return false;
    const source=this.balls[0],speed=Math.max(1,this.baseSpeed());
    while(this.balls.length<3){const sign=this.balls.length===1?-1:1,angle=Math.atan2(source.vx,-source.vz)+sign*.2;this.balls.push({x:source.x,z:source.z,vx:Math.sin(angle)*speed,vz:-Math.cos(angle)*speed,r:.16});}
    this.power.multi=9;this.emit('multiball',{balls:this.balls.length});this.say('MULTIBALL ×'+this.balls.length,1.2);return true;
  }
  hitBrick(b,ball=this.ball){b.hp--;b.hit=.16;if(b.hp<=0){this.destroyed++;this.combo++;this.updateMultiplier();this.scorePoints(10*this.wave+Math.min(this.combo,12)*2);this.emit('brick',{x:b.x,z:b.z,color:b.color,multiplier:this.scoreMultiplier});if((b.id+this.wave*2+this.inflation.step)%6===0&&this.pickups.length<6){const kinds=['wide','fire','slow','multi'];const kind=kinds[(Math.floor(b.id/6)+this.wave-1+this.inflation.step)%kinds.length];this.pickups.push({x:b.x,z:b.z,kind,phase:b.id*.7});}}else{this.scorePoints(4);this.emit('armor',{x:b.x,z:b.z,color:b.color});}}
  collect(p){const kind=p.kind==='multiball'?'multi':p.kind;if(!['wide','fire','slow','multi'].includes(kind))return false;if(kind==='multi'){this.power.multi=9;this.spawnMultiball();}else this.power[kind]=kind==='wide'?11:kind==='fire'?8:7;this.scorePoints(25);this.say(kind==='wide'?'WIDE PADDLE':kind==='fire'?'FIREBALL!':kind==='multi'?'MULTIBALL!':'SLOW MOTION',1.5);this.emit('power',{x:p.x,z:p.z,kind:kind});return true;}
  lose(){
    if(this.dead)return;this.lives--;this.combo=0;this.updateMultiplier();this.emit('loss',{x:this.ball?.x??0,z:5.8});
    this.balls.length=0;
    if(this.lives<=0){this.best=Math.max(this.best,this.score);this.riskBonus=settleRiskReward(this.riskReward,false);this.dead=1.2;this.serving=0;this.say('REBOOT · TRY AGAIN',1.2);}
    else{this.say('READY FOR THE REBOUND',1);this.prepareBall(.9);}
  }
  stepBall(ball,step){
    const oldZ=ball.z;ball.x+=ball.vx*step;ball.z+=ball.vz*step;
    if(ball.x<-4.5+ball.r){ball.x=-4.5+ball.r;ball.vx=Math.abs(ball.vx);this.emit('wall',{x:ball.x,z:ball.z});}
    else if(ball.x>4.5-ball.r){ball.x=4.5-ball.r;ball.vx=-Math.abs(ball.vx);this.emit('wall',{x:ball.x,z:ball.z});}
    if(ball.z<-5.55+ball.r){ball.z=-5.55+ball.r;ball.vz=Math.abs(ball.vz);this.emit('wall',{x:ball.x,z:ball.z});}
    if(ball.vz>0&&oldZ<=this.paddle.z-.17-ball.r&&ball.z>=this.paddle.z-.17-ball.r&&Math.abs(ball.x-this.paddle.x)<=this.paddle.w/2+ball.r){const offset=clamp((ball.x-this.paddle.x)/(this.paddle.w/2),-1,1),angle=offset*1.04+clamp(this.paddle.vx*.009,-.12,.12),speed=this.baseSpeed();ball.z=this.paddle.z-.17-ball.r-.003;ball.vx=Math.sin(angle)*speed;ball.vz=-Math.max(.43,Math.cos(angle))*speed;this.combo=0;this.updateMultiplier();this.emit('paddle',{x:ball.x,z:ball.z});}
    for(const b of this.bricks){if(b.hp<=0||b.hit>.145)continue;const vx=ball.vx,vz=ball.vz;if(circleBox(ball,b,ball.r,1)){if(this.power.fire>0){ball.vx=vx;ball.vz=vz;b.hp=1;}this.hitBrick(b,ball);break;}}
    const speed=length(ball.vx,ball.vz),desired=this.baseSpeed();if(speed>.01){ball.vx*=desired/speed;ball.vz*=desired/speed;}if(Math.abs(ball.vz)<desired*.2){ball.vz=(ball.vz>=0?1:-1)*desired*.2;ball.vx=(ball.vx>=0?1:-1)*Math.sqrt(Math.max(0,desired*desired-ball.vz*ball.vz));}
    return ball.z>6.1;
  }
  update(dt){
    dt=clamp(Number.isFinite(dt)?dt:0,0,.05);this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);if(!this.messageTime)this.message='';for(const b of this.bricks)b.hit=Math.max(0,b.hit-dt);
    if(this.dead){this.dead=Math.max(0,this.dead-dt);if(!this.dead){this.attempt++;this.reset();this.emit('restart');}return;}
    for(const key of Object.keys(this.power))this.power[key]=Math.max(0,this.power[key]-dt);this.paddle.w=this.power.wide>0?3:1.9;
    const dir=(this.keys.has('ArrowRight')||this.keys.has('KeyD')?1:0)-(this.keys.has('ArrowLeft')||this.keys.has('KeyA')?1:0);if(dir)this.paddle.target=this.paddle.x+dir*dt*11;this.paddle.target=clamp(this.paddle.target,-4.5+this.paddle.w/2,4.5-this.paddle.w/2);const dx=clamp(this.paddle.target-this.paddle.x,-dt*18,dt*18);this.paddle.x+=dx;this.paddle.vx=dt?dx/dt:0;
    if(this.wavePause){this.wavePause=Math.max(0,this.wavePause-dt);if(!this.wavePause){this.wave++;this.chain++;this.makeWave();this.prepareBall(.7);this.updateMultiplier();this.emit('wave',{wave:this.wave,chain:this.chain,multiplier:this.scoreMultiplier});}return;}
    if(this.serving){for(const ball of this.balls){ball.x=this.paddle.x;ball.z=this.paddle.z-.44;}this.serving=Math.max(0.000001,this.serving-dt);if(this.serving<=.000001)this.launch();return;}
    for(let i=this.pickups.length-1;i>=0;i--){const p=this.pickups[i];p.z+=dt*2;if(Math.abs(p.z-this.paddle.z)<.45&&Math.abs(p.x-this.paddle.x)<this.paddle.w/2+.27){this.collect(p);this.pickups.splice(i,1);}else if(p.z>6.4)this.pickups.splice(i,1);}
    for(let remain=dt;remain>1e-8;){const step=Math.min(remain,1/200);remain-=step;for(let i=this.balls.length-1;i>=0;i--){if(this.stepBall(this.balls[i],step)){this.balls.splice(i,1);if(!this.balls.length){this.lose();break;}}}if(this.destroyed===this.waveBricks){this.wavePause=1.15;this.riskBonus=settleRiskReward(this.riskReward,true);this.scorePoints(100*this.wave*this.riskBonus);this.say('WAVE CLEAR!',1.4);this.emit('clear',{wave:this.wave,multiplier:this.scoreMultiplier,risk:this.riskBonus});break;}if(this.dead)break;}
    this.trail.unshift({x:this.ball?.x??0,z:this.ball?.z??0});if(this.trail.length>16)this.trail.pop();
  }
}
export const GAME_MODELS={golf:PocketGolf,breaker:NeonBreaker};
