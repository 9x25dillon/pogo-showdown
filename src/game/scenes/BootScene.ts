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
    this.makeSlammerBossTexture();
    this.makeShockwaveTexture();
    this.makeSpringPadTexture();
    this.makeChaserEnemyTexture();
    this.makeGhostEnemyTexture();
    this.makeDropperEnemyTexture();
    this.makeBombTexture();
    this.makeConductorBossTexture();
    this.makeBoltTexture();
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

  private makeSlammerBossTexture(): void {
    const g = this.add.graphics();
    // heavy stone golem with a gold crown - reads as "bigger than the charger"
    g.fillStyle(0x1e1030, 1);
    g.fillRoundedRect(2, 16, 76, 60, 14);
    g.fillStyle(0x6d28d9, 1);
    g.fillRoundedRect(6, 20, 68, 50, 12);
    g.fillStyle(0x8b5cf6, 1);
    g.fillRoundedRect(12, 24, 56, 14, 6);
    g.fillStyle(0xf59e0b, 1);
    g.fillTriangle(22, 18, 28, 2, 34, 18);
    g.fillTriangle(34, 18, 40, 0, 46, 18);
    g.fillTriangle(46, 18, 52, 2, 58, 18);
    g.fillRect(22, 14, 36, 6);
    g.fillStyle(0xfef3c7, 1);
    g.fillCircle(27, 48, 6);
    g.fillCircle(53, 48, 6);
    g.fillStyle(0x1e1030, 1);
    g.fillCircle(27, 48, 2.8);
    g.fillCircle(53, 48, 2.8);
    g.fillRect(30, 60, 20, 4);
    g.fillStyle(0x3b0764, 1);
    g.fillRect(8, 70, 18, 10);
    g.fillRect(54, 70, 18, 10);
    g.generateTexture('slammerBoss', 80, 80);
    g.destroy();
  }

  private makeShockwaveTexture(): void {
    const g = this.add.graphics();
    // a cresting wave of rubble, leading edge pointing right (the scene flips
    // leftward waves); tall and bright enough to read as "jump this"
    g.fillStyle(0xf59e0b, 0.45);
    g.fillEllipse(24, 26, 48, 20);
    g.fillStyle(0xfbbf24, 1);
    g.fillTriangle(4, 34, 40, 34, 52, 2);
    g.fillStyle(0xfef3c7, 1);
    g.fillTriangle(22, 34, 42, 34, 50, 12);
    g.fillStyle(0x92400e, 1);
    g.fillRect(8, 30, 6, 4);
    g.fillRect(28, 28, 5, 6);
    g.generateTexture('shockwave', 56, 34);
    g.destroy();
  }

  private makeSpringPadTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x475569, 1);
    g.fillRoundedRect(4, 14, 36, 6, 2);
    g.lineStyle(3, 0xcbd5e1, 1);
    for (let i = 0; i < 3; i++) g.lineBetween(10, 13 - i * 3.5, 34, 11 - i * 3.5);
    g.fillStyle(0xef4444, 1);
    g.fillRoundedRect(2, 0, 40, 6, 3);
    g.generateTexture('springPad', 44, 20);
    g.destroy();
  }

  private makeChaserEnemyTexture(): void {
    const g = this.add.graphics();
    // low, forward-leaning bruiser with horns - faces right, flipped by the scene
    g.fillStyle(0xb91c1c, 1);
    g.fillRoundedRect(2, 12, 40, 24, 10);
    g.fillStyle(0xfef2f2, 1);
    g.fillTriangle(30, 14, 36, 2, 40, 16);
    g.fillTriangle(18, 13, 20, 1, 27, 13);
    g.fillStyle(0xfacc15, 1);
    g.fillCircle(32, 22, 4);
    g.fillStyle(0x1e1030, 1);
    g.fillCircle(33, 22, 2);
    g.fillRect(26, 29, 12, 3);
    g.fillStyle(0x7f1d1d, 1);
    g.fillRect(6, 34, 8, 6);
    g.fillRect(28, 34, 8, 6);
    g.generateTexture('chaserEnemy', 44, 40);
    g.destroy();
  }

  private makeGhostEnemyTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xf1f5f9, 1);
    g.fillCircle(20, 18, 17);
    g.fillRect(3, 18, 34, 16);
    for (const x of [3, 14, 25]) g.fillTriangle(x, 34, x + 12, 34, x + 6, 43);
    g.fillStyle(0x1e1030, 1);
    g.fillEllipse(14, 17, 6, 9);
    g.fillEllipse(27, 17, 6, 9);
    g.fillEllipse(20, 27, 7, 5);
    g.generateTexture('ghostEnemy', 40, 44);
    g.destroy();
  }

  private makeDropperEnemyTexture(): void {
    const g = this.add.graphics();
    // little blimp with an open bomb hatch underneath
    g.fillStyle(0x475569, 1);
    g.fillEllipse(24, 14, 46, 24);
    g.fillStyle(0x94a3b8, 1);
    g.fillEllipse(20, 9, 26, 7);
    g.fillStyle(0x1e293b, 1);
    g.fillRect(16, 24, 16, 8);
    g.fillStyle(0xf97316, 1);
    g.fillTriangle(0, 8, 0, 20, 8, 14);
    g.fillStyle(0xfacc15, 1);
    g.fillCircle(34, 14, 3.5);
    g.generateTexture('dropperEnemy', 48, 34);
    g.destroy();
  }

  private makeBombTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x111827, 1);
    g.fillCircle(9, 12, 8);
    g.fillStyle(0x6b7280, 1);
    g.fillCircle(6, 9, 2.5);
    g.fillStyle(0xf97316, 1);
    g.fillRect(8, 0, 3, 5);
    g.generateTexture('bomb', 18, 20);
    g.destroy();
  }

  private makeConductorBossTexture(): void {
    const g = this.add.graphics();
    // thundercloud with a lightning baton - clearly airborne, clearly the boss
    g.fillStyle(0x334155, 1);
    g.fillCircle(24, 32, 20);
    g.fillCircle(44, 24, 24);
    g.fillCircle(64, 34, 18);
    g.fillRoundedRect(8, 32, 72, 26, 12);
    g.fillStyle(0x64748b, 1);
    g.fillCircle(40, 20, 12);
    g.fillStyle(0xfef08a, 1);
    g.fillCircle(32, 40, 6);
    g.fillCircle(56, 40, 6);
    g.fillStyle(0x0f172a, 1);
    g.fillCircle(33, 40, 2.8);
    g.fillCircle(57, 40, 2.8);
    g.fillStyle(0x22d3ee, 1);
    g.fillTriangle(40, 56, 50, 56, 36, 72);
    g.fillTriangle(44, 60, 54, 60, 48, 72);
    g.generateTexture('conductorBoss', 86, 72);
    g.destroy();
  }

  private makeBoltTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x22d3ee, 0.4);
    g.fillCircle(9, 9, 9);
    g.fillStyle(0xcffafe, 1);
    g.fillCircle(9, 9, 4.5);
    g.generateTexture('bolt', 18, 18);
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
