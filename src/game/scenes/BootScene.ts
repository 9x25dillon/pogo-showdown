import Phaser from 'phaser';
import { COLORS } from '../config';

/**
 * No art assets in the MVP - every texture is drawn procedurally with
 * Graphics and baked into the texture cache once at boot.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makePlayerTexture();
    this.makeHurdleTexture();
    this.makeBannerTexture();
    this.makeStarTexture();
    this.makeParticleTexture();
    this.scene.start('ModeSelect');
  }

  private makePlayerTexture(): void {
    const g = this.add.graphics();
    // pogo stick
    g.fillStyle(0x3a3040, 1);
    g.fillRect(27, 40, 6, 26);
    // spring
    g.lineStyle(3, 0x8a8098, 1);
    g.strokeCircle(30, 40, 8);
    // footpeg
    g.fillStyle(0x3a3040, 1);
    g.fillRoundedRect(12, 62, 36, 8, 3);
    // body (tinted white so it can be recolored per-character)
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(14, 8, 32, 34, 10);
    // face
    g.fillStyle(0x22182f, 1);
    g.fillCircle(22, 24, 2.5);
    g.fillCircle(38, 24, 2.5);
    g.generateTexture('player', 60, 74);
    g.destroy();
  }

  private makeHurdleTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.danger, 1);
    g.fillRoundedRect(0, 0, 120, 24, 6);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(0, 0, 120, 6);
    g.generateTexture('hurdle', 120, 24);
    g.destroy();
  }

  private makeBannerTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x8b5cf6, 1);
    g.fillRoundedRect(0, 0, 120, 20, 6);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(0, 0, 120, 5);
    g.generateTexture('banner', 120, 20);
    g.destroy();
  }

  private makeStarTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.accent, 1);
    const cx = 20;
    const cy = 20;
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 18 : 8;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      points.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    g.fillPoints(points, true);
    g.generateTexture('star', 40, 40);
    g.destroy();
  }

  private makeParticleTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('particle', 12, 12);
    g.destroy();
  }
}
