export type TierId = 'rookie' | 'amateur' | 'varsity' | 'semipro' | 'pro' | 'elite';

export interface TierDef {
  id: TierId;
  label: string;
  /** career-best Pogo Dash score required to reach this tier */
  threshold: number;
}

export const TIERS: TierDef[] = [
  { id: 'rookie', label: 'Rookie', threshold: 0 },
  { id: 'amateur', label: 'Amateur', threshold: 500 },
  { id: 'varsity', label: 'Varsity', threshold: 1500 },
  { id: 'semipro', label: 'Semi-Pro', threshold: 3000 },
  { id: 'pro', label: 'Pro', threshold: 5500 },
  { id: 'elite', label: 'Elite', threshold: 9000 },
];

/** tier at which The Circuit unlocks */
export const CIRCUIT_UNLOCK_TIER: TierId = 'pro';

export function tierForScore(score: number): TierDef {
  let best = TIERS[0];
  for (const t of TIERS) {
    if (score >= t.threshold) best = t;
  }
  return best;
}

export function tierIndex(id: TierId): number {
  return TIERS.findIndex((t) => t.id === id);
}

export interface PlayerProfile {
  id: 'me';
  name: string;
  totalRuns: number;
  totalScoreCareer: number;
  careerBestScore: number;
  tier: TierId;
  /** ISO date (YYYY-MM-DD) the player first reached Pro standing, or null */
  circuitUnlockedAt: string | null;
  circuitWins: number;
  circuitLosses: number;
  circuitPoints: number;
  circuitStreak: number;
  /** last ISO date a circuit match was resolved for the player, or null */
  lastCircuitMatchDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StandingsRow {
  /** competitorId: a circuit pro id, or 'me' */
  id: string;
  wins: number;
  losses: number;
  points: number;
  streak: number;
}

export interface MatchLogEntry {
  id: string;
  date: string;
  a: string;
  b: string;
  scoreA: number;
  scoreB: number;
  winnerId: string;
  forfeit?: boolean;
}

export interface SeasonState {
  id: 'season';
  /** last ISO date the background circuit was simulated through (inclusive) */
  lastSimulatedDate: string | null;
  seasonNumber: number;
}
