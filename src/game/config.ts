export const WIDTH = 480;
export const HEIGHT = 854;

export const LANE_X = [100, 240, 380] as const;
export const PLAYER_Y = HEIGHT - 180;
export const GROUND_Y = HEIGHT - 120;

export const COLORS = {
  bg: 0x0b0714,
  road: 0x1c1430,
  laneLine: 0x362a52,
  ground: 0x120c1f,
  accent: 0xf9d64b,
  danger: 0xef4444,
  success: 0x4ade80,
  text: 0xffffff,
};

export const REGISTRY_KEY_CHARACTER = 'selectedCharacterId';
export const REGISTRY_KEY_LAST_RESULT = 'lastRunResult';
export const REGISTRY_KEY_PERKS = 'equippedPogPerks';

/**
 * Shared scoring/speed constants - used by RunScene for real gameplay
 * and by scoreCurve.ts to derive tier thresholds and pro opponent
 * scores from the same math, so balance tuning stays grounded in what
 * the game actually produces instead of guesswork.
 */
export const BASE_SPEED = 260;
export const MAX_SPEED = 680;
export const SPEED_RAMP = 5.5;
export const PASSIVE_SCORE_RATE = 0.12;
