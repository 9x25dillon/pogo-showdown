import type { ItemId } from './items';

/**
 * Forever Realm creatures. Spawned around the player off-screen by
 * depth and time of day, despawned when far away (see RealmScene).
 */
export type RealmEnemyId = 'slime' | 'crawler' | 'wraith';

export interface RealmEnemyDef {
  id: RealmEnemyId;
  name: string;
  texture: string;
  hp: number;
  damage: number;
  speed: number;
  /** wraiths drift through rock; everything else walks the tiles */
  phasing: boolean;
  drop: ItemId;
  dropMax: number;
}

export const REALM_ENEMIES: Record<RealmEnemyId, RealmEnemyDef> = {
  slime: { id: 'slime', name: 'Gloom Slime', texture: 'realm_slime', hp: 24, damage: 10, speed: 70, phasing: false, drop: 'gel', dropMax: 2 },
  crawler: { id: 'crawler', name: 'Bone Crawler', texture: 'realm_crawler', hp: 42, damage: 14, speed: 85, phasing: false, drop: 'bone', dropMax: 2 },
  wraith: { id: 'wraith', name: 'Wraith', texture: 'realm_wraith', hp: 30, damage: 12, speed: 80, phasing: true, drop: 'ecto', dropMax: 1 },
};

/** which creatures can appear here: depth in tiles below the surface, and whether it's night */
export function spawnTable(depthTiles: number, night: boolean): RealmEnemyId[] {
  if (depthTiles > 60) return ['crawler', 'wraith', 'crawler'];
  if (depthTiles > 12) return ['crawler', 'slime'];
  return night ? ['wraith', 'slime', 'wraith'] : ['slime'];
}

export function spawnCap(depthTiles: number, night: boolean): number {
  if (depthTiles > 12) return 6;
  return night ? 7 : 3;
}
