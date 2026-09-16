import { BASE_SPEED, MAX_SPEED, PASSIVE_SCORE_RATE, SPEED_RAMP } from '../config';

/** seconds of survival before speed hits its cap, per RunScene's own ramp */
const RAMP_DURATION = (MAX_SPEED - BASE_SPEED) / SPEED_RAMP;

/** passive score accumulated by RAMP_DURATION, before the flat post-cap rate kicks in */
const SCORE_AT_RAMP_END =
  PASSIVE_SCORE_RATE * (BASE_SPEED * RAMP_DURATION + 0.5 * SPEED_RAMP * RAMP_DURATION * RAMP_DURATION);

/**
 * Passive (no-trick-bonus) score for N seconds of survival, using the
 * exact same speed-ramp math as RunScene. This is the baseline every
 * balance number in the game (tiers, pro opponent scores) is derived
 * from, so tuning stays grounded in what the game actually produces
 * instead of guesswork.
 */
export function passiveScoreAtTime(seconds: number): number {
  if (seconds <= RAMP_DURATION) {
    return PASSIVE_SCORE_RATE * (BASE_SPEED * seconds + 0.5 * SPEED_RAMP * seconds * seconds);
  }
  return SCORE_AT_RAMP_END + PASSIVE_SCORE_RATE * MAX_SPEED * (seconds - RAMP_DURATION);
}

/** maps a pro's skill rating (roughly 70-99) to an equivalent survival time, then a score */
export function proSkillToScore(skill: number, varianceMultiplier: number): number {
  const seconds = 40 + (skill - 70) * 7;
  return Math.round(passiveScoreAtTime(seconds) * varianceMultiplier);
}
