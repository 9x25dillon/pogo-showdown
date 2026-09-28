import { CHARACTERS } from '../data/characters';
import { MAX_AXIS_TIER, TIER_STEP_COST } from '../data/loadoutData';
import { BASE_FOOTPEG_CAPACITY, EMPTY_PERKS, RARITY_WEIGHT, aggregatePerks, pogDef, type PogDef, type PogPerks } from '../data/pogs';
import { dbPut } from '../db/LocalDB';
import { getLoadout, techPointsAvailable } from '../db/loadoutRepository';
import { ensureStarterPog, getCollection, weightOf } from '../db/pogRepository';
import type { PogInstance } from '../db/pogSchema';
import { getProfile } from '../db/repository';
import type { PlayerProfile, RealmMeta } from '../db/schema';
import { characterById, levelForXp } from './hero';

/**
 * Account-level progress that outlives any one world: which hero you play,
 * each hero's XP, Tech Points, footpeg size, the pog collection, and the
 * records of every in-world activity. "New World" erases terrain and
 * items, never these.
 */
export function realmMeta(profile: PlayerProfile): RealmMeta {
  const m = profile.realm ?? {};
  return {
    milestones: m.milestones ?? [],
    duels: m.duels ?? {},
    dash: m.dash ?? {},
    arena: m.arena ?? { beaten: [], bestScores: {} },
  };
}

export async function saveMeta(mutate: (meta: RealmMeta, profile: PlayerProfile) => void): Promise<PlayerProfile> {
  const profile = await getProfile();
  const meta = realmMeta(profile);
  mutate(meta, profile);
  profile.realm = meta;
  profile.updatedAt = new Date().toISOString();
  await dbPut('profile', profile);
  return profile;
}

export function heroId(profile: PlayerProfile): string {
  return characterById(profile.lastCharacterId).id;
}

export function heroXp(profile: PlayerProfile, characterId: string): number {
  return profile.characters?.[characterId]?.xp ?? 0;
}

export async function setHero(characterId: string): Promise<void> {
  const id = CHARACTERS.find((c) => c.id === characterId)?.id ?? CHARACTERS[0].id;
  await saveMeta((_m, p) => { p.lastCharacterId = id; });
}

/** bank XP into a hero; returns the levels before and after */
export async function bankXp(characterId: string, amount: number): Promise<{ before: number; after: number; xp: number }> {
  let before = 1;
  let after = 1;
  let xp = 0;
  await saveMeta((_m, p) => {
    const prev = p.characters?.[characterId] ?? { runs: 0, trainingRuns: 0, bestScore: 0 };
    before = levelForXp(prev.xp ?? 0).level;
    xp = (prev.xp ?? 0) + Math.max(0, Math.round(amount));
    after = levelForXp(xp).level;
    p.characters = { ...p.characters, [characterId]: { ...prev, xp } };
  });
  return { before, after, xp };
}

/**
 * Tech Points stay a finite, milestone-only currency: every source is a
 * one-time `key` (a boss's first defeat, a pro's first duel loss, a gold
 * medal...), so the economy can't be farmed. Returns whether it paid.
 */
export async function grantMilestone(key: string, points = 1): Promise<boolean> {
  const profile = await getProfile();
  const meta = realmMeta(profile);
  if (meta.milestones.includes(key)) return false;
  meta.milestones.push(key);
  profile.realm = meta;
  profile.updatedAt = new Date().toISOString();
  await dbPut('profile', profile);
  const loadout = await getLoadout();
  loadout.techPointsEarned += points;
  loadout.updatedAt = new Date().toISOString();
  await dbPut('loadout', loadout);
  return true;
}

export async function footpegTier(): Promise<number> {
  return (await getLoadout()).pog.tier;
}

export async function tpAvailable(): Promise<number> {
  return techPointsAvailable(await getLoadout());
}

/** Tech Points buy footpeg room: 4 → 8 weight, at 2/4/6/6 TP */
export async function buyFootpegTier(): Promise<{ ok: boolean; reason?: string }> {
  const loadout = await getLoadout();
  if (loadout.pog.tier >= MAX_AXIS_TIER) return { ok: false, reason: 'footpeg is already full size' };
  const cost = TIER_STEP_COST[loadout.pog.tier + 1];
  if (techPointsAvailable(loadout) < cost) return { ok: false, reason: `needs ${cost} Tech Points` };
  loadout.pog = { tier: (loadout.pog.tier + 1) as typeof loadout.pog.tier, unlockedAtRun: 0 };
  loadout.techPointsSpent += cost;
  loadout.updatedAt = new Date().toISOString();
  await dbPut('loadout', loadout);
  return { ok: true };
}

export interface PogRow {
  instance: PogInstance;
  def: PogDef;
}

export interface HeroSnapshot {
  profile: PlayerProfile;
  characterId: string;
  xp: number;
  pogs: PogRow[];
  perks: Required<PogPerks>;
  capacity: number;
  tp: number;
}

export async function loadHeroSnapshot(): Promise<HeroSnapshot> {
  await ensureStarterPog();
  const [profile, owned, loadout] = await Promise.all([getProfile(), getCollection(), getLoadout()]);
  const characterId = heroId(profile);
  const pogs = owned.map((instance) => ({ instance, def: pogDef(instance.defId) })).filter((r): r is PogRow => !!r.def);
  const equipped = pogs.filter((r) => r.instance.equipped).map((r) => r.def);
  return {
    profile, characterId, xp: heroXp(profile, characterId), pogs,
    perks: equipped.length ? aggregatePerks(equipped) : { ...EMPTY_PERKS },
    capacity: BASE_FOOTPEG_CAPACITY + loadout.pog.tier,
    tp: techPointsAvailable(loadout),
  };
}

export function equippedWeight(pogs: PogRow[]): number {
  return weightOf(pogs.filter((r) => r.instance.equipped).map((r) => r.instance));
}

export function pogWeight(def: PogDef): number {
  return RARITY_WEIGHT[def.rarity];
}

export async function saveDuelist(id: string, mutate: (d: NonNullable<RealmMeta['duels']>[string]) => void): Promise<void> {
  await saveMeta((m) => {
    const d = m.duels[id] ?? { wins: 0, losses: 0 };
    mutate(d);
    m.duels[id] = d;
  });
}

export async function readMeta(): Promise<RealmMeta> {
  return realmMeta(await getProfile());
}

