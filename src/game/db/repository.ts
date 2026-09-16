import { CIRCUIT_ROSTER, type CircuitPro } from '../data/circuitRoster';
import { addDaysKey, dayIndex, todayKey } from '../systems/dates';
import { seededRandom, seededRange } from '../systems/seededRandom';
import { proSkillToScore } from '../systems/scoreCurve';
import { computeCurrentAdvantage, grantCircuitWinBonus, grantTierUpBonus } from './loadoutRepository';
import type { AdvantageResult } from './loadoutSchema';
import { dbGet, dbGetAll, dbPut, dbPutMany } from './LocalDB';
import {
  CIRCUIT_UNLOCK_TIER,
  tierForScore,
  tierIndex,
  type MatchLogEntry,
  type PlayerProfile,
  type SeasonState,
  type StandingsRow,
} from './schema';

const MAX_MATCH_LOG = 300;
const MAX_CATCHUP_DAYS = 400;

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

async function ensureStandingsRows(): Promise<void> {
  const rows = await dbGetAll<StandingsRow & { id: string }>('standings');
  const known = new Set(rows.map((r) => r.id));
  const missing: (StandingsRow & { id: string })[] = CIRCUIT_ROSTER.filter((p) => !known.has(p.id)).map((p) => ({
    id: p.id,
    wins: 0,
    losses: 0,
    points: 0,
    streak: 0,
  }));
  if (missing.length) await dbPutMany('standings', missing);
}

async function ensureSeasonState(): Promise<SeasonState> {
  const existing = await dbGet<SeasonState>('season', 'season');
  if (existing) return existing;
  const fresh: SeasonState = { id: 'season', lastSimulatedDate: todayKey(), seasonNumber: 1 };
  await dbPut('season', fresh);
  return fresh;
}

export function opponentForDate(dateKey: string): CircuitPro {
  return CIRCUIT_ROSTER[dayIndex(dateKey) % CIRCUIT_ROSTER.length];
}

function generateOpponentScore(dateKey: string, pro: CircuitPro): number {
  const variance = seededRange(`${dateKey}:oppscore:${pro.id}`, 0.85, 1.15);
  return proSkillToScore(pro.skill, variance);
}

/** Elo-style win probability for A given both skills */
function winProbability(skillA: number, skillB: number): number {
  return 1 / (1 + Math.pow(10, (skillB - skillA) / 14));
}

function applyStreak(streak: number, won: boolean): number {
  if (won) return streak > 0 ? streak + 1 : 1;
  return streak < 0 ? streak - 1 : -1;
}

/** simulate the 11 pros' matches against each other for one calendar day, deterministically */
async function simulateProDay(dateKey: string): Promise<MatchLogEntry[]> {
  const order = [...CIRCUIT_ROSTER];
  // deterministic shuffle seeded by the date
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(`${dateKey}:shuffle:${i}`) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const rows = await dbGetAll<StandingsRow & { id: string }>('standings');
  const byId = new Map(rows.map((r) => [r.id, r]));
  const entries: MatchLogEntry[] = [];

  for (let i = 0; i + 1 < order.length; i += 2) {
    const a = order[i];
    const b = order[i + 1];
    const pA = winProbability(a.skill, b.skill);
    const roll = seededRandom(`${dateKey}:match:${a.id}v${b.id}`);
    const aWins = roll < pA;
    const scoreA = generateOpponentScore(dateKey, a) + (aWins ? 60 : 0);
    const scoreB = generateOpponentScore(dateKey, b) + (!aWins ? 60 : 0);

    const rowA = byId.get(a.id);
    const rowB = byId.get(b.id);
    if (rowA) {
      rowA.wins += aWins ? 1 : 0;
      rowA.losses += aWins ? 0 : 1;
      rowA.points += aWins ? 3 : 0;
      rowA.streak = applyStreak(rowA.streak, aWins);
    }
    if (rowB) {
      rowB.wins += aWins ? 0 : 1;
      rowB.losses += aWins ? 1 : 0;
      rowB.points += aWins ? 0 : 3;
      rowB.streak = applyStreak(rowB.streak, !aWins);
    }

    entries.push({
      id: `${dateKey}:${a.id}v${b.id}`,
      date: dateKey,
      a: a.id,
      b: b.id,
      scoreA,
      scoreB,
      winnerId: aWins ? a.id : b.id,
    });
  }

  await dbPutMany('standings', [...byId.values()]);
  return entries;
}

async function appendMatchLog(entries: MatchLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const existing = await dbGetAll<MatchLogEntry & { id: string }>('matchLog');
  const combined = [...existing, ...entries].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  const trimmed = combined.slice(Math.max(0, combined.length - MAX_MATCH_LOG));
  await dbPutMany('matchLog', trimmed as (MatchLogEntry & { id: string })[]);
}

/**
 * Advances the background circuit simulation up through today, and
 * records a forfeit loss for the player on any past scheduled day they
 * didn't play. Safe to call every time the app opens - fully
 * idempotent per date via seeded RNG.
 */
