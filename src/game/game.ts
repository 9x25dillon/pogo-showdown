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
    // the art is hard-edged: multisampling costs a phone's GPU a lot and buys nothing here
    render: { antialiasGL: false, powerPreference: 'high-performance' },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // thumbs at once: hold a direction and press jump and attack together
    input: { activePointers: 5 },
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
  // Blur comes from smoothing a 960-class canvas onto a 1080p screen. At a whole-number scale,
  // nearest-neighbour keeps every pixel and every letter sharp.
  const sharpen = () => {
    const canvas = game.canvas;
    if (!canvas) return;
    const scale = (canvas.getBoundingClientRect().width * window.devicePixelRatio) / game.scale.width;
    canvas.style.imageRendering = Math.abs(scale - Math.round(scale)) < 0.04 && scale >= 1.5 ? 'pixelated' : 'auto';
  };
  game.scale.on('resize', sharpen);
  window.addEventListener('resize', () => setTimeout(sharpen, 60));
  game.events.once('ready', sharpen);
  (window as unknown as { __game?: Phaser.Game }).__game = game; // test hook for automated drives
  return game;
}
