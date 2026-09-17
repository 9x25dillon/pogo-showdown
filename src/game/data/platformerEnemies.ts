/**
 * Platformer enemy type table, data-driven like characters.ts/pogs.ts.
 * Phase 1 ships one type; a boss type slots in the same way later.
 */
export interface PlatformerEnemyDef {
  id: string;
  name: string;
  textureKey: string;
  /** lives lost on a non-stomp hit */
  contactDamage: number;
  /** coins awarded for a successful stomp */
  stompReward: number;
}

export const PATROLLER: PlatformerEnemyDef = {
  id: 'patroller',
  name: 'Patroller',
  textureKey: 'patrolEnemy',
  contactDamage: 1,
  stompReward: 5,
};

export function enemyDef(type: 'patroller'): PlatformerEnemyDef {
  switch (type) {
    case 'patroller':
      return PATROLLER;
  }
}
