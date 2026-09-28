import { dbGet, dbPut } from './LocalDB';
import type { PlayerProfile } from './schema';

function newProfile(): PlayerProfile {
  const now = new Date().toISOString();
  return {
    id: 'me',
    name: 'You',
    totalRuns: 0,
    totalScoreCareer: 0,
    careerBestScore: 0,
    tier: 'rookie',
    circuitUnlockedAt: null,
    circuitWins: 0,
    circuitLosses: 0,
    circuitPoints: 0,
    circuitStreak: 0,
    lastCircuitMatchDate: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getProfile(): Promise<PlayerProfile> {
  const existing = await dbGet<PlayerProfile>('profile', 'me');
  if (existing) return existing;
  const created = newProfile();
  await dbPut('profile', created);
  return created;
}
