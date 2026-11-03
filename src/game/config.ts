/** The game's public name: change it here and in capacitor.config.ts, strings.xml and index.html. */
export const APP_NAME = 'Eternity High';

/**
 * The landscape game (title and Realm) is always 540 tall and as wide as the
 * screen, so a 20:9 phone fills edge to edge at exactly 2x instead of letterboxing.
 */
function landscapeWidth(): number {
  if (typeof window === 'undefined') return 960;
  // on a phone the window can still be inset by system bars we're about to hide, so trust the screen
  const phone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  const w = phone ? Math.max(window.innerWidth, window.screen.width, window.screen.height) : Math.max(window.innerWidth, window.innerHeight);
  const inner = phone ? Math.min(window.screen.width, window.screen.height) : Math.min(window.innerWidth, window.innerHeight);
  const long = w;
  const short = Math.max(1, inner);
  return Math.round((540 * Math.min(2.4, Math.max(16 / 9, long / short))) / 2) * 2;
}
export const RW = landscapeWidth();
export const RH = 540;

export const WIDTH = 480;
export const HEIGHT = 854;
/** a quest rift keeps its 854 height and simply shows more level on a wide screen */
export const RIFT_W = Math.round((HEIGHT * RW) / RH);

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
export const REGISTRY_KEY_LAST_PLATFORMER_RESULT = 'lastPlatformerResult';
export const REGISTRY_KEY_PLATFORMER_LEVEL_INDEX = 'platformerLevelIndex';

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

/**
 * Lets flairMod also nudge the continuous passive score, not just trick
 * points - passive score dominates total score over a run, so a
 * combo-multiplier character (Cleo, Joan, Frida, Leo) previously scored
 * well below a pure-survivability one (extra life/shield, flairMod 1)
 * despite an equal-skill run. Value tuned against simulated full runs.
 */
export const PASSIVE_FLAIR_WEIGHT = 1.1;
