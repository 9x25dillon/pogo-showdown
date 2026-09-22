/**
 * Physics/gameplay tunables for the Pog Quest platformer mode, kept in one
 * file the same way pogs.ts keeps its balance rules in one place - tuning
 * happens here, not scattered across scene code.
 */
import { HEIGHT } from '../config';

/**
 * Movement "feel" values, mutable so the `?tune` panel (see
 * systems/tuningPanel.ts) can adjust them live during a playtest. Read
 * these at use time, never copy them into module-level constants.
 */
export const PHYS = {
  gravityY: 1600,
  /** extra gravity while falling (1 = symmetric arc); >1 gives a snappier, less floaty descent */
  fallGravityMultiplier: 1,
  jumpVelocity: -620,
  /** releasing jump early multiplies remaining upward velocity by this - the "hold to jump higher" feel */
  jumpCutMultiplier: 0.45,
  maxFallSpeed: 900,
  moveSpeed: 210,
  moveAccel: 1400,
  /** grace window after leaving a ledge where a jump still fires */
  coyoteMs: 90,
  /** grace window where a jump press just before landing still fires */
  jumpBufferMs: 100,
  /** ~0.88x player top speed - an average player can win, but it stays close */
  rivalMoveSpeed: 185,
};
export type PhysKey = keyof typeof PHYS;
export const PHYS_DEFAULTS: Readonly<typeof PHYS> = { ...PHYS };

/** gravity applies to enemies too; only heroes get the fall multiplier */
export const GRAVITY_Y = PHYS_DEFAULTS.gravityY;

/**
 * Longest horizontal distance a full-held jump covers from takeoff to
 * landing at the same height, at top run speed. Levels are checked
 * against this (see largestUnbridgedGap) so tuning can't silently make
 * a pit impossible.
 */
export function jumpReach(p: typeof PHYS = PHYS): { peakPx: number; distancePx: number } {
  const rise = -p.jumpVelocity / p.gravityY;
  const peakPx = (p.jumpVelocity * p.jumpVelocity) / (2 * p.gravityY);
  const fallGravity = p.gravityY * p.fallGravityMultiplier;
  const fall = Math.sqrt((2 * peakPx) / fallGravity);
  return { peakPx, distancePx: (rise + fall) * p.moveSpeed };
}

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

export const HOPPER_HOP_VELOCITY = -520;
export const HOPPER_HOP_INTERVAL_MS = 1400;
export const TURRET_FIRE_INTERVAL_MS = 1900;
export const TURRET_RANGE_PX = 420;
export const PELLET_SPEED = 230;
export const PELLET_LIFESPAN_MS = 2400;

export const PROJECTILE_SPEED = 420;
export const PROJECTILE_LIFESPAN_MS = 900;

export const BOSS_PATROL_MS = 2200;
export const BOSS_TELEGRAPH_MS = 500;
export const BOSS_CHARGE_MS = 650;
export const BOSS_COOLDOWN_MS = 700;

/** Summit Slammer (second boss): patrol -> telegraph -> leap -> slam + shockwaves -> stunned */
export const SLAMMER_PATROL_MS = 1800;
export const SLAMMER_TELEGRAPH_MS = 550;
export const SLAMMER_LEAP_VELOCITY = -950;
export const SLAMMER_MAX_LEAP_VX = 420;
export const SLAMMER_STUN_MS = 1500;
/** at or below half health the patrol between slams shortens to this fraction */
export const SLAMMER_ENRAGE_PATROL_SCALE = 0.55;
export const SHOCKWAVE_SPEED = 260;
export const SHOCKWAVE_LIFESPAN_MS = 2200;

/** spring pads launch anything that runs or lands on them (heroes and the rival) */
export const SPRING_VELOCITY = -1100;

/** whoever loses a player<->rival stomp exchange: input zeroed, tinted, no elimination - the race continues */
export const STOMP_STUN_MS = 900;

export const PLAYER_LIVES = 3;
export const GAP_DEATH_Y = HEIGHT + 100;

/** active-item effects (see PogActiveEffect) */
export const AIR_JUMP_VELOCITY_SCALE = 0.9;
export const GROUND_POUND_SPEED = 1100;
export const GROUND_POUND_RADIUS_X = 150;
export const GROUND_POUND_RADIUS_Y = 90;
export const MAGNET_RADIUS_PX = 190;
export const MAGNET_PULL_SPEED = 460;

/** co-op camera leash: neither player may leave the shared view */
export const COOP_VIEW_MARGIN_PX = 24;
