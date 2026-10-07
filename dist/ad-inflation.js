// Shared, deterministic round inflation for rewarded mini-games.  The values
// are deliberately capped so a malformed/very old round cannot create an
// unbounded physics or node workload.
const finiteRound = value => Number.isFinite(value) ? Math.max(1, Math.min(1_000_000, Math.floor(value))) : 1;

export function inflationForRound(value = 1) {
  const round = finiteRound(value);
  const step = round - 1;
  return Object.freeze({
    round,
    step,
    // Distinct knobs let each game apply a different strategy while sharing
    // the same bounded source of exponential/chain growth.
    difficulty: Math.min(3.2, 1 + step * .14),
    speed: Math.min(2.5, 1 + step * .085),
    health: Math.min(4, 1 + step * .18),
    reward: Math.min(16, 2 ** Math.min(4, Math.floor(step / 3))),
    chain: Math.min(12, Math.floor(step / 2))
  });
}

export function makeRiskReward(multiplier = 2) {
  return { armed: false, multiplier: Math.max(2, Math.min(4, Math.floor(multiplier))), stake: 0, won: 0, lost: 0 };
}

export function armRiskReward(risk, stake = 1) {
  if (!risk || risk.armed) return false;
  risk.armed = true;
  risk.stake = Math.max(1, Math.min(4, Math.floor(Number.isFinite(stake) ? stake : 1)));
  return true;
}

export function settleRiskReward(risk, success) {
  if (!risk?.armed) return 1;
  risk.armed = false;
  if (success) { risk.won++; return risk.multiplier; }
  risk.lost++;
  return 0;
}
