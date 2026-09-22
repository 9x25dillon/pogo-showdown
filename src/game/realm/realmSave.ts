import { dbGet, dbPut } from '../db/LocalDB';
import type { ItemId } from './items';
import type { RelicId } from './realms';

/**
 * One saved world. The world itself is regenerated from `seed`; only the
 * player's changes are stored, as [tileIndex, tileId] pairs.
 */
export interface RealmSave {
  id: 'world';
  version: 1;
  seed: number;
  edits: [number, number][];
  player: { x: number; y: number; hp: number };
  spawn: { x: number; y: number };
  inventory: Partial<Record<ItemId, number>>;
  sword: number;
  pickaxe: number;
  /** boss relics won in the portal realms (optional: saves from before Phase 2 have none) */
  relics?: RelicId[];
  /** ms into the day/night cycle */
  clock: number;
  savedAt: string;
}

export async function loadRealm(): Promise<RealmSave | undefined> {
  const save = await dbGet<RealmSave>('realm', 'world');
  return save?.version === 1 ? save : undefined;
}

export async function saveRealm(save: Omit<RealmSave, 'id' | 'version' | 'savedAt'>): Promise<void> {
  await dbPut('realm', { ...save, id: 'world', version: 1, savedAt: new Date().toISOString() });
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
