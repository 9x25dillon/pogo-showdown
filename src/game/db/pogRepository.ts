import { CHARACTERS } from '../data/characters';
import { CIRCUIT_ROSTER } from '../data/circuitRoster';
import {
  BASE_FOOTPEG_CAPACITY,
  EMPTY_PERKS,
  RARITY_WEIGHT,
  aggregatePerks,
  pogDef,
  pogForOpponent,
  type PogDef,
  type PogPerks,
} from '../data/pogs';
import { todayKey } from '../systems/dates';
import { dbDelete, dbGetAll, dbPut } from './LocalDB';
import { getLoadout } from './loadoutRepository';
import type { BattleLogEntry, PogInstance } from './pogSchema';
import { getProfile } from './repository';

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

// ---------------- battles ----------------

export interface BattleOpponent {
  id: string;
  name: string;
  epithet: string;
  emoji: string;
  color: number;
  skill: number;
  ranked: boolean;
  drop: PogDef | undefined;
}

/** highschoolers are practice (skill 45-65); pros are ranked and use their circuit skill */
export function battleOpponents(): BattleOpponent[] {
  const hs: BattleOpponent[] = CHARACTERS.map((c, i) => ({
    id: c.id,
    name: c.name,
    epithet: c.club,
    emoji: c.emoji,
    color: c.color,
    skill: 45 + ((i * 7) % 21),
    ranked: false,
    drop: pogForOpponent(c.id),
  }));
  const pros: BattleOpponent[] = CIRCUIT_ROSTER.map((p) => ({
    id: p.id,
    name: p.name,
    epithet: p.epithet,
    emoji: p.emoji,
    color: p.color,
    skill: p.skill,
    ranked: true,
    drop: pogForOpponent(p.id),
  }));
  return [...hs, ...pros];
}

export async function getBattleLog(): Promise<BattleLogEntry[]> {
  return dbGetAll<BattleLogEntry>('battleLog');
}

/** one drop per opponent per calendar day - the only faucet for new pogs */
export async function dropAvailableToday(opponentId: string): Promise<boolean> {
  const today = todayKey();
  const log = await getBattleLog();
  return !log.some((e) => e.date === today && e.opponentId === opponentId && e.dropDefId !== null);
}

export async function rankedUnlocked(): Promise<boolean> {
  const profile = await getProfile();
  return !!profile.circuitUnlockedAt;
}

export interface ResolveBattleInput {
  opponent: BattleOpponent;
  rounds: { you: number; them: number }[];
  won: boolean;
  /** instance staked in a ranked battle */
  wagerInstanceId: string | null;
}

export interface ResolveBattleResult {
  dropped: PogDef | null;
  lostInstance: PogInstance | null;
  dropWasAlreadyClaimed: boolean;
}

export async function resolveBattle(input: ResolveBattleInput): Promise<ResolveBattleResult> {
  const today = todayKey();
  const log = await getBattleLog();
  const n = log.filter((e) => e.date === today && e.opponentId === input.opponent.id).length;

  let dropped: PogDef | null = null;
  let lostInstance: PogInstance | null = null;
  let dropWasAlreadyClaimed = false;

  if (input.won) {
    const available = await dropAvailableToday(input.opponent.id);
    if (available && input.opponent.drop) {
      dropped = input.opponent.drop;
      await grantPog(dropped.id, input.opponent.id);
    } else {
      dropWasAlreadyClaimed = true;
    }
  } else if (input.wagerInstanceId) {
    const owned = await getCollection();
    const staked = owned.find((i) => i.id === input.wagerInstanceId);
    if (staked) {
      lostInstance = staked;
      await dbDelete('pogs', staked.id);
    }
  }

  const entry: BattleLogEntry = {
    id: `${today}:${input.opponent.id}:${n}`,
    date: today,
    opponentId: input.opponent.id,
    ranked: input.opponent.ranked,
    won: input.won,
    rounds: input.rounds,
    dropDefId: dropped?.id ?? null,
    lostInstanceId: lostInstance?.id ?? null,
    at: new Date().toISOString(),
  };
  await dbPut('battleLog', entry);

  return { dropped, lostInstance, dropWasAlreadyClaimed };
}
