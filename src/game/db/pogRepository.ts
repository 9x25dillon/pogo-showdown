import {
  BASE_FOOTPEG_CAPACITY,
  EMPTY_PERKS,
  RARITY_WEIGHT,
  aggregatePerks,
  pogDef,
  type PogDef,
  type PogPerks,
} from '../data/pogs';
import { dbGetAll, dbPut } from './LocalDB';
import { getLoadout } from './loadoutRepository';
import type { PogInstance } from './pogSchema';

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getCollection(): Promise<PogInstance[]> {
  const rows = await dbGetAll<PogInstance>('pogs');
  return rows.sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt));
}

/** first visit to the Binder hands out the starter pog so equipping is visible before any battle */
export async function ensureStarterPog(): Promise<PogInstance[]> {
  const owned = await getCollection();
  if (owned.length > 0) return owned;
  const starter: PogInstance = { id: newId(), defId: 'cafeteria', equipped: true, source: 'starter', acquiredAt: new Date().toISOString() };
  await dbPut('pogs', starter);
  return [starter];
}

export async function grantPog(defId: string, source: string): Promise<PogInstance> {
  const inst: PogInstance = { id: newId(), defId, equipped: false, source, acquiredAt: new Date().toISOString() };
  await dbPut('pogs', inst);
  return inst;
}

export async function footpegCapacity(): Promise<number> {
  const loadout = await getLoadout();
  return BASE_FOOTPEG_CAPACITY + loadout.pog.tier;
}

export function weightOf(instances: PogInstance[]): number {
  return instances.reduce((sum, i) => sum + (RARITY_WEIGHT[pogDef(i.defId)?.rarity ?? 'common'] ?? 1), 0);
}

export interface EquipResult {
  ok: boolean;
  reason?: string;
}

export async function toggleEquip(instanceId: string): Promise<EquipResult> {
  const owned = await getCollection();
  const target = owned.find((i) => i.id === instanceId);
  if (!target) return { ok: false, reason: 'not owned' };

  if (target.equipped) {
    target.equipped = false;
    await dbPut('pogs', target);
    return { ok: true };
  }

  const equipped = owned.filter((i) => i.equipped);
  if (equipped.some((i) => i.defId === target.defId)) return { ok: false, reason: 'one copy of each pog at a time' };
  const cap = await footpegCapacity();
  const def = pogDef(target.defId);
  const weight = RARITY_WEIGHT[def?.rarity ?? 'common'];
  if (weightOf(equipped) + weight > cap) return { ok: false, reason: `footpeg full (${cap} slots)` };

  target.equipped = true;
  await dbPut('pogs', target);
  return { ok: true };
}

/** what RunScene applies; safe to call with an empty collection */
export async function equippedPerks(): Promise<Required<PogPerks>> {
  const owned = await getCollection();
  const defs = owned.filter((i) => i.equipped).map((i) => pogDef(i.defId)).filter((d): d is PogDef => !!d);
  return defs.length ? aggregatePerks(defs) : { ...EMPTY_PERKS };
}

/**
 * Identity-preserving version of equippedPerks(), for modes (Pog Quest)
 * that need to know *which* pog instance is carried - e.g. to track an
 * individual item's remaining charges - not just a flattened stat bag.
 */
export async function equippedLoadout(): Promise<{ instance: PogInstance; def: PogDef }[]> {
  const owned = await getCollection();
  return owned
    .filter((i) => i.equipped)
    .map((instance) => ({ instance, def: pogDef(instance.defId) }))
    .filter((row): row is { instance: PogInstance; def: PogDef } => !!row.def);
}
