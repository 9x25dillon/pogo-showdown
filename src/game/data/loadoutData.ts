import type { AxisTier } from '../db/loadoutSchema';

export interface TierFlavor {
  name: string;
  emoji: string;
  color: number;
}

/** collectible pogs, stacked on the footpeg at the bottom of the pogo stick */
export const POG_TIERS: TierFlavor[] = [
  { name: 'Bare Footpeg', emoji: '⚪', color: 0x6b6180 },
  { name: 'Chipped Pog', emoji: '\u{1F534}', color: 0xb45309 },
  { name: 'Glazed Pog', emoji: '\u{1F7E0}', color: 0xf97316 },
  { name: 'Holographic Pog', emoji: '✨', color: 0x38bdf8 },
  { name: 'The Slammer', emoji: '\u{1F4A5}', color: 0xf9d64b },
];

/** yoyos hung off the end of the pogo stick's handle */
export const YOYO_TIERS: TierFlavor[] = [
  { name: 'Empty Handle', emoji: '⚪', color: 0x6b6180 },
  { name: 'Wooden Yoyo', emoji: '\u{1FA80}', color: 0x92400e },
  { name: 'Butterfly Yoyo', emoji: '\u{1FA80}', color: 0xa855f7 },
  { name: 'Ball-Bearing Yoyo', emoji: '\u{1FA80}', color: 0x22d3ee },
  { name: 'Signature Yoyo', emoji: '\u{1FA80}', color: 0xf9d64b },
];

/** the player's own technique, earned by playing - not an item */
export const MASTERY_TIERS: TierFlavor[] = [
  { name: 'Rookie Instinct', emoji: '\u{1F331}', color: 0x6b6180 },
  { name: 'Sharpened Technique', emoji: '\u{1F4AA}', color: 0x4ade80 },
  { name: 'Veteran Endurance', emoji: '\u{1F525}', color: 0xf97316 },
  { name: 'Elite Reflexes', emoji: '⚡', color: 0x38bdf8 },
  { name: 'Grandmaster Instinct', emoji: '\u{1F9E0}', color: 0xf9d64b },
];

/** cumulative Advantage points at each tier (0-4) */
export const TIER_POINTS: readonly number[] = [0, 6, 12, 18, 24];

/** TP cost to reach each tier from the previous one (index 0 unused) */
export const TIER_STEP_COST: readonly number[] = [0, 2, 4, 6, 6];

/** cumulative TP spent to reach each tier, used for trade-in refunds */
export const TIER_CUMULATIVE_COST: readonly number[] = [0, 2, 6, 12, 18];

export const MAX_AXIS_TIER: AxisTier = 4;
export const SYNERGY_BONUS = 6;
export const ADVANTAGE_CAP = 30;
export const NATURAL_CAP = 15;
export const TRADE_IN_REFUND_RATE = 0.5;

/** lifetime Tech Point sources - both finite, so the whole economy is capped */
export const TP_PER_TIER_UP = 1; // x5 tier-ups possible (Amateur..Elite) = 5 TP
export const TP_PER_CIRCUIT_WIN = 1;
export const TP_FROM_WINS_CAP = 20;

/** Character Level (free, play-count based) - the gate for the secret Natural path */
export const RUNS_PER_CHARACTER_LEVEL = 4;
export const CHARACTER_LEVEL_MAX = 10; // reached at 40 total runs
