import type { PlayerProfile } from '../db/schema';

export interface CharacterProgress {
  runs: number;
  trainingRuns: number;
  bestScore: number;
  /** Forever Realm hero XP (banked) */
  xp?: number;
}

export const TRAINING_SECONDS = 15;

export function progressFor(profile: PlayerProfile, characterId: string): CharacterProgress {
  return profile.characters?.[characterId] ?? { runs: 0, trainingRuns: 0, bestScore: 0 };
}
