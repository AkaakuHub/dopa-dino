import assert from 'node:assert/strict';
import { Prestige, TREE_NODES, PRESTIGE_VERSION, CYCLE_STAGES, CYCLE_DISTANCE, cleanPrestigeSave } from './dist/prestige.js';
let assertions = 0;
const check = (value, message) => { assertions++; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions++; assert.deepEqual(actual, expected, message); };
const observe = (p, stage, epoch = p.epoch, distance = stage * 600) => p.observe({stageIndex: stage, distance, epoch});
function cycle(p, epoch = `run:${p.cycle}:${p.state.serial}`) {
  check(p.beginRun(epoch), 'new run begins');
  for (let stage = 1; stage <= 4; stage++) check(observe(p, stage), `actual stage ${stage} boundary observed`);
  check(p.canRebirth, 'full real cycle ready');
  const token = p.token;
  const result = p.rebirth(token);
  check(!!result, 'voluntary rebirth succeeds');
  check(p.rebirth(token) === null, 'repeated same token no-op');
  return result;
}
const p = new Prestige();
check(PRESTIGE_VERSION === 1 && CYCLE_DISTANCE === 2400 && CYCLE_STAGES.length === 4, 'actual four-stage geometry');
equal(p.features.games, ['snow','hole','helix'], 'fresh game has just the three foundations');
for (const key of ['passive','burst','exponent','tower','hyper','graham','autoBlaster']) check(!p.features[key], `${key} starts locked`);
check(p.features.maxHyperRank === 0 && p.features.progressRate === 1, 'fresh pace and symbolic gate');
check(!p.canRebirth && p.token === null && p.rebirth() === null, 'fresh has no fabricated cycle');
check(p.beginRun('a'), 'fresh epoch begins');
for (const invalid of [
  {stageIndex:4,distance:2399,epoch:'a'}, {stageIndex:3,distance:2400,epoch:'a'},
  {stageIndex:4,distance:2400,epoch:'stale'}, {stageIndex:Infinity,distance:2400,epoch:'a'},
  {stageIndex:NaN,distance:2400,epoch:'a'}, {stageIndex:4,distance:Infinity,epoch:'a'},
  {stageIndex:3.9,distance:2400,epoch:'a'}, {stageIndex:-1,distance:-600,epoch:'a'},
  {stageIndex:4,distance:2400,epoch:''}, {stageIndex:'4',distance:2400,epoch:'a'},
  {stageIndex:4,distance:'2400',epoch:'a'}
]) check(!p.observe(invalid) && !p.canRebirth, 'invalid/mismatched/stale observation cannot qualify');
check(!observe(p,4) && !p.canRebirth, 'jump straight to stage four cannot fabricate the four ordered seals');
check(observe(p,1) && p.clearedStages === 1, 'city cleared at 600m');
check(observe(p,2) && p.clearedStages === 2, 'desert cleared at 1200m');
check(!observe(p,1) && p.clearedStages === 2, 'regressive event rejected');
check(!p.beginRun('a') && p.clearedStages === 2, 'duplicate start event does not clear progress');
const revived = new Prestige(JSON.parse(JSON.stringify(p.snapshot())));
check(revived.clearedStages === 2 && revived.epoch === 'a', 'death/revive/save/reload retain actual completed stages');
check(p.beginRun('b') && p.clearedStages === 0 && p.distance === 0, 'fresh restart resets incomplete cycle');
check(!p.beginRun('a') && !observe(p,4,'a'), 'old run epoch cannot be revived as a new cycle');
for (const stage of [1,2,3]) { observe(p,stage); check(!p.canRebirth, 'three stages insufficient'); }
check(observe(p,3,'b',2399.999) && !p.canRebirth, 'last fraction of aurora not complete');
check(observe(p,4) && p.canRebirth && p.clearedStages === 4, 'exact aurora exit qualifies');
const eligible = new Prestige(JSON.parse(JSON.stringify(p.snapshot())));
check(eligible.canRebirth && eligible.token === p.token, 'earned eligibility survives reload');
check(p.beginRun('new-after-clear') && p.canRebirth && p.epoch === 'b', 'already earned cycle is not lost by restart');
const token=p.token, first=p.rebirth(token);
check(first.reward === 1 && first.rebirthCount === 1 && first.currency === 1 && first.multiplier === 3, 'first real rebirth pays exact permanent reward');
check(!p.canRebirth && p.clearedStages === 0 && p.epoch === null && p.cycle === 2, 'new cycle fully reset');
check(p.rebirth(token) === null && p.rebirth() === null && p.currency === 1, 'double click cannot pay twice');
check(!p.beginRun('b') && !observe(p,4,'b'), 'completed epoch cannot pay the next cycle');
check(p.achievements.includes('four-stages') && p.achievements.includes('first-rebirth'), 'permanent achievements retained');
check(!p.achievements.includes('exponent-era')&&!p.achievements.includes('tower-era'),'rebirth alone does not falsely award operator achievements');
check(p.features.progressRate > 1 && p.features.progressRate <= 2, 'rebirth immediately speeds actual next cycle');