export async function ensureSeasonSimulated(): Promise<void> {
  await ensureStandingsRows();
  const season = await ensureSeasonState();
  const today = todayKey();
  let cursor = season.lastSimulatedDate ?? today;
  let profile: PlayerProfile | null = null;
  let iterations = 0;

  while (cursor < today && iterations < MAX_CATCHUP_DAYS) {
    iterations += 1;
    const day = addDaysKey(cursor, 1);
    const dayEntries = await simulateProDay(day);

    if (day < today) {
      profile = profile ?? (await getProfile());
      if (profile.circuitUnlockedAt && day >= profile.circuitUnlockedAt && profile.lastCircuitMatchDate !== day) {
        const opponent = opponentForDate(day);
        const oppScore = generateOpponentScore(day, opponent);
        profile.circuitLosses += 1;
        profile.circuitStreak = applyStreak(profile.circuitStreak, false);
        profile.lastCircuitMatchDate = day;
        dayEntries.push({
          id: `${day}:me-forfeit`,
          date: day,
          a: 'me',
          b: opponent.id,
          scoreA: 0,
          scoreB: oppScore,
          winnerId: opponent.id,
          forfeit: true,
        });
      }
    }

    await appendMatchLog(dayEntries);
    cursor = day;
  }

  if (profile) {
    profile.updatedAt = new Date().toISOString();
    await dbPut('profile', profile);
  }

  await dbPut('season', { ...season, lastSimulatedDate: cursor });
}

export interface RecordRunResult {
  profile: PlayerProfile;
  leveledUp: boolean;
  justUnlockedCircuit: boolean;
  techPointsGranted: number;
  circuitMatch: {
    opponent: CircuitPro;
    yourScore: number;
    opponentScore: number;
    battleScore: number;
    advantage: AdvantageResult;
    won: boolean;
  } | null;
}

export async function recordRun(score: number): Promise<RecordRunResult> {
  const profile = await getProfile();
  const today = todayKey();
  let techPointsGranted = 0;

  profile.totalRuns += 1;
  profile.totalScoreCareer += score;
  profile.careerBestScore = Math.max(profile.careerBestScore, score);

  const prevTierIdx = tierIndex(profile.tier);
  const newTier = tierForScore(profile.careerBestScore);
  const leveledUp = tierIndex(newTier.id) > prevTierIdx;
  profile.tier = newTier.id;

  if (leveledUp) {
    await grantTierUpBonus();
    techPointsGranted += 1;
  }

  let justUnlockedCircuit = false;
  if (!profile.circuitUnlockedAt && tierIndex(newTier.id) >= tierIndex(CIRCUIT_UNLOCK_TIER)) {
    profile.circuitUnlockedAt = today;
    justUnlockedCircuit = true;
  }

  let circuitMatch: RecordRunResult['circuitMatch'] = null;
  if (profile.circuitUnlockedAt && profile.circuitUnlockedAt <= today && profile.lastCircuitMatchDate !== today) {
    const opponent = opponentForDate(today);
    const opponentScore = generateOpponentScore(today, opponent);
    const advantage = await computeCurrentAdvantage(profile.totalRuns);
    const battleScore = Math.round(score * (1 + advantage.percent / 100));
    const won = battleScore > opponentScore;

    profile.circuitWins += won ? 1 : 0;
    profile.circuitLosses += won ? 0 : 1;
    profile.circuitPoints += won ? 3 : 0;
    profile.circuitStreak = applyStreak(profile.circuitStreak, won);
    profile.lastCircuitMatchDate = today;

    if (won) {
      const granted = await grantCircuitWinBonus();
      if (granted) techPointsGranted += 1;
    }

    await appendMatchLog([
      {
        id: `${today}:me-live:${profile.totalRuns}`,
        date: today,
        a: 'me',
        b: opponent.id,
        scoreA: battleScore,
        scoreB: opponentScore,
        winnerId: won ? 'me' : opponent.id,
      },
    ]);

    circuitMatch = { opponent, yourScore: score, opponentScore, battleScore, advantage, won };
  }

  profile.updatedAt = new Date().toISOString();
  await dbPut('profile', profile);

  return { profile, leveledUp, justUnlockedCircuit, techPointsGranted, circuitMatch };
}

export interface StandingsEntry {
  id: string;
  name: string;
  epithet: string;
  color: number;
  emoji: string;
  wins: number;
  losses: number;
  points: number;
  streak: number;
  isPlayer: boolean;
}

export async function getStandings(): Promise<StandingsEntry[]> {
  await ensureStandingsRows();
  const rows = await dbGetAll<StandingsRow & { id: string }>('standings');
  const entries: StandingsEntry[] = rows.map((r) => {
    const pro = CIRCUIT_ROSTER.find((p) => p.id === r.id)!;
    return {
      id: pro.id,
      name: pro.name,
      epithet: pro.epithet,
      color: pro.color,
      emoji: pro.emoji,
      wins: r.wins,
      losses: r.losses,
      points: r.points,
      streak: r.streak,
      isPlayer: false,
    };
  });

  const profile = await getProfile();
  if (profile.circuitUnlockedAt) {
    entries.push({
      id: 'me',
      name: profile.name,
      epithet: 'You',
      color: 0xf9d64b,
      emoji: '\u{1F3AF}',
      wins: profile.circuitWins,
      losses: profile.circuitLosses,
      points: profile.circuitPoints,
      streak: profile.circuitStreak,
      isPlayer: true,
    });
  }

  entries.sort((a, b) => b.points - a.points || b.wins - a.wins - (b.losses - a.losses));
  return entries;
}

export async function getRecentMatches(limit: number): Promise<MatchLogEntry[]> {
  const all = await dbGetAll<MatchLogEntry & { id: string }>('matchLog');
  return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit);
}

export function getTodayOpponent(): CircuitPro {
  return opponentForDate(todayKey());
}
