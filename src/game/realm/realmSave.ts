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
  /** beat the Eternal Reaper behind the Forever Gate */
  champion?: boolean;
  stats?: RealmStats;
  /** overworld minimap fog of war: one bit per tile, base64 */
  explored?: string;
  /** ms into the day/night cycle */
  clock: number;
  savedAt: string;
}

/** the journey, shown in the ending */
export interface RealmStats {
  mined: number;
  placed: number;
  slain: number;
  bosses: number;
  deaths: number;
  crafted: number;
  playMs: number;
}

export function emptyStats(): RealmStats {
  return { mined: 0, placed: 0, slain: 0, bosses: 0, deaths: 0, crafted: 0, playMs: 0 };
}

export function packBits(bits: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bits.length; i += 0x8000) s += String.fromCharCode(...bits.subarray(i, i + 0x8000));
  return btoa(s);
}

export function unpackBits(b64: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  try {
    const s = atob(b64);
    for (let i = 0; i < Math.min(s.length, length); i++) out[i] = s.charCodeAt(i);
  } catch {
    // corrupt: start unexplored
  }
  return out;
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
