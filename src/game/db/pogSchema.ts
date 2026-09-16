/** one owned copy of a catalog pog */
export interface PogInstance {
  id: string;
  defId: string;
  equipped: boolean;
  /** opponent id, 'starter', or 'wager' (won from a stake) */
  source: string;
  acquiredAt: string;
}

/** one Pog Battle outcome; id = `${date}:${opponentId}:${n}` */
export interface BattleLogEntry {
  id: string;
  date: string;
  opponentId: string;
  ranked: boolean;
  won: boolean;
  rounds: { you: number; them: number }[];
  /** catalog id dropped to the player, if any */
  dropDefId: string | null;
  /** instance id the player staked and lost, if any */
  lostInstanceId: string | null;
  at: string;
}
