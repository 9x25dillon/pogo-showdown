import {
  ADVANTAGE_CAP,
  CHARACTER_LEVEL_MAX,
  MAX_AXIS_TIER,
  NATURAL_CAP,
  RUNS_PER_CHARACTER_LEVEL,
  TIER_CUMULATIVE_COST,
  TIER_POINTS,
  TIER_STEP_COST,
  TP_FROM_WINS_CAP,
  TP_PER_CIRCUIT_WIN,
  TP_PER_TIER_UP,
  TRADE_IN_REFUND_RATE,
} from '../data/loadoutData';
import { dbGet, dbPut } from './LocalDB';
import type { AdvantageResult, AxisId, AxisState, PlayerLoadout, SetupPath } from './loadoutSchema';

function freshAxis(): AxisState {
  return { tier: 0, unlockedAtRun: -1 };
}

function newLoadout(): PlayerLoadout {
  return {
    id: 'me',
    techPointsEarned: 0,
    techPointsFromWins: 0,
    techPointsSpent: 0,
    pog: freshAxis(),
    yoyo: freshAxis(),
    mastery: freshAxis(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getLoadout(): Promise<PlayerLoadout> {
  const existing = await dbGet<PlayerLoadout>('loadout', 'me');
  if (existing) return existing;
  const created = newLoadout();
  await dbPut('loadout', created);
  return created;
}

export function techPointsAvailable(loadout: PlayerLoadout): number {
  return loadout.techPointsEarned - loadout.techPointsSpent;
}

export function axisState(loadout: PlayerLoadout, axis: AxisId): AxisState {
  return loadout[axis];
}

export function axisPoints(axis: AxisState): number {
  return TIER_POINTS[axis.tier];
}

export function nextTierCost(axis: AxisState): number | null {
  if (axis.tier >= MAX_AXIS_TIER) return null;
  return TIER_STEP_COST[axis.tier + 1];
}

/** you must have played a run at your current tier before the next one can be bought */
export function hasUsedCurrentTier(axis: AxisState, totalRuns: number): boolean {
  return totalRuns > axis.unlockedAtRun;
}

export function characterLevel(totalRuns: number): number {
  return Math.min(CHARACTER_LEVEL_MAX, Math.floor(totalRuns / RUNS_PER_CHARACTER_LEVEL));
}

export async function unlockNextTier(axisId: AxisId, totalRuns: number): Promise<{ ok: boolean; reason?: string }> {
  const loadout = await getLoadout();
  const axis = loadout[axisId];
  const cost = nextTierCost(axis);

  if (cost === null) return { ok: false, reason: 'already maxed' };
  if (!hasUsedCurrentTier(axis, totalRuns)) return { ok: false, reason: 'play a run at your current tier first' };
  if (techPointsAvailable(loadout) < cost) return { ok: false, reason: 'not enough tech points' };

  axis.tier = (axis.tier + 1) as AxisState['tier'];
  axis.unlockedAtRun = totalRuns;
  loadout.techPointsSpent += cost;
  loadout.updatedAt = new Date().toISOString();
  await dbPut('loadout', loadout);
  return { ok: true };
}

/** refunds half the TP sunk into an axis and resets it to tier 0 - the "tradable" side of the economy */
export async function tradeInAxis(axisId: AxisId): Promise<{ ok: boolean; refunded: number }> {
  const loadout = await getLoadout();
  const axis = loadout[axisId];
  if (axis.tier === 0) return { ok: false, refunded: 0 };

  const refund = Math.floor(TIER_CUMULATIVE_COST[axis.tier] * TRADE_IN_REFUND_RATE);
  axis.tier = 0;
  axis.unlockedAtRun = -1;
  loadout.techPointsSpent = Math.max(0, loadout.techPointsSpent - refund);
  loadout.updatedAt = new Date().toISOString();
  await dbPut('loadout', loadout);
  return { ok: true, refunded: refund };
}

/** call once per tier-up (Amateur..Elite) - finite, five ever */
export async function grantTierUpBonus(): Promise<boolean> {
  const loadout = await getLoadout();
  loadout.techPointsEarned += TP_PER_TIER_UP;
  loadout.updatedAt = new Date().toISOString();
  await dbPut('loadout', loadout);
  return true;
}

/** call once per circuit-match win - capped so the pool stays finite */
export async function grantCircuitWinBonus(): Promise<boolean> {
  const loadout = await getLoadout();
  if (loadout.techPointsFromWins >= TP_FROM_WINS_CAP) return false;
  loadout.techPointsFromWins += TP_PER_CIRCUIT_WIN;
  loadout.techPointsEarned += TP_PER_CIRCUIT_WIN;
  loadout.updatedAt = new Date().toISOString();
  await dbPut('loadout', loadout);
  return true;
}

/**
 * The three named setups (Gearhead/equipment, Tactician/skill,
 * Prodigy/mastery) are structurally identical axes that each reach the
 * same +30% ceiling once fully built (24 base points + a +6 synergy
 * bonus for maxing any one axis) - equal advantage, different finite
 * TP-spending path. The secret 4th, The Natural, only exists for a
 * player who has spent zero Tech Points anywhere: once their
 * (free, play-count based) Character Level maxes out, they get a
 * flat-but-lower +15% ceiling on pure experience - a real chance, not
 * parity with players who engaged the gear economy.
 */
export function computeAdvantage(loadout: PlayerLoadout, totalRuns: number): AdvantageResult {
  const pogPts = axisPoints(loadout.pog);
  const yoyoPts = axisPoints(loadout.yoyo);
  const masteryPts = axisPoints(loadout.mastery);

  if (loadout.techPointsSpent === 0) {
    const level = characterLevel(totalRuns);
    if (level >= CHARACTER_LEVEL_MAX) {
      return { percent: Math.min(NATURAL_CAP, level * 1.5), path: 'natural' as SetupPath };
    }
    return { percent: 0, path: 'none' as SetupPath };
  }

  const synergyCount = [pogPts, yoyoPts, masteryPts].filter((p) => p >= TIER_POINTS[MAX_AXIS_TIER]).length;
  const percent = Math.min(ADVANTAGE_CAP, pogPts + yoyoPts + masteryPts + synergyCount * 6);

  let path: SetupPath = 'none';
  if (pogPts >= yoyoPts && pogPts >= masteryPts && pogPts > 0) path = 'gearhead';
  else if (yoyoPts >= masteryPts && yoyoPts > 0) path = 'tactician';
  else if (masteryPts > 0) path = 'prodigy';

  return { percent, path };
}

export async function computeCurrentAdvantage(totalRuns: number): Promise<AdvantageResult> {
  const loadout = await getLoadout();
  return computeAdvantage(loadout, totalRuns);
}

export const SETUP_LABELS: Record<SetupPath, { label: string; emoji: string }> = {
  gearhead: { label: 'Gearhead', emoji: '\u{1F534}' },
  tactician: { label: 'Tactician', emoji: '\u{1FA80}' },
  prodigy: { label: 'Prodigy', emoji: '\u{1F9E0}' },
  natural: { label: 'The Natural', emoji: '\u{2B50}' },
  none: { label: 'Unspecialized', emoji: '➖' },
};
