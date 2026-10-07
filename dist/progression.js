import {Prestige} from './prestige.js';
import {HyperEconomy,formatHyper} from './hyper.js';
import {AstralEconomy,formatAstral} from './astral.js';
// Local, bounded progression. Materials are earned from completed rounds, never skips.
export const SAVE_KEY='dino-overdrive-progression';
export const SKILLS=[
  {id:'snow',icon:'♨',material:'エンバー',name:'炉心チャージ',effect:l=>`充電 +${l*20}%`,color:'#ffbd72'},
  {id:'hole',icon:'◉',material:'磁石',name:'コイン吸引',effect:l=>`常時吸引 ${l*35}px`,color:'#77ddff'},
  {id:'helix',icon:'↟',material:'羽根',name:'ジャンプ強化',effect:l=>`跳躍力 +${l*2}%`,color:'#ff9879'},
  {id:'gates',icon:'⬡',material:'シールド',name:'復活バリア',effect:l=>`保護 +${(l*.5).toFixed(1)}秒`,color:'#82dcf0'},
  {id:'stack',icon:'▥',material:'ブロック',name:'コンボキープ',effect:l=>`猶予 +${(l*.6).toFixed(1)}秒`,color:'#b4edce'},
  {id:'golf',icon:'⚑',material:'メダル',name:'回避ボーナス',effect:l=>`回避 +${l*25}点`,color:'#d7ef8c'},
  {id:'breaker',icon:'✦',material:'セル',name:'ブースト延長',effect:l=>`無敵 +${(l*.3).toFixed(1)}秒`,color:'#f1a1ff'},
  {id:'range',icon:'⌖',material:'照準チップ',name:'オートブラスター',effect:l=>l?`${Math.max(3,12-l).toFixed(0)}秒ごとに障害物を破壊`:'自動射撃 未開放',color:'#6cddff'},
  {id:'pins',icon:'◆',material:'宝石',name:'コイン価値',effect:l=>`コイン得点 +${l*25}%`,color:'#ffd27c'},
  {id:'merge',icon:'◎',material:'コア',name:'フィーバー延長',effect:l=>`無敵 +${(l*.5).toFixed(1)}秒`,color:'#b6a0ff'}
  ,{id:'kitchen',icon:'🍲',material:'スパイス',name:'キャンプ給仕',effect:l=>`配膳コンボ +${l*10}%`,color:'#ffd36f'}
];
const MAX=999999,clampInt=(n,max=MAX)=>Number.isFinite(n)?Math.min(max,Math.max(0,Math.floor(n))):0;
export const threshold=level=>level<=0?0:4*level*(level+1);
export const POWER_MILESTONES=[0,3,8,15,25,40];
export const multiplierFor=level=>2**Math.max(0,POWER_MILESTONES.filter(t=>level>=t).length-1);
export function levelFor(total){let level=0;while(level<10&&total>=threshold(level+1))level++;return level;}
export function cleanSave(input){const source=input&&typeof input==='object'?input:{};const resources=source.version===1?source.totals:source.resources;const state={version:5,activitySequence:clampInt(source.activitySequence,Number.MAX_SAFE_INTEGER-1),resources:{},rounds:clampInt(source.rounds),clears:clampInt(source.clears),streak:clampInt(source.streak,5),sequence:clampInt(source.sequence,Number.MAX_SAFE_INTEGER-1),receipts:[]};for(const s of SKILLS)state.resources[s.id]=clampInt(resources?.[s.id]);if(Array.isArray(source.receipts))state.receipts=source.receipts.filter(x=>typeof x==='string'&&x.length<100).slice(-64);return state;}
export class Progression {
  constructor(storage=globalThis.localStorage){this.storage=storage;this.saved=true;this.readOnly=false;let raw=null;try{raw=JSON.parse(storage?.getItem(SAVE_KEY)||'null');if(raw?.version>5)this.readOnly=true;}catch{}this.state=cleanSave(raw);this.economy=new AstralEconomy(raw?.astral);this.hyper=new HyperEconomy(raw?.hyper);this.prestige=new Prestige(raw?.prestige,{legacy:!!raw&&Number.isFinite(raw.version)&&raw.version<=4});this.state.activitySequence=Math.max(this.state.activitySequence,...Object.values(this.hyper.snapshot()?.highWater||{}));this.readOnly=this.readOnly||this.economy.readOnly||this.hyper.readOnly||this.prestige.readOnly;this.syncPower();this.economySaveTime=0;this.epoch=Math.random().toString(36).slice(2,10);this.save();}
  save(){if(this.readOnly){this.saved=false;return false;}try{if(this.economy)this.state.astral=this.economy.snapshot();if(this.hyper)this.state.hyper=this.hyper.snapshot();if(this.prestige)this.state.prestige=this.prestige.snapshot();this.storage?.setItem(SAVE_KEY,JSON.stringify(this.state));this.saved=!!this.storage;return this.saved;}catch{this.saved=false;return false;}}
  tickEconomy(dt,active=true){this.economy.tick(dt,{active});if(active){this.economySaveTime+=Math.max(0,Math.min(.25,Number.isFinite(dt)?dt:0));if(this.economySaveTime>=2){this.economySaveTime=0;this.save();}}}
  get features(){return this.prestige.features;}
  syncPower(){const features=this.features;this.economy.configureCycle({rebirths:this.prestige.rebirthCount,multiplier:this.prestige.multiplier,features});this.economy.syncProgress({totalLevel:this.totalLevel+(features.hyper?this.hyper.integrationBonus:0),clears:this.state.clears});}
  beginRun(){const epoch='run:'+this.nextId();this.prestige.beginRun(epoch);this.save();return this.prestige.epoch;}
  observeRun(stageIndex,distance){const result=this.prestige.observe({stageIndex,distance,epoch:this.prestige.epoch});if(result)this.save();return result;}
  buyTree(id,token){if(this.readOnly)return null;const result=this.prestige.buyNode(id,token);if(result){this.syncPower();this.save();}return result;}
  rebirth(token){if(this.readOnly)return null;const result=this.prestige.rebirth(token);if(!result)return null;this.economy.resetCycle({rebirths:this.prestige.rebirthCount,multiplier:this.prestige.multiplier,features:this.features});this.hyper.state.fuel=0;this.syncPower();this.save();return result;}
  activity(strength=1,source='runner'){if(this.readOnly||!Number.isFinite(strength)||strength<=0)return null;if(this.state.activitySequence>=Number.MAX_SAFE_INTEGER-1)return null;const sequence=++this.state.activitySequence,result=this.features.hyper?this.hyper.pulse({source,sequence},{active:true,strength}):{amount:0};this.economy.awardAction(strength);return result;}
  buyHyper(id){if(!this.features.hyper||id==='advance'&&this.hyper.rank>=this.features.maxHyperRank)return null;const result=this.hyper.buy(id);if(result){this.syncPower();this.save();}return result;}
  buyUpgrade(id){const result=this.economy.buy(id);if(result)this.save();return result;}
  nextId(){this.state.sequence=Math.min(Number.MAX_SAFE_INTEGER-1,this.state.sequence+1);this.save();return `${this.epoch}:${this.state.sequence}`;}
  level(id){return levelFor(this.state.resources[id]||0);}
  get levels(){return Object.fromEntries(SKILLS.map(s=>[s.id,this.level(s.id)]));}
  get multiplier(){return multiplierFor(this.totalLevel);}
  get totalLevel(){return SKILLS.reduce((n,s)=>n+this.level(s.id),0);}
  award(id,receipt,outcome,progress=0,rewardMultiplier=1){if(!SKILLS.some(s=>s.id===id)||typeof receipt!=='string'||!receipt||this.state.receipts.includes(receipt)||!['success','failure'].includes(outcome))return null;const before=this.level(id);const risk=Math.max(1,Math.min(4,Number.isFinite(rewardMultiplier)?rewardMultiplier:1));const base=outcome==='success'?8+Math.min(4,this.state.streak)*2:Math.min(4,Math.floor(Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0))*4));const amount=Math.min(32,Math.floor(base*risk));this.state.resources[id]=Math.min(MAX,this.state.resources[id]+amount);this.state.rounds=Math.min(MAX,this.state.rounds+1);if(outcome==='success')this.state.clears=Math.min(MAX,this.state.clears+1);this.state.streak=outcome==='success'?Math.min(5,this.state.streak+1):0;this.state.receipts.push(receipt);this.state.receipts=this.state.receipts.slice(-64);this.syncPower();const hyper=outcome==='success'?this.activity(4*risk,'round'):progress>0?this.activity(Math.max(1,Math.floor(progress*3*risk)),'round'):null;const astral=this.economy.awardRound(receipt,{success:outcome==='success',progress,score:amount});this.save();const skill=SKILLS.find(s=>s.id===id);return {id,amount,before,level:this.level(id),material:skill.material,effect:skill.effect(this.level(id)),saved:this.saved,streak:this.state.streak,multiplier:this.multiplier,riskMultiplier:risk,astral:astral?formatAstral(astral.amount):'0',fuel:hyper?.amount||0,hyper:this.features.hyper?formatHyper(this.hyper.power):''};}
}
