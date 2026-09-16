import type { SetupPath } from './loadoutSchema';
import type { TierId } from './schema';

/** payload handed from RunScene to GameOverScene via the registry */
export interface RunResult {
  score: number;
  bestCombo: number;
  characterId: string;
  leveledUp: boolean;
  newTierId: TierId;
  justUnlockedCircuit: boolean;
  techPointsGranted: number;
  circuitMatch: {
    opponentName: string;
    opponentEmoji: string;
    yourScore: number;
    opponentScore: number;
    battleScore: number;
    advantagePercent: number;
    setupPath: SetupPath;
    won: boolean;
  } | null;
}
