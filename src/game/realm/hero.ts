import { CHARACTERS, type Character } from '../data/characters';
import { MASTERY_TIERS } from '../data/loadoutData';
import type { PogPerks } from '../data/pogs';

/**
 * The Realm hero: whichever highschooler you play, levelled by XP earned
 * in the world, dressed in the pogs on your footpeg. Pure rules only - the
 * scene reads `HeroStats` and never hard-codes a character.
 *
 * Balance (the whole table, so tuning happens here):
 *   level 1-20        +3 max HP and +1.5% damage per level (+57 HP, +28.5% at 20)
 *   mastery tier 0-4  one tier per 5 levels; scales the character perk by 1 + 0.25·tier
 *   style combo       +5% damage per chained hit, cap 30% (+ perks), resets when hit
 *   guard pips        absorb a whole hit; one pip recharges every 20s out of combat
 *   revives           get back up where you fell at half HP; refilled by sleeping
 *   unbanked XP       XP counts once you rest at home or win a realm; dying loses half
 */
export const LEVEL_MAX = 20;
export const HP_PER_LEVEL = 3;
export const DAMAGE_PER_LEVEL = 0.015;
export const COMBO_STEP = 0.05;
export const BASE_COMBO_CAP = 0.3;
export const BASE_COMBO_DECAY_MS = 1800;
export const BASE_GUARD_RECHARGE_MS = 20_000;
export const GUARD_QUIET_MS = 3000;
export const CRIT_MULT = 1.75;
export const DEATH_XP_LOSS = 0.5;

export interface HeroStats {
  maxHpBonus: number;
  damageMult: number;
  moveMult: number;
  jumpMult: number;
  /** 0-1 */
  critChance: number;
  guardPips: number;
  guardRechargeMs: number;
  /** getting hit through a guard keeps your combo (Sun Tzu) */
  guardKeepsCombo: boolean;
  regenMult: number;
  /** chance of one extra drop from kills and ore, 0-1+ */
  lootLuck: number;
  comboCap: number;
  comboDecayMs: number;
  revives: number;
  invulnMult: number;
  trickWindowMult: number;
}

export function baseStats(): HeroStats {
  return {
    maxHpBonus: 0, damageMult: 1, moveMult: 1, jumpMult: 1, critChance: 0.05, guardPips: 0,
    guardRechargeMs: BASE_GUARD_RECHARGE_MS, guardKeepsCombo: false, regenMult: 1, lootLuck: 0,
    comboCap: BASE_COMBO_CAP, comboDecayMs: BASE_COMBO_DECAY_MS, revives: 0, invulnMult: 1, trickWindowMult: 1,
  };
}

/** each highschooler's perk, restated for an action game; `s` is the mastery scale (1-2) */
export const HERO_PERKS: Record<string, { label: string; apply: (st: HeroStats, s: number) => void }> = {
  cleo: { label: 'Style+ · combo cap +25%', apply: (st, s) => { st.comboCap += 0.25 * s; } },
  khan: { label: 'Power+ · +20 HP and a guard pip', apply: (st, s) => { st.maxHpBonus += Math.round(20 * s); st.guardPips += 1; } },
  joan: { label: 'Trick+ · +12% critical hits', apply: (st, s) => { st.critChance += 0.12 * s; } },
  einstein: { label: 'Momentum+ · +12% move speed', apply: (st, s) => { st.moveMult += 0.12 * s; } },
  ada: { label: 'Precision+ · higher jumps, longer i-frames, looser trick windows', apply: (st, s) => {
    st.jumpMult += 0.08 * s; st.invulnMult += 0.3 * s; st.trickWindowMult += 0.15 * s;
  } },
  suntzu: { label: 'Tactician · a guard pip that protects your combo, faster recharge', apply: (st, s) => {
    st.guardPips += 1; st.guardKeepsCombo = true; st.guardRechargeMs *= 1 - Math.min(0.6, 0.3 * s);
  } },
  frida: { label: 'Flow+ · +75% regen, combos linger 50% longer', apply: (st, s) => {
    st.regenMult += 0.75 * s; st.comboDecayMs *= 1 + 0.5 * s;
  } },
  leo: { label: 'Gadgets+ · +25% extra loot', apply: (st, s) => { st.lootLuck += 0.25 * s; } },
};

/** XP to go from `level` to `level + 1` */
export function xpToNext(level: number): number {
  return level >= LEVEL_MAX ? Infinity : Math.round(25 * Math.pow(level, 1.3));
}

export function levelForXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = Math.max(0, Math.floor(xp));
  while (level < LEVEL_MAX && left >= xpToNext(level)) {
    left -= xpToNext(level);
    level++;
  }
  return { level, into: left, need: xpToNext(level) };
}

export function masteryTierForLevel(level: number): number {
  return Math.min(MASTERY_TIERS.length - 1, Math.floor(level / 5));
}

export function characterById(id: string | undefined): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

/**
 * Pogs on the footpeg, restated for the Realm (their Pogo Dash meaning in brackets):
 *   extraLives → revives   shieldHits → guard pips   flair → combo cap
 *   starBonus → loot luck (points → %)   trickBonus → crit (points → %)
 *   speedScale → move speed   secondWind → one more revive
 */
export function computeHeroStats(characterId: string, level: number, pogs: Required<PogPerks>): HeroStats {
  const st = baseStats();
  const tier = masteryTierForLevel(level);
  HERO_PERKS[characterById(characterId).id]?.apply(st, 1 + 0.25 * tier);
  st.maxHpBonus += (level - 1) * HP_PER_LEVEL;
  st.damageMult += (level - 1) * DAMAGE_PER_LEVEL;
  st.revives += pogs.extraLives + (pogs.secondWind ? 1 : 0);
  st.guardPips += pogs.shieldHits;
  st.comboCap += pogs.flair;
  st.lootLuck += pogs.starBonus / 100;
  st.critChance += pogs.trickBonus / 100;
  st.moveMult *= pogs.speedScale;
  st.critChance = Math.min(0.6, st.critChance);
  return st;
}

/** a pog's passive perks, in Realm terms (see computeHeroStats) */
export function describeRealmPerks(p: PogPerks): string[] {
  const out: string[] = [];
  const revives = (p.extraLives ?? 0) + (p.secondWind ? 1 : 0);
  if (revives) out.push(`+${revives} revive`);
  if (p.shieldHits) out.push(`+${p.shieldHits} guard pip${p.shieldHits > 1 ? 's' : ''}`);
  if (p.flair) out.push(`+${Math.round(p.flair * 100)}% combo cap`);
  if (p.starBonus) out.push(`+${p.starBonus}% loot`);
  if (p.trickBonus) out.push(`+${p.trickBonus}% crit`);
  if (p.speedScale && p.speedScale !== 1) out.push(`${p.speedScale > 1 ? '+' : ''}${Math.round((p.speedScale - 1) * 100)}% speed`);
  return out;
}

export function comboBonus(stacks: number, cap: number): number {
  return Math.min(cap, stacks * COMBO_STEP);
}

/** XP a kill is worth: tougher and harder-hitting creatures pay more */
export function killXp(hp: number, damage: number): number {
  return Math.ceil(hp / 3 + damage / 2);
}

export const ORE_XP: Record<string, number> = { copper: 1, iron: 2, soulstone: 4 };
export const BOSS_XP: Record<string, number> = { tyrant: 250, leviathan: 320, harpy: 400, king: 500, reaper: 1000, warden: 300 };
