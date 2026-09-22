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
    this.makePlatformTileTexture();
    this.makeCoinTexture();
    this.makePatrolEnemyTexture();
    this.makeFlyingEnemyTexture();
    this.makeHopperEnemyTexture();
    this.makeSpikerEnemyTexture();
    this.makeTurretEnemyTexture();
    this.makePelletTexture();
    this.makeProjectileTexture();
    this.makeBossTexture();
    this.makeGoalFlagTexture();
    this.makeShieldBurstTexture();
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

  private makePlatformTileTexture(): void {
    const g = this.add.graphics();
    // grass-topped dirt block, tiled via TileSprite for any width/segment
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(0, 0, 40, 40);
    g.fillStyle(0x4ade80, 1);
    g.fillRect(0, 0, 40, 8);
    g.fillStyle(0x22c55e, 1);
    g.fillRect(0, 6, 40, 3);
    g.fillStyle(0x2a1c10, 0.5);
    g.fillRect(0, 39, 40, 1);
    g.lineStyle(1, 0x2a1c10, 0.4);
    g.lineBetween(0, 20, 40, 20);
    g.generateTexture('platformTile', 40, 40);
    g.destroy();
  }

  private makeCoinTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xf9d64b, 1);
    g.fillCircle(14, 14, 13);
    g.fillStyle(0xfff3c4, 1);
    g.fillCircle(14, 14, 8);
    g.lineStyle(2, 0xb8860b, 0.7);
    g.strokeCircle(14, 14, 13);
    g.generateTexture('coin', 28, 28);
    g.destroy();
  }

  private makePatrolEnemyTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x7c3aed, 1);
    g.fillRoundedRect(2, 8, 40, 30, 12);
    g.fillStyle(0x1e1030, 1);
    g.fillCircle(15, 20, 4);
    g.fillCircle(31, 20, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(15, 19, 1.6);
    g.fillCircle(31, 19, 1.6);
    g.fillStyle(0x4c1d95, 1);
    g.fillRect(6, 34, 8, 6);
    g.fillRect(30, 34, 8, 6);
    g.generateTexture('patrolEnemy', 44, 40);
    g.destroy();
  }

  private makeFlyingEnemyTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xf43f5e, 1);
    g.fillEllipse(20, 18, 34, 22);
    g.fillStyle(0xfecdd3, 0.85);
    g.fillTriangle(4, 16, -10, 8, 4, 22);
    g.fillTriangle(36, 16, 50, 8, 36, 22);
    g.fillStyle(0x1e1030, 1);
    g.fillCircle(14, 16, 3.4);
    g.fillCircle(26, 16, 3.4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(14, 15, 1.4);
    g.fillCircle(26, 15, 1.4);
    g.generateTexture('flyingEnemy', 40, 32);
    g.destroy();
  }

  private makeHopperEnemyTexture(): void {
    const g = this.add.graphics();
    // squat green spring-legged blob
    g.fillStyle(0x16a34a, 1);
    g.fillEllipse(22, 18, 38, 28);
    g.fillStyle(0x86efac, 0.6);
    g.fillEllipse(18, 11, 16, 7);
    g.lineStyle(3, 0x14532d, 1);
    g.lineBetween(12, 30, 8, 39);
    g.lineBetween(32, 30, 36, 39);
    g.fillStyle(0x1e1030, 1);
    g.fillCircle(15, 17, 4);
    g.fillCircle(29, 17, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(15, 16, 1.6);
    g.fillCircle(29, 16, 1.6);
    g.generateTexture('hopperEnemy', 44, 40);
    g.destroy();
  }

  private makeSpikerEnemyTexture(): void {
    const g = this.add.graphics();
    // shell with a row of spikes on top - reads as "don't land on me"
    g.fillStyle(0xe5e7eb, 1);
    for (const x of [6, 16, 26, 36]) g.fillTriangle(x - 5, 16, x, 0, x + 5, 16);
    g.fillStyle(0xea580c, 1);
    g.fillRoundedRect(1, 13, 42, 22, 10);
    g.fillStyle(0x1e1030, 1);
    g.fillCircle(15, 23, 3.4);
    g.fillCircle(29, 23, 3.4);
    g.fillStyle(0x7c2d12, 1);
    g.fillRect(7, 34, 8, 6);
    g.fillRect(29, 34, 8, 6);
    g.generateTexture('spikerEnemy', 44, 40);
    g.destroy();
  }

  private makeTurretEnemyTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x334155, 1);
    g.fillRoundedRect(4, 30, 32, 18, 4);
    g.fillStyle(0x64748b, 1);
    g.fillCircle(20, 24, 13);
    // barrel points right; the scene flips the sprite to face its target
    g.fillStyle(0x0f172a, 1);
    g.fillRect(24, 19, 16, 9);
    g.fillStyle(0xef4444, 1);
    g.fillCircle(16, 22, 3.5);
    g.generateTexture('turretEnemy', 40, 48);
    g.destroy();
  }

  private makePelletTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xef4444, 1);
    g.fillCircle(7, 7, 6);
    g.fillStyle(0xfecaca, 1);
    g.fillCircle(5, 5, 2);
    g.generateTexture('pellet', 14, 14);
    g.destroy();
  }

  private makeProjectileTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xdc2626, 1);
    const cx = 12;
    const cy = 12;
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 11 : 5;
      const a = (Math.PI / 4) * i;
      points.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    g.fillPoints(points, true);
    g.fillStyle(0xfecaca, 1);
    g.fillCircle(cx, cy, 4);
    g.generateTexture('projectile', 24, 24);
    g.destroy();
  }

  private makeBossTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x1e1030, 1);
    g.fillRoundedRect(2, 14, 66, 52, 16);
    g.fillStyle(0xdc2626, 1);
    g.fillRoundedRect(6, 18, 58, 40, 14);
    g.lineStyle(3, 0x7c1d1d, 1);
    for (const x of [16, 35, 54]) {
      g.beginPath();
      g.moveTo(x - 8, 20);
      g.lineTo(x, 6);
      g.lineTo(x + 8, 20);
      g.strokePath();
    }
    g.fillStyle(0xfacc15, 1);
    g.fillCircle(22, 38, 6);
    g.fillCircle(48, 38, 6);
    g.fillStyle(0x1e1030, 1);
    g.fillCircle(22, 38, 2.6);
    g.fillCircle(48, 38, 2.6);
    g.fillStyle(0x450a0a, 1);
    g.fillRect(10, 60, 12, 8);
    g.fillRect(48, 60, 12, 8);
    g.generateTexture('boss', 70, 70);
    g.destroy();
  }

  private makeGoalFlagTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x94a3b8, 1);
    g.fillRect(4, 0, 5, 120);
    g.fillStyle(0xf9d64b, 1);
    g.fillTriangle(9, 6, 9, 46, 50, 26);
    g.generateTexture('goalFlag', 54, 120);
    g.destroy();
  }

  private makeShieldBurstTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x38bdf8, 1);
    g.fillRoundedRect(4, 0, 32, 36, { tl: 14, tr: 14, bl: 4, br: 4 });
    g.fillStyle(0x0b0714, 1);
    g.fillTriangle(20, 8, 12, 16, 20, 16);
    g.fillTriangle(20, 8, 28, 16, 20, 16);
    g.fillRect(15, 15, 10, 12);
    g.generateTexture('shieldBurst', 40, 36);
    g.destroy();
  }
}
