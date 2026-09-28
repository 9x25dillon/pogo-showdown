import { CHARACTERS } from '../data/characters';
import { CIRCUIT_ROSTER } from '../data/circuitRoster';
import { pogForOpponent, type PogDef } from '../data/pogs';
import type { ItemId } from './items';
import { isSolid, T } from './tiles';
import type { World } from './worldGen';

/**
 * Pog Battles, in the world. Highschoolers practise in the Schoolyard
 * west of spawn; the eleven Circuit pros haunt the overworld, the three
 * best down in the caverns. Walk up, press ▼, slam.
 *
 * A duel is best of three slams: a marker sweeps a bar, you stop it. Dead
 * centre (the sweet zone) is 100 power, falling off towards the ends. The
 * opponent's power is their skill plus a roll. Tougher opponents sweep
 * faster and shrink the sweet zone.
 *
 * Stakes (the risk/reward table):
 *   friendly     nothing staked · win: XP
 *   for keeps    practice: stake 6 copper · win: 14 copper + a potion + their signature pog
 *                pros: stake one of your pogs · win: their signature pog, double XP,
 *                      and a Tech Point the first time you beat each pro for keeps
 *                lose: the stake is gone for good
 *   their signature pog pays out once per duelist per realm day (one day/night cycle)
 *   pros only accept duels once you have beaten RANKED_UNLOCK_WINS different highschoolers
 *
 * Your stats lean on the slam: +0.5 power per hero level, +1 per point of
 * footpeg weight you carry, crit widens the sweet zone, and a looser trick
 * window (Ada) slows the sweep.
 */
export const ROUNDS_TO_WIN = 2;
export const BAR_W = 360;
export const RANKED_UNLOCK_WINS = 4;
export const PRACTICE_STAKE: { item: ItemId; count: number } = { item: 'copper', count: 6 };
export const PRACTICE_PRIZE: Partial<Record<ItemId, number>> = { copper: 14, potion: 1 };
export const PRO_FIRST_WIN_XP = 60;

export interface Duelist {
  id: string;
  name: string;
  epithet: string;
  emoji: string;
  color: number;
  skill: number;
  ranked: boolean;
  signature?: PogDef;
}

/** highschoolers are practice (skill 45-65); pros use their circuit skill */
export function duelists(): Duelist[] {
  const hs = CHARACTERS.map((c, i) => ({ id: c.id, name: c.name, epithet: c.club, emoji: c.emoji, color: c.color, skill: 45 + ((i * 7) % 21), ranked: false, signature: pogForOpponent(c.id) }));
  const pros = CIRCUIT_ROSTER.map((p) => ({ id: p.id, name: p.name, epithet: p.epithet, emoji: p.emoji, color: p.color, skill: p.skill, ranked: true, signature: pogForOpponent(p.id) }));
  return [...hs, ...pros];
}

/** 0 (easiest practice) → 1 (Bruce Lee) */
function hardness(skill: number): number {
  return Math.min(1, Math.max(0, (skill - 45) / 52));
}

export interface SlamTuning {
  /** full bar widths per second */
  sweep: number;
  /** px either side of centre that count as a perfect slam */
  sweet: number;
  /** flat power added to every slam */
  bonus: number;
}

export function slamTuning(skill: number, hero: { level: number; critChance: number; trickWindowMult: number; footpegWeight: number }): SlamTuning {
  const h = hardness(skill);
  return {
    sweep: (1.2 + h * 1.2) / hero.trickWindowMult,
    sweet: Math.min(40, 26 - h * 12 + hero.critChance * 25),
    bonus: hero.level * 0.5 + hero.footpegWeight,
  };
}

/** your slam: markerT in [0, 1], centre is 0.5 */
export function slamPower(markerT: number, tuning: SlamTuning): { power: number; perfect: boolean } {
  const offset = Math.abs(markerT - 0.5) * BAR_W;
  if (offset <= tuning.sweet) return { power: Math.round(100 + tuning.bonus), perfect: true };
  const t = Math.max(0, 1 - (offset - tuning.sweet) / (BAR_W / 2 - tuning.sweet));
  return { power: Math.round(100 * Math.pow(t, 1.3) + tuning.bonus), perfect: false };
}

/** their slam: skill-driven mean, ±12 roll */
export function opponentPower(skill: number, roll: number): number {
  return Math.round(40 + skill * 0.55 + (roll * 2 - 1) * 12);
}

export function duelXp(skill: number, forKeeps: boolean): number {
  return Math.round((15 + skill / 5) * (forKeeps ? 2 : 1));
}

export interface DuelSpot {
  tx: number;
  /** the air tile the duelist stands in (feet on ty + 1) */
  ty: number;
  seen: boolean;
}

function standable(world: World, tx: number, ty: number): boolean {
  const t = (x: number, y: number) => (x < 0 || y < 0 || x >= world.w || y >= world.h ? T.BEDROCK : world.tiles[y * world.w + x]);
  return t(tx, ty) === T.AIR && t(tx, ty - 1) === T.AIR && t(tx, ty - 2) === T.AIR && isSolid(t(tx, ty + 1));
}

/** the ground under open sky at a column (after edits) */
export function surfaceStand(world: World, tx: number): number {
  for (let ty = 3; ty < world.h - 3; ty++) if (standable(world, tx, ty)) return ty;
  return world.surface[tx] - 1;
}

/**
 * Where everyone stands. Highschoolers line the Schoolyard just west of
 * spawn; pros alternate east and west, further out the better they are,
 * and the top three wait in caverns 30-90 tiles down.
 */
export function placeDuelists(world: World): Record<string, DuelSpot> {
  const spots: Record<string, DuelSpot> = {};
  CHARACTERS.forEach((c, i) => {
    const tx = world.spawn.tx - 12 - i * 5;
    spots[c.id] = { tx, ty: surfaceStand(world, tx), seen: false };
  });
  const pros = [...CIRCUIT_ROSTER].sort((a, b) => a.skill - b.skill);
  let east = 0;
  let west = 0;
  pros.forEach((p, rank) => {
    const goEast = rank % 2 === 0;
    const d = goEast ? 80 + 40 * east++ : 120 + 40 * west++;
    const base = Math.max(6, Math.min(world.w - 7, world.spawn.tx + (goEast ? d : -d)));
    const deep = rank >= pros.length - 3;
    let spot: DuelSpot | undefined;
    if (deep) {
      for (let dx = 0; dx < 40 && !spot; dx++) {
        for (const tx of [base + dx, base - dx]) {
          if (tx < 4 || tx >= world.w - 4) continue;
          for (let ty = world.surface[tx] + 30; ty < Math.min(world.h - 5, world.surface[tx] + 90); ty++) {
            if (standable(world, tx, ty) && standable(world, tx + 1, ty) && standable(world, tx - 1, ty)) { spot = { tx, ty, seen: false }; break; }
          }
          if (spot) break;
        }
      }
    }
    spots[p.id] = spot ?? { tx: base, ty: surfaceStand(world, base), seen: false };
  });
  return spots;
}
