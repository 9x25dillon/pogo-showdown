export interface ScoreEntry {
  name: string;
  characterId: string;
  score: number;
  date: string;
}

export interface LeaderboardService {
  submitScore(entry: ScoreEntry): Promise<{ rank: number }>;
  getTop(n: number): Promise<ScoreEntry[]>;
}

const STORAGE_KEY = 'pogo-showdown:leaderboard';

/**
 * MVP implementation backed by localStorage. Swap this out for a
 * fetch()-based implementation of the same interface once there's a
 * real backend, without touching any scene code.
 */
export class LocalLeaderboardService implements LeaderboardService {
  private read(): ScoreEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
    } catch {
      return [];
    }
  }

  private write(entries: ScoreEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // storage unavailable (private mode etc) - fail silently for MVP
    }
  }

  async submitScore(entry: ScoreEntry): Promise<{ rank: number }> {
    const entries = this.read();
    entries.push(entry);
    entries.sort((a, b) => b.score - a.score);
    const trimmed = entries.slice(0, 50);
    this.write(trimmed);
    const rank = trimmed.findIndex(
      (e) => e === entry || (e.score === entry.score && e.date === entry.date && e.name === entry.name),
    );
    return { rank: rank === -1 ? trimmed.length : rank };
  }

  async getTop(n: number): Promise<ScoreEntry[]> {
    return this.read().slice(0, n);
  }
}

export const leaderboardService: LeaderboardService = new LocalLeaderboardService();
