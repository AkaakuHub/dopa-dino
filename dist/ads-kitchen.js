// NORTH CAMP KITCHEN: a compact Overcooked-inspired pass-the-order game.
// The model is renderer independent and deliberately bounded: one cook, four
// stations and three active orders. A round is one attempt; no replay state is
// kept outside the current AdSession.
import { inflationForRound } from './ad-inflation.js';

export const GAME_META = [
  {id:'kitchen',name:'NORTH CAMP KITCHEN',hint:'食材を集めて、切って、煮て、届けよう',keys:'矢印 / WASD で移動 · Space で作業',accent:'#ffd36f'}
];

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

const RECIPES=[
  {id:'stew',name:'雪山シチュー',ingredient:'root',label:'根菜',cook:1.8,color:'#e5a85d'},
  {id:'soup',name:'オーロラスープ',ingredient:'berry',label:'ベリー',cook:1.55,color:'#bd8ce8'},
  {id:'tea',name:'焚き火茶',ingredient:'herb',label:'ハーブ',cook:1.25,color:'#86d2aa'}
];

export class CampKitchen {
  constructor(round=1){
    this.round=Math.max(1,Math.floor(Number.isFinite(round)?round:1));
    this.inflation=inflationForRound(this.round);this.time=0;this.eventId=0;this.events=[];this.keys=new Set();
    this.player={x:0,z:4,target:null};this.score=0;this.delivered=0;this.failed=0;this.combo=0;this.outcome=null;
    this.carry=null;this.chopped=false;this.cooked=0;this.plated=false;this.actionProgress=0;this.actionKind=null;this.message='食材を拾おう';
    this.stations=[
      {id:'crate',x:-4,z:2,label:'食材箱',kind:'crate'},
      {id:'board',x:-1.8,z:-2.8,label:'まな板',kind:'board'},
      {id:'pot',x:2.1,z:-2.8,label:'大鍋',kind:'pot'},
      {id:'pass',x:4,z:2,label:'配膳台',kind:'pass'}
    ];
    this.orders=[];for(let i=0;i<3;i++)this.orders.push(this.newOrder(i));
  }
  emit(type,data={}){this.events.push({id:++this.eventId,type,time:this.time,...data});if(this.events.length>28)this.events.shift();}
  newOrder(index){const recipe=RECIPES[(index+this.round-1)%RECIPES.length];return {id:index+1,recipe:recipe.id,name:recipe.name,remaining:55+index*7,served:false};}
  get stats(){return [['ORDERS',`${this.delivered} / 3`],['SCORE',String(this.score)],['COMBO',this.combo?`×${this.combo}`:'—']];}
  point(x,z){if(Number.isFinite(x)&&Number.isFinite(z))this.player.target={x:clamp(x,-5,5),z:clamp(z,-5,5)};}
  nearest(){let best=null,bd=Infinity;for(const station of this.stations){const d=distance(this.player,station);if(d<bd){bd=d;best=station;}}return bd<1.35?best:null;}
  action(code){if(code==='Space'||code==='Enter')return this.interact();return false;}
  interact(){
    if(this.outcome)return false;const station=this.nearest();if(!station)return false;
    if(station.kind==='crate'){
      if(this.carry||this.chopped||this.cooked||this.plated){this.message='手を空けてから食材を取ろう';return false;}
      const order=this.orders.find(o=>!o.served);if(!order){this.message='注文は全部届けた！';return false;}
      this.carry=order.recipe;this.message='まな板へ運ぼう';this.emit('pickup',{recipe:this.carry});return true;
    }
    if(station.kind==='board'){
      if(!this.carry||this.chopped){this.message='先に食材を拾おう';return false;}
      this.actionKind='chop';this.actionProgress=0;this.message='トントン…';return true;
    }
    if(station.kind==='pot'){
      if(!this.chopped||this.cooked){this.message='切った食材を鍋へ';return false;}
      this.actionKind='cook';this.actionProgress=0;this.message='ぐつぐつ…焦がさないで！';return true;
    }
    if(station.kind==='pass'){
      if(!this.plated){this.message='鍋から盛り付けよう';return false;}
      const order=this.orders.find(o=>!o.served&&o.recipe===this.carry);if(!order){this.message='この料理の注文はない';return false;}
      order.served=true;this.delivered++;this.combo++;this.score+=100+this.combo*25;this.emit('serve',{order:order.id,combo:this.combo});
      this.carry=null;this.chopped=false;this.cooked=0;this.plated=false;this.actionKind=null;this.actionProgress=0;this.message=this.delivered>=3?'全員お腹いっぱい！':'次の注文を急ごう';
      if(this.delivered>=3)this.outcome='success';return true;
    }
    return false;
  }
  update(dt){
    dt=clamp(Number.isFinite(dt)?dt:0,0,.05);this.time+=dt;if(this.outcome)return;
    const dx=(this.keys.has('ArrowRight')||this.keys.has('KeyD')?1:0)-(this.keys.has('ArrowLeft')||this.keys.has('KeyA')?1:0);
    const dz=(this.keys.has('ArrowDown')||this.keys.has('KeyS')?1:0)-(this.keys.has('ArrowUp')||this.keys.has('KeyW')?1:0);
    if(dx||dz){this.player.target=null;const n=Math.hypot(dx,dz);this.player.x+=dx/n*4.2*this.inflation.speed*dt;this.player.z+=dz/n*4.2*this.inflation.speed*dt;}
    else if(this.player.target){const tx=this.player.target.x-this.player.x,tz=this.player.target.z-this.player.z,d=Math.hypot(tx,tz),s=Math.min(d,4.2*this.inflation.speed*dt);if(d>.035){this.player.x+=tx/d*s;this.player.z+=tz/d*s;}else this.player.target=null;}
    this.player.x=clamp(this.player.x,-5,5);this.player.z=clamp(this.player.z,-5,5);
    for(const o of this.orders)if(!o.served){o.remaining=Math.max(0,o.remaining-dt*this.inflation.speed);if(o.remaining===0){o.served=true;this.failed++;this.combo=0;this.emit('burn',{order:o.id});this.message='注文が冷めてしまった！';}}
    if(this.actionKind){this.actionProgress+=dt;const duration=this.actionKind==='chop'?.72:this.orders.find(o=>!o.served&&o.recipe===this.carry)?RECIPES.find(r=>r.id===this.carry)?.cook||1.6:1.6;if(this.actionProgress>=duration){if(this.actionKind==='chop'){this.chopped=true;this.emit('chop',{recipe:this.carry});this.message='鍋へ運ぼう';}else{this.cooked=1;this.plated=true;this.emit('cook',{recipe:this.carry});this.message='配膳台へ！';}this.actionKind=null;this.actionProgress=0;}}
    if(this.failed>=2&&!this.outcome){this.outcome='failure';this.message='キッチンが間に合わない…';}
  }
}

export const GAME_MODELS={kitchen:CampKitchen};
export const Kitchen=CampKitchen;
export const NorthCampKitchen=CampKitchen;

