/** payload handed from PlatformerRunScene to PlatformerResultScene via the registry */
export interface PlatformerResult {
  raceOutcome: 'playerWon' | 'rivalWon' | 'fell';
  coins: number;
  elapsedSeconds: number;
  bestStompCombo: number;
  characterId: string;
  levelIndex: number;
}