// Rankable branches spend real permanent points and enforce both prerequisites
// and cycle floors. Duplicate preview tokens never spend twice.
check(TREE_NODES.length === 12 && new Set(TREE_NODES.map(n=>n.branch)).size === 3, 'twelve connected nodes across three branches');
check(TREE_NODES.every(n=>n.maxRank===5), 'five ranks per node creates a long meta progression');
const chargeOffer = p.offerNode('runner_charge');
check(chargeOffer.canBuy && chargeOffer.cost === 1 && chargeOffer.rank === 0, 'first rebirth offers an actual branch choice');
const bought = p.buyNode('runner_charge',chargeOffer.token);
check(bought && bought.before === 1 && p.currency === 0 && p.ranks.runner_charge === 1, 'node deducts exact points');
check(p.buyNode('runner_charge',chargeOffer.token) === null && p.currency === 0, 'repeated node receipt is idempotent');
check(p.features.rechargeBonus === .2 && p.features.progressRate > 1.08, 'runner purchase changes real features');
check(p.offerNode('runner_jump').locked && p.buyNode('runner_jump') === null, 'next branch node obeys rebirth floor');
check(p.offerNode('missing') === null && p.buyNode('missing') === null, 'invalid node no-op');
const stateCopy=p.snapshot();stateCopy.ranks.runner_charge=5;stateCopy.achievements.push('bad');stateCopy.retiredEpochs.push('bad');
check(p.ranks.runner_charge===1 && !p.achievements.includes('bad') && !p.state.retiredEpochs.includes('bad'),'snapshot independently mutable');

for(let i=p.rebirthCount;i<10;i++) cycle(p);
check(p.rebirthCount===10 && p.currency===54,'ten real cycles award triangular points minus real spend');
check(!p.features.exponent && !p.features.tower && !p.features.hyper && !p.features.graham,'cycle count alone cannot unlock operators');
check(p.offerNode('math_exponent').canBuy,'point and count gates allow an explicit exponent choice');
const exp1 = p.offerNode('math_exponent'); p.buyNode('math_exponent',exp1.token);
check(p.features.exponent && !p.features.tower,'only purchased math feature becomes available');
check(p.achievements.includes('exponent-era')&&!p.achievements.includes('tower-era'),'operator achievements follow actual researched feature');
const exp2 = p.offerNode('math_exponent');check(exp2.cost===16 && exp2.canBuy,'rank two has quadratic cost and its own floor');p.buyNode('math_exponent',exp2.token);
check(p.ranks.math_exponent===2 && p.offerNode('math_tower').locked,'tower still cannot unlock within ten cycles');
check(!p.features.graham && !p.features.hyper,'even skilled first ten cycles cannot reach late symbolic systems');
for(let i=p.rebirthCount;i<12;i++) cycle(p);
check(p.offerNode('math_tower').canBuy,'tower needs at least twelve actual full-stage rebirths and exponent rank two');
p.buyNode('math_tower');check(p.features.tower && !p.features.hyper && p.features.maxHyperRank===0,'tower is independent from exact symbolic research');

