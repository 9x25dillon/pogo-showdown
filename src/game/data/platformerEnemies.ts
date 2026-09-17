/**
 * Platformer enemy type table, data-driven like characters.ts/pogs.ts.
 */
export type PlatformerEnemyType = 'patroller' | 'flyer' | 'boss';

export interface PlatformerEnemyDef {
  id: PlatformerEnemyType;
  name: string;
  textureKey: string;
  /** lives lost on a non-stomp hit */
  contactDamage: number;
  /** coins awarded when defeated */
  stompReward: number;
  /** hovers and bobs instead of walking a patrol strip on the ground */
  flies: boolean;
  /** hits required to defeat; regular enemies default to 1 (see PatrolEnemyState.health) */
  maxHealth?: number;
  /** bosses only: horizontal speed during a charge attack */
  chargeSpeed?: number;
}

export const PATROLLER: PlatformerEnemyDef = {
  id: 'patroller',
  name: 'Patroller',
  textureKey: 'patrolEnemy',
  contactDamage: 1,
  stompReward: 5,
  flies: false,
};

export const FLYER: PlatformerEnemyDef = {
  id: 'flyer',
  name: 'Flyer',
  textureKey: 'flyingEnemy',
  contactDamage: 1,
  stompReward: 8,
  flies: true,
};

export const BOSS: PlatformerEnemyDef = {
  id: 'boss',
  name: 'Circuit Champion',
  textureKey: 'boss',
  contactDamage: 1,
  stompReward: 40,
  flies: false,
  maxHealth: 3,
  chargeSpeed: 340,
};

export function enemyDef(type: PlatformerEnemyType): PlatformerEnemyDef {
  switch (type) {
    case 'patroller':
      return PATROLLER;
    case 'flyer':
      return FLYER;
    case 'boss':
      return BOSS;
  }
}
