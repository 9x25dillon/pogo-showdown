/**
 * Platformer enemy type table, data-driven like characters.ts/pogs.ts.
 */
export type PlatformerEnemyType = 'patroller' | 'flyer' | 'hopper' | 'spiker' | 'turret' | 'boss' | 'slammer';

/**
 * walk:   patrols a ground strip
 * fly:    patrols in the air, bobbing around its spawn height (no gravity)
 * hop:    walks a strip and periodically leaps
 * turret: stands still and fires pellets at a hero in range
 * boss:   patrol -> telegraph -> charge -> cooldown state machine
 */
export type EnemyMovement = 'walk' | 'fly' | 'hop' | 'turret' | 'boss';

export interface PlatformerEnemyDef {
  id: PlatformerEnemyType;
  name: string;
  textureKey: string;
  movement: EnemyMovement;
  /** lives lost on a non-stomp hit */
  contactDamage: number;
  /** coins awarded when defeated */
  stompReward: number;
  /** hits required to defeat; regular enemies default to 1 (see PatrolEnemyState.health) */
  maxHealth?: number;
  /** bosses only: horizontal speed during a charge attack */
  chargeSpeed?: number;
  /** bosses only: which state machine drives it (default 'charger') */
  bossKind?: 'charger' | 'slammer';
  /**
   * Stomping it hurts instead of defeating it. Only a thrown projectile
   * or a ground-pound shockwave can take it out.
   */
  spiky?: boolean;
}

export const PATROLLER: PlatformerEnemyDef = {
  id: 'patroller',
  name: 'Patroller',
  textureKey: 'patrolEnemy',
  movement: 'walk',
  contactDamage: 1,
  stompReward: 5,
};

export const FLYER: PlatformerEnemyDef = {
  id: 'flyer',
  name: 'Flyer',
  textureKey: 'flyingEnemy',
  movement: 'fly',
  contactDamage: 1,
  stompReward: 8,
};

export const HOPPER: PlatformerEnemyDef = {
  id: 'hopper',
  name: 'Hopper',
  textureKey: 'hopperEnemy',
  movement: 'hop',
  contactDamage: 1,
  stompReward: 7,
};

export const SPIKER: PlatformerEnemyDef = {
  id: 'spiker',
  name: 'Spiker',
  textureKey: 'spikerEnemy',
  movement: 'walk',
  contactDamage: 1,
  stompReward: 12,
  spiky: true,
};

export const TURRET: PlatformerEnemyDef = {
  id: 'turret',
  name: 'Pellet Turret',
  textureKey: 'turretEnemy',
  movement: 'turret',
  contactDamage: 1,
  stompReward: 10,
};

export const BOSS: PlatformerEnemyDef = {
  id: 'boss',
  name: 'Circuit Champion',
  textureKey: 'boss',
  movement: 'boss',
  contactDamage: 1,
  stompReward: 40,
  maxHealth: 3,
  chargeSpeed: 340,
  bossKind: 'charger',
};

/**
 * Leaps at you and slams down, sending a shockwave along the ground both
 * ways (jump it). Dizzy after each landing: that's the stomp window, and
 * each window allows one hit before it hops clear.
 */
export const SLAMMER: PlatformerEnemyDef = {
  id: 'slammer',
  name: 'Summit Slammer',
  textureKey: 'slammerBoss',
  movement: 'boss',
  contactDamage: 1,
  stompReward: 60,
  maxHealth: 4,
  bossKind: 'slammer',
};

const ENEMY_DEFS: Record<PlatformerEnemyType, PlatformerEnemyDef> = {
  patroller: PATROLLER,
  flyer: FLYER,
  hopper: HOPPER,
  spiker: SPIKER,
  turret: TURRET,
  boss: BOSS,
  slammer: SLAMMER,
};

export function enemyDef(type: PlatformerEnemyType): PlatformerEnemyDef {
  return ENEMY_DEFS[type];
}