// Simulate a long honest run; no debug currency, invented completed stages, or
// time waits. Greedy buying does not bypass deterministic rank/count gates.
const campaign = new Prestige();
let firstExponent=null, firstTower=null, firstHyper=null, firstGraham=null, firstBeyond=null;
for(let c=1;c<=400;c++) {
  cycle(campaign);
  for(let round=0;round<5;round++) for(const node of TREE_NODES) {const offer=campaign.offerNode(node.id);if(offer.canBuy)campaign.buyNode(node.id,offer.token);}
  const f=campaign.features;
  if(f.exponent&&firstExponent===null)firstExponent=c;
  if(f.tower&&firstTower===null)firstTower=c;
  if(f.hyper&&firstHyper===null)firstHyper=c;
  if(f.graham&&firstGraham===null)firstGraham=c;
  if(f.maxHyperRank>16&&f.graham&&firstBeyond===null)firstBeyond=c;
  if(c<=10)check(!f.tower&&!f.hyper&&!f.graham,'early campaign cannot finish late content');
  if(c<75)check(!f.graham&&f.maxHyperRank<16,'Graham stays behind many real cycles');
  if(c<150)check(!f.graham||f.maxHyperRank===16,'beyond-Graham has another long progression gate');
  check(campaign.currency>=0&&Number.isSafeInteger(campaign.currency),'point economy remains finite exact integers');
  check(f.progressRate>=1&&f.progressRate<=2,'physical distance speed has a safety cap');
}
check(firstExponent>=3&&firstTower>=12&&firstHyper>=30&&firstGraham>=75&&firstBeyond>=150,'all late feature floors respected');
check(Object.values(campaign.ranks).every(rank=>rank===5),'full tree remains reachable through genuine many-cycle play');
check(campaign.features.maxHyperRank===1_000_000,'late rank five supports retained symbolic continuation');
const migrated = new Prestige({version:0,clears:999,stageIndex:400,distance:999999},{legacy:true});
check(migrated.rebirthCount===0&&migrated.currency===0&&!migrated.canRebirth&&migrated.clearedStages===0,'legacy unlocked content does not invent completed cycles');
check(migrated.features.games.length===10&&migrated.features.passive&&migrated.features.exponent&&migrated.features.autoBlaster,'legacy capabilities are grandfathered');
check(new Prestige(migrated.snapshot()).features.legacy,'grandfather flag persists');
const corrupt = new Prestige({version:1,rebirthCount:NaN,currency:Infinity,completed:true,stageIndex:4,distance:1,epoch:'a',ranks:{math_graham:Infinity,math_exponent:-1}});
check(!corrupt.canRebirth&&corrupt.currency===0&&corrupt.rebirthCount===0&&!corrupt.features.graham,'corrupt save cannot invent eligibility or money');
const unearnedRanks = new Prestige({version:1,rebirthCount:0,ranks:Object.fromEntries(TREE_NODES.map(n=>[n.id,5]))});
check(!unearnedRanks.features.exponent&&!unearnedRanks.features.graham&&!unearnedRanks.features.passive,'stored rank without real cycle floor has no fresh-game effect');
const future=new Prestige({version:99,rebirthCount:100,currency:1000});
check(future.readOnly&&future.snapshot()===null&&!future.beginRun('x')&&future.rebirth()===null&&future.buyNode('runner_charge')===null,'future schemas remain read-only');
check(cleanPrestigeSave(null).version===1,'clean default schema');
const reloaded=new Prestige(JSON.parse(JSON.stringify(campaign.snapshot())));
equal(reloaded.ranks,campaign.ranks,'all ranks retained on reload');equal(reloaded.features,campaign.features,'authoritative features retained on reload');
console.log(`Prestige: ${assertions} assertions passed; feature arrival cycles exponent=${firstExponent}, tower=${firstTower}, hyper=${firstHyper}, Graham=${firstGraham}, beyond=${firstBeyond}; full tree by cycle 400`);
