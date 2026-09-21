/**
 * Physics/gameplay tunables for the Pog Quest platformer mode, kept in one
 * file the same way pogs.ts keeps its balance rules in one place - tuning
 * happens here, not scattered across scene code.
 */
import { HEIGHT } from '../config';

export const GRAVITY_Y = 1600;
export const JUMP_VELOCITY = -620;
/** releasing jump early multiplies remaining upward velocity by this - the "hold to jump higher" feel */
export const JUMP_CUT_MULTIPLIER = 0.45;
export const MAX_FALL_SPEED = 900;

export const MOVE_SPEED = 210;
export const MOVE_ACCEL = 1400;

/** grace window after leaving a ledge where a jump still fires */
export const COYOTE_MS = 90;
/** grace window where a jump press just before landing still fires */
export const JUMP_BUFFER_MS = 100;

export const STOMP_BOUNCE_VELOCITY = -420;
export const STOMP_TOLERANCE_PX = 10;

export const STOMP_COMBO_THRESHOLD = 3;
export const SPEED_BOOST_MULTIPLIER = 1.4;
export const SPEED_BOOST_MS = 4000;

/** mirrors RunScene's INVULN_MS pattern */
export const PLATFORMER_INVULN_MS = 700;

export const LEVEL_WIDTH_PX = 3200;
export const PLATFORMER_GROUND_Y = 700;

export const ENEMY_PATROL_SPEED = 70;
export const FLYER_BOB_SPEED = 2.2; // radians/sec
export const FLYER_BOB_HEIGHT = 46; // px above/below its spawn height

export const PROJECTILE_SPEED = 420;
export const PROJECTILE_LIFESPAN_MS = 900;

export const BOSS_PATROL_MS = 2200;
export const BOSS_TELEGRAPH_MS = 500;
export const BOSS_CHARGE_MS = 650;
export const BOSS_COOLDOWN_MS = 700;

/** ~0.88x player top speed - an average player can win, but it stays close */
export const RIVAL_MOVE_SPEED = 185;
/** whoever loses a player<->rival stomp exchange: input zeroed, tinted, no elimination - the race continues */
export const STOMP_STUN_MS = 900;

export const PLAYER_LIVES = 3;
export const GAP_DEATH_Y = HEIGHT + 100;
