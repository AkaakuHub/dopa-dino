import assert from 'node:assert/strict';
import { inflationForRound, AdSession, AD_GAMES } from './dist/ads-engine.js';
import { NeonBreaker } from './dist/ads-golf-breaker.js';

const early = inflationForRound(1), late = inflationForRound(48);
assert.equal(early.difficulty, 1);
assert(late.difficulty > early.difficulty && late.reward >= 4);
assert(late.difficulty <= 3.2 && late.speed <= 2.5 && late.health <= 4, 'inflation is bounded');
assert.equal(inflationForRound(Infinity).round, 1);
assert.equal(inflationForRound(1e99).round, 1_000_000);

const a = new NeonBreaker(1), b = new NeonBreaker(12);
assert(b.inflation.difficulty > a.inflation.difficulty);
assert(b.baseSpeed() > a.baseSpeed(), 'later ad rounds are materially faster');
assert(b.bricks.length >= a.bricks.length, 'later rounds have at least as many bricks');
assert(a.chooseRisk(2));
assert.equal(a.riskReward.armed, true);
assert.equal(a.riskReward.multiplier, 2);
assert.equal(!!(a.riskReward.armed && a.riskReward.won), false);
// A multiball pickup is a real bounded physics upgrade, not cosmetic state.
a.serving = 0;
a.ball.vx = 2; a.ball.vz = -a.baseSpeed();
assert(a.collect({ kind: 'multi', x: 0, z: 0 }));
assert.equal(a.balls.length, 3);
assert(a.events.some(e => e.type === 'multiball'));
assert(a.power.multi > 0);
assert(a.scoreMultiplier >= 1);
a.bricks.forEach(brick => brick.hp = 0); a.destroyed = a.waveBricks;
a.update(.02);
assert(a.wavePause > 0, 'clearing a wave settles the round');
assert(a.riskReward.won >= 1 && a.riskBonus === 2, 'risk choice pays ×2 on a clear');
const c = new NeonBreaker(); c.chooseRisk(2); c.lives = 1; c.serving = 0; c.ball = {x: 0, z: 6.2, vx: 0, vz: 7, r: .16}; c.update(.02);
assert.equal(c.riskReward.lost, 1); assert.equal(c.riskBonus, 0, 'risk stake is lost on failure');
assert(a.balls.length <= 3 && a.pickups.length <= 6 && a.events.length <= 22, 'bounded gameplay pools');

// One attempt / one close transition remains idempotent after a result.
for (const { id } of AD_GAMES) {
  const session = new AdSession(id);
  session.update(5.01);
  assert.equal(session.close(), true, id);
  assert.equal(session.close(), false, `${id} closes once`);
}
console.log('PASS: bounded per-round inflation, Breaker ×2 risk choice, multiball, wave escalation and one-shot close semantics');
