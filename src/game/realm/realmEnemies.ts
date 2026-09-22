import type { ItemId } from './items';

/**
 * Forever Realm creatures. Spawned around the player off-screen by
 * depth and time of day, despawned when far away (see RealmScene).
 */
export type RealmEnemyId = 'slime' | 'crawler' | 'wraith' | 'imp' | 'eel' | 'harpy' | 'knight';

/** hop: leaps at you · walk: charges, jumps walls · fly: drifts at you · swim: only moves through water */
export type RealmEnemyAi = 'hop' | 'walk' | 'fly' | 'swim';

export interface RealmEnemyDef {
  id: RealmEnemyId;
  name: string;
  texture: string;
  hp: number;
  damage: number;
  speed: number;
  ai: RealmEnemyAi;
  /** drifts through rock (wraiths, harpies); everything else collides with the tiles */
  phasing: boolean;
  drop: ItemId;
  dropMax: number;
}

export const REALM_ENEMIES: Record<RealmEnemyId, RealmEnemyDef> = {
  slime: { id: 'slime', name: 'Gloom Slime', texture: 'realm_slime', hp: 24, damage: 10, speed: 70, ai: 'hop', phasing: false, drop: 'gel', dropMax: 2 },
  crawler: { id: 'crawler', name: 'Bone Crawler', texture: 'realm_crawler', hp: 42, damage: 14, speed: 85, ai: 'walk', phasing: false, drop: 'bone', dropMax: 2 },
  wraith: { id: 'wraith', name: 'Wraith', texture: 'realm_wraith', hp: 30, damage: 12, speed: 80, ai: 'fly', phasing: true, drop: 'ecto', dropMax: 1 },
  imp: { id: 'imp', name: 'Cinder Imp', texture: 'realm_imp', hp: 34, damage: 14, speed: 95, ai: 'fly', phasing: true, drop: 'ember', dropMax: 2 },
  eel: { id: 'eel', name: 'Gloom Eel', texture: 'realm_eel', hp: 38, damage: 14, speed: 110, ai: 'swim', phasing: false, drop: 'pearl', dropMax: 1 },
  harpy: { id: 'harpy', name: 'Harpy', texture: 'realm_harpy', hp: 36, damage: 15, speed: 105, ai: 'fly', phasing: true, drop: 'feather', dropMax: 2 },
  knight: { id: 'knight', name: 'Skeleton Knight', texture: 'realm_knight', hp: 70, damage: 18, speed: 70, ai: 'walk', phasing: false, drop: 'dust', dropMax: 2 },
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
