import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { ModeSelectScene } from './scenes/ModeSelectScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { RunScene } from './scenes/RunScene';
import { GameOverScene } from './scenes/GameOverScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { CircuitScene } from './scenes/CircuitScene';

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#0b0714',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, ModeSelectScene, CharacterSelectScene, RunScene, GameOverScene, LeaderboardScene, CircuitScene],
  });
}
