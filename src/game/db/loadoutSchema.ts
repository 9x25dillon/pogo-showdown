export type AxisId = 'pog' | 'yoyo' | 'mastery';
export type AxisTier = 0 | 1 | 2 | 3 | 4;

export interface AxisState {
  tier: AxisTier;
  /** profile.totalRuns value at the moment this tier was reached - the next tier can't be bought until totalRuns exceeds this (must play a run "equipped" at the current tier first) */
  unlockedAtRun: number;
}

export interface PlayerLoadout {
  id: 'me';
  techPointsEarned: number;
  /** subset of techPointsEarned that came from circuit wins - capped independently so the lifetime pool stays finite */
  techPointsFromWins: number;
  techPointsSpent: number;
  pog: AxisState;
  yoyo: AxisState;
  /** Legacy shared training, retained only for save migration. */
  mastery: AxisState;
  characterMasteryMigrated?: boolean;
  masteryRefund?: number;
  updatedAt: string;
}

export type SetupPath = 'gearhead' | 'tactician' | 'prodigy' | 'natural' | 'none';

export interface AdvantageResult {
  percent: number;
  path: SetupPath;
}
