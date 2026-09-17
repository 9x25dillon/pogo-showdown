/**
 * Platformer enemy type table, data-driven like characters.ts/pogs.ts.
 * A boss type slots in the same way later.
 */
export type PlatformerEnemyType = 'patroller' | 'flyer';

export interface PlatformerEnemyDef {
  id: PlatformerEnemyType;
  name: string;
  textureKey: string;
  /** lives lost on a non-stomp hit */
  contactDamage: number;
  /** coins awarded for a successful stomp */
  stompReward: number;
  /** hovers and bobs instead of walking a patrol strip on the ground */
  flies: boolean;
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

export function enemyDef(type: PlatformerEnemyType): PlatformerEnemyDef {
  switch (type) {
    case 'patroller':
      return PATROLLER;
    case 'flyer':
      return FLYER;
  }
}
