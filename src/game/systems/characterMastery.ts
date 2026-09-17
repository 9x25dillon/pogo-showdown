import type { AxisTier } from '../db/loadoutSchema';
import type { PlayerProfile } from '../db/schema';

export interface CharacterProgress {
  runs: number;
  trainingRuns: number;
  bestScore: number;
}

export const MASTERY_RUNS = [0, 4, 12, 24, 40] as const;
export const TRAINING_SECONDS = 15;

export function progressFor(profile: PlayerProfile, characterId: string): CharacterProgress {
  return profile.characters?.[characterId] ?? { runs: 0, trainingRuns: 0, bestScore: 0 };
}

export function masteryTier(trainingRuns: number): AxisTier {
  let tier = 0;
  for (let i = 1; i < MASTERY_RUNS.length; i++) {
    if (trainingRuns >= MASTERY_RUNS[i]) tier = i;
  }
  return tier as AxisTier;
}

export function masterySummary(progress: CharacterProgress): string {
  const tier = masteryTier(progress.trainingRuns);
  return tier === 4 ? 'Grandmaster · all milestones complete' : `${progress.trainingRuns}/${MASTERY_RUNS[tier + 1]} training runs to next mastery`;
}
