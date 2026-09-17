import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { ModeSelectScene } from './scenes/ModeSelectScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { RunScene } from './scenes/RunScene';
import { GameOverScene } from './scenes/GameOverScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { CircuitScene } from './scenes/CircuitScene';
import { LoadoutScene } from './scenes/LoadoutScene';
import { TrickLabScene } from './scenes/TrickLabScene';
import { PogBinderScene } from './scenes/PogBinderScene';
import { PogBattleScene } from './scenes/PogBattleScene';
import { PlatformerRunScene } from './scenes/PlatformerRunScene';
import { PlatformerResultScene } from './scenes/PlatformerResultScene';

export function createGame(parent: string): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#0b0714',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // gravity is set per-body (see PlatformerRunScene) so this stays inert
    // for every other scene, none of which call this.physics.add.*
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [
      BootScene,
      ModeSelectScene,
      CharacterSelectScene,
      RunScene,
      GameOverScene,
      LeaderboardScene,
      CircuitScene,
      LoadoutScene,
      TrickLabScene,
      PogBinderScene,
      PogBattleScene,
      PlatformerRunScene,
      PlatformerResultScene,
    ],
  });
  (window as unknown as { __game?: Phaser.Game }).__game = game; // test hook for automated drives
  return game;
}
