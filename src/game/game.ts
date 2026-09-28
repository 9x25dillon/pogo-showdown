import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { PlatformerRunScene } from './scenes/PlatformerRunScene';
import { PlatformerResultScene } from './scenes/PlatformerResultScene';
import { PlatformerPauseScene } from './scenes/PlatformerPauseScene';
import { RealmScene } from './scenes/RealmScene';

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
    // gravity is set per-body (the Realm hero, Pog Quest heroes), so the world default stays inert
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [
      BootScene,
      TitleScene,
      RealmScene,
      PlatformerRunScene,
      PlatformerResultScene,
      PlatformerPauseScene,
    ],
  });
  (window as unknown as { __game?: Phaser.Game }).__game = game; // test hook for automated drives
  return game;
}
