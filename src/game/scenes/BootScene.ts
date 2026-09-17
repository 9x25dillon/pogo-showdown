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
    g.fillStyle(0xffffff, 0.4);
    g.fillRoundedRect(18, 10, 24, 7, 3);
    g.lineStyle(2, 0xe2e8f0, 0.7);
    g.lineBetween(30, 48, 30, 60);
    g.fillStyle(0x64748b, 1);
    g.fillRoundedRect(10, 39, 14, 7, 3);
    g.fillRoundedRect(36, 39, 14, 7, 3);
    // face
    g.fillStyle(0x22182f, 1);
    g.fillCircle(22, 24, 2.5);
    g.fillCircle(38, 24, 2.5);
    g.generateTexture('player', 60, 74);
    g.destroy();
  }

  private makeHurdleTexture(): void {
    const g = this.add.graphics();
    // Raised orange barrier with upward chevrons: jump over it.
    g.fillStyle(0x2a1520, 1);
    g.fillRoundedRect(0, 0, 120, 34, 5);
    g.fillStyle(0xf97316, 1);
    g.fillRoundedRect(2, 2, 116, 22, 4);
    g.fillStyle(0xfed7aa, 1);
    g.fillRect(6, 3, 108, 3);
    g.fillStyle(0x94a3b8, 1);
    g.fillRect(8, 24, 8, 10);
    g.fillRect(104, 24, 8, 10);
    g.lineStyle(3, 0x431407, 1);
    for (const x of [28, 60, 92]) {
      g.beginPath(); g.moveTo(x - 7, 17); g.lineTo(x, 9); g.lineTo(x + 7, 17); g.strokePath();
    }
    g.generateTexture('hurdle', 120, 34);
    g.destroy();
  }

  private makeBannerTexture(): void {
    const g = this.add.graphics();
    // Hanging pennant with downward chevrons: duck underneath.
    g.fillStyle(0x64748b, 1);
    g.fillRect(8, 0, 3, 10);
    g.fillRect(109, 0, 3, 10);
    g.fillStyle(0x8b5cf6, 1);
    g.fillRoundedRect(0, 8, 120, 24, 4);
    g.fillTriangle(0, 25, 12, 40, 24, 25);
    g.fillTriangle(96, 25, 108, 40, 120, 25);
    g.fillStyle(0xc4b5fd, 1);
    g.fillRect(4, 9, 112, 3);
    g.lineStyle(3, 0xffffff, 0.9);
    for (const x of [28, 60, 92]) {
      g.beginPath(); g.moveTo(x - 7, 18); g.lineTo(x, 26); g.lineTo(x + 7, 18); g.strokePath();
    }
    g.generateTexture('banner', 120, 40);
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
