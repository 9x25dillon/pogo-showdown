import Phaser from 'phaser';
import { COLORS } from '../config';
import { TILE_INFO, T } from '../realm/tiles';
import { TILE } from '../realm/worldGen';

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
    this.makePowerupTextures();
    this.makeSpikeTileTexture();
    this.makeRealmTextures();
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

  /** every pickup sits on the same glowing disc so they read as "grab me", distinct from coins */
  private makePowerupTextures(): void {
    const disc = (g: Phaser.GameObjects.Graphics, color: number) => {
      g.fillStyle(color, 0.28);
      g.fillCircle(18, 18, 18);
      g.lineStyle(2, color, 0.9);
      g.strokeCircle(18, 18, 16);
    };
    const star = (g: Phaser.GameObjects.Graphics, cx: number, cy: number, outer: number, inner: number) => {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (Math.PI / 5) * i;
        pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
      }
      g.fillPoints(pts, true);
    };
    const make = (key: string, color: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      const g = this.add.graphics();
      disc(g, color);
      draw(g);
      g.generateTexture(key, 36, 36);
      g.destroy();
    };
    make('pu_star', 0xfacc15, (g) => {
      g.fillStyle(0xfacc15, 1);
      star(g, 18, 19, 13, 6);
      g.fillStyle(0xfff7c2, 1);
      star(g, 18, 19, 6, 3);
    });
    make('pu_feather', 0x5eead4, (g) => {
      g.fillStyle(0xccfbf1, 1);
      g.fillEllipse(18, 16, 10, 24);
      g.lineStyle(2, 0x0f766e, 1);
      g.lineBetween(12, 30, 22, 6);
    });
    make('pu_rocket', 0xf97316, (g) => {
      g.fillStyle(0xe5e7eb, 1);
      g.fillRoundedRect(13, 8, 10, 18, 5);
      g.fillStyle(0xef4444, 1);
      g.fillTriangle(13, 12, 18, 3, 23, 12);
      g.fillTriangle(9, 26, 13, 18, 13, 26);
      g.fillTriangle(27, 26, 23, 18, 23, 26);
      g.fillStyle(0xfbbf24, 1);
      g.fillTriangle(14, 26, 22, 26, 18, 33);
    });
    make('pu_heart', 0xf43f5e, (g) => {
      g.fillStyle(0xf43f5e, 1);
      g.fillCircle(13, 15, 6);
      g.fillCircle(23, 15, 6);
      g.fillTriangle(7, 17, 29, 17, 18, 29);
    });
    make('pu_shield', 0x38bdf8, (g) => {
      g.fillStyle(0x38bdf8, 1);
      g.fillRoundedRect(10, 7, 16, 20, { tl: 7, tr: 7, bl: 2, br: 2 });
      g.fillTriangle(10, 25, 26, 25, 18, 31);
      g.fillStyle(0xe0f2fe, 1);
      g.fillRect(17, 10, 2, 16);
    });
  }

  /** Forever Realm: tileset (frame n = tile id n), creatures, sword, and the light brush */
  private makeRealmTextures(): void {
    const ids = Object.keys(TILE_INFO).map(Number);
    const count = Math.max(...ids) + 1;
    const tiles = this.textures.createCanvas('realmTiles', count * TILE, TILE);
    const ctx = tiles?.getContext();
    if (tiles && ctx) {
      const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const id of ids) {
        const [base, hi] = TILE_INFO[id].color;
        const ox = id * TILE;
        const speckle = (color: string, n: number, size = 2) => {
          ctx.fillStyle = color;
          for (let i = 0; i < n; i++) ctx.fillRect(ox + Math.floor(rand() * (TILE - size)), Math.floor(rand() * (TILE - size)), size, size);
        };
        switch (id) {
          case T.TRUNK:
            ctx.fillStyle = hex(base); ctx.fillRect(ox + 4, 0, 8, TILE);
            ctx.fillStyle = hex(hi); ctx.fillRect(ox + 6, 0, 2, TILE);
            break;
          case T.LEAVES:
            // full-bleed so neighboring leaf tiles read as one canopy
            ctx.fillStyle = hex(base); ctx.fillRect(ox, 0, TILE, TILE);
            speckle(hex(hi), 12, 3);
            speckle('#0b3b20', 5, 2);
            break;
          case T.TORCH:
            ctx.fillStyle = '#7c5230'; ctx.fillRect(ox + 7, 6, 2, 10);
            ctx.fillStyle = hex(hi); ctx.fillRect(ox + 6, 2, 4, 5);
            ctx.fillStyle = '#fff7c2'; ctx.fillRect(ox + 7, 3, 2, 3);
            break;
          case T.HERB:
            ctx.fillStyle = '#166534'; ctx.fillRect(ox + 7, 8, 2, 8);
            ctx.fillStyle = hex(hi); ctx.fillRect(ox + 5, 4, 6, 5);
            ctx.fillStyle = '#f5f3ff'; ctx.fillRect(ox + 7, 5, 2, 2);
            break;
          case T.GRASS:
            ctx.fillStyle = hex(base); ctx.fillRect(ox, 0, TILE, TILE);
            speckle('#6f4e35', 6);
            ctx.fillStyle = hex(hi); ctx.fillRect(ox, 0, TILE, 4);
            ctx.fillStyle = '#22c55e'; ctx.fillRect(ox, 4, TILE, 1);
            break;
          case T.LAVA:
            ctx.fillStyle = hex(base); ctx.fillRect(ox, 0, TILE, TILE);
            ctx.fillStyle = hex(hi); ctx.fillRect(ox, 0, TILE, 3);
            speckle('#fde68a', 4, 2);
            break;
          case T.WATER:
            ctx.fillStyle = 'rgba(37, 99, 235, 0.42)'; ctx.fillRect(ox, 0, TILE, TILE);
            ctx.fillStyle = 'rgba(147, 197, 253, 0.35)'; ctx.fillRect(ox + 2, 4, 5, 1); ctx.fillRect(ox + 9, 10, 5, 1);
            break;
          case T.PORTAL: {
            const grad = ctx.createLinearGradient(ox, 0, ox + TILE, TILE);
            grad.addColorStop(0, 'rgba(88, 28, 135, 0.85)');
            grad.addColorStop(0.5, 'rgba(232, 121, 249, 0.85)');
            grad.addColorStop(1, 'rgba(88, 28, 135, 0.85)');
            ctx.fillStyle = grad; ctx.fillRect(ox, 0, TILE, TILE);
            speckle('rgba(255,255,255,0.8)', 3, 1);
            break;
          }
          case T.CLOUD:
            ctx.fillStyle = hex(base); ctx.fillRect(ox, 2, TILE, TILE - 2);
            ctx.fillStyle = hex(hi); ctx.beginPath(); ctx.arc(ox + 4, 5, 4, 0, Math.PI * 2); ctx.arc(ox + 11, 4, 5, 0, Math.PI * 2); ctx.fill();
            break;
          case T.SHRINE:
            ctx.fillStyle = hex(base); ctx.fillRect(ox, 0, TILE, TILE);
            ctx.strokeStyle = hex(hi); ctx.strokeRect(ox + 1.5, 1.5, TILE - 3, TILE - 3);
            ctx.fillStyle = '#7c6fb0'; ctx.fillRect(ox + 7, 4, 2, 8); ctx.fillRect(ox + 5, 7, 6, 2);
            break;
          case T.WOOD:
            ctx.fillStyle = hex(base); ctx.fillRect(ox, 0, TILE, TILE);
            ctx.fillStyle = hex(hi); ctx.fillRect(ox, 0, TILE, 1); ctx.fillRect(ox, 8, TILE, 1);
            ctx.fillStyle = '#4a2f18'; ctx.fillRect(ox + 5, 1, 1, 7); ctx.fillRect(ox + 11, 9, 1, 7);
            break;
          default:
            ctx.fillStyle = hex(base); ctx.fillRect(ox, 0, TILE, TILE);
            speckle(hex(hi), id === T.STONE || id === T.DIRT || id === T.BEDROCK ? 7 : 5, id === T.COPPER || id === T.IRON || id === T.SOULSTONE ? 4 : 2);
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(ox, TILE - 1, TILE, 1); ctx.fillRect(ox + TILE - 1, 0, 1, TILE);
        }
      }
      tiles.refresh();
    }

    let g = this.add.graphics();
    g.fillStyle(0x4c1d95, 0.9); g.fillEllipse(14, 13, 28, 18);
    g.fillStyle(0x7c3aed, 1); g.fillEllipse(11, 9, 12, 6);
    g.fillStyle(0xfde047, 1); g.fillCircle(9, 12, 2.4); g.fillCircle(19, 12, 2.4);
    g.generateTexture('realm_slime', 28, 22);
    g.destroy();

    g = this.add.graphics();
    g.fillStyle(0xe7e5e4, 1); g.fillCircle(13, 8, 7);
    g.fillStyle(0x1c1917, 1); g.fillCircle(10, 8, 2); g.fillCircle(16, 8, 2); g.fillRect(10, 12, 6, 2);
    g.fillStyle(0xd6d3d1, 1); g.fillRect(11, 15, 4, 10);
    for (const y of [16, 19, 22]) g.fillRect(6, y, 14, 2);
    g.fillRect(8, 25, 3, 9); g.fillRect(15, 25, 3, 9);
    g.generateTexture('realm_crawler', 26, 34);
    g.destroy();

    g = this.add.graphics();
    g.fillStyle(0x5eead4, 0.55); g.fillCircle(15, 12, 11); g.fillRect(4, 12, 22, 14);
    for (const x of [4, 11, 18]) g.fillTriangle(x, 26, x + 8, 26, x + 4, 34);
    g.fillStyle(0x042f2e, 1); g.fillEllipse(11, 12, 4, 7); g.fillEllipse(19, 12, 4, 7);
    g.generateTexture('realm_wraith', 30, 34);
    g.destroy();

    g = this.add.graphics();
    g.fillStyle(0xcbd5e1, 1); g.fillTriangle(6, 0, 10, 0, 8, 28);
    g.fillRect(6, 0, 4, 24);
    g.fillStyle(0x78350f, 1); g.fillRect(1, 24, 14, 3); g.fillRect(6, 27, 4, 7);
    g.generateTexture('realm_sword', 16, 34);
    g.destroy();

    // ---- Phase 2: realm creatures, bosses, boss fire ----
    const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      const gg = this.add.graphics();
      draw(gg);
      gg.generateTexture(key, w, h);
      gg.destroy();
    };
    make('realm_imp', 28, 30, (gg) => {
      gg.fillStyle(0xea580c, 1).fillCircle(14, 16, 10);
      gg.fillStyle(0xfbbf24, 1).fillTriangle(6, 10, 9, 0, 12, 9).fillTriangle(16, 9, 19, 0, 22, 10);
      gg.fillStyle(0x7c2d12, 1).fillTriangle(0, 16, 6, 12, 6, 20).fillTriangle(28, 16, 22, 12, 22, 20);
      gg.fillStyle(0xfef08a, 1).fillCircle(10, 15, 2.2).fillCircle(18, 15, 2.2);
    });
    make('realm_eel', 44, 18, (gg) => {
      gg.fillStyle(0x0f766e, 1).fillEllipse(22, 9, 42, 12);
      gg.fillStyle(0x14b8a6, 1).fillTriangle(0, 9, 8, 2, 8, 16);
      gg.fillStyle(0xfde047, 1).fillCircle(36, 7, 2.4);
      gg.fillStyle(0x042f2e, 1).fillRect(34, 11, 8, 2);
    });
    make('realm_harpy', 40, 32, (gg) => {
      gg.fillStyle(0xcbd5e1, 1).fillTriangle(0, 8, 16, 14, 4, 24).fillTriangle(40, 8, 24, 14, 36, 24);
      gg.fillStyle(0x64748b, 1).fillEllipse(20, 17, 14, 20);
      gg.fillStyle(0xfef3c7, 1).fillCircle(20, 9, 6);
      gg.fillStyle(0x7f1d1d, 1).fillCircle(18, 9, 1.4).fillCircle(22, 9, 1.4);
      gg.fillStyle(0xf59e0b, 1).fillTriangle(15, 28, 18, 32, 20, 27).fillTriangle(20, 27, 22, 32, 25, 28);
    });
    make('realm_knight', 30, 44, (gg) => {
      gg.fillStyle(0x57534e, 1).fillRoundedRect(7, 0, 16, 14, 4);
      gg.fillStyle(0x0c0a09, 1).fillRect(10, 5, 10, 3);
      gg.fillStyle(0xa78bfa, 1).fillCircle(13, 6, 1.3).fillCircle(17, 6, 1.3);
      gg.fillStyle(0x44403c, 1).fillRect(6, 14, 18, 16);
      gg.fillStyle(0xd6d3d1, 1).fillRect(9, 30, 4, 14).fillRect(17, 30, 4, 14);
      gg.fillStyle(0x78716c, 1).fillRect(24, 8, 3, 26).fillStyle(0x3f3f46, 1).fillRect(0, 16, 7, 12);
    });
    make('boss_tyrant', 84, 78, (gg) => {
      gg.fillStyle(0x1c0a07, 1).fillRoundedRect(4, 14, 76, 60, 16);
      gg.fillStyle(0x9a3412, 1).fillRoundedRect(8, 18, 68, 50, 14);
      gg.fillStyle(0xfb923c, 1);
      for (const x of [18, 34, 50, 66]) gg.fillTriangle(x - 7, 20, x, 0, x + 7, 20);
      gg.fillStyle(0xfef08a, 1).fillCircle(28, 40, 7).fillCircle(56, 40, 7);
      gg.fillStyle(0x1c0a07, 1).fillCircle(28, 40, 3).fillCircle(56, 40, 3).fillRect(30, 56, 24, 5);
      gg.fillStyle(0x431407, 1).fillRect(12, 68, 20, 10).fillRect(52, 68, 20, 10);
    });
    make('boss_leviathan', 124, 48, (gg) => {
      gg.fillStyle(0x134e4a, 1).fillEllipse(62, 24, 118, 34);
      gg.fillStyle(0x0d9488, 1).fillTriangle(0, 24, 20, 6, 20, 42).fillTriangle(50, 8, 64, 0, 76, 8);
      gg.fillStyle(0x99f6e4, 1).fillEllipse(70, 30, 70, 10);
      gg.fillStyle(0xfde047, 1).fillCircle(104, 18, 5);
      gg.fillStyle(0x042f2e, 1).fillCircle(105, 18, 2.4);
      gg.fillStyle(0xf0fdfa, 1);
      for (let x = 100; x < 122; x += 5) gg.fillTriangle(x, 28, x + 2.5, 35, x + 5, 28);
    });
    make('boss_harpy', 88, 66, (gg) => {
      gg.fillStyle(0xe2e8f0, 1).fillTriangle(0, 10, 34, 30, 8, 50).fillTriangle(88, 10, 54, 30, 80, 50);
      gg.fillStyle(0x94a3b8, 1).fillTriangle(8, 18, 34, 32, 14, 44).fillTriangle(80, 18, 54, 32, 74, 44);
      gg.fillStyle(0x475569, 1).fillEllipse(44, 36, 26, 34);
      gg.fillStyle(0xfef3c7, 1).fillCircle(44, 18, 11);
      gg.fillStyle(0xfacc15, 1).fillTriangle(34, 10, 38, 0, 42, 8).fillTriangle(42, 8, 46, 0, 50, 8).fillTriangle(50, 8, 54, 0, 56, 10);
      gg.fillStyle(0x7f1d1d, 1).fillCircle(40, 18, 2).fillCircle(48, 18, 2);
      gg.fillStyle(0xf59e0b, 1).fillTriangle(36, 60, 40, 66, 44, 58).fillTriangle(44, 58, 48, 66, 52, 60);
    });
    make('boss_king', 64, 88, (gg) => {
      gg.fillStyle(0xfacc15, 1).fillRect(18, 0, 28, 6).fillTriangle(18, 6, 22, 0, 26, 6).fillTriangle(38, 6, 42, 0, 46, 6);
      gg.fillStyle(0x44403c, 1).fillRoundedRect(18, 6, 28, 22, 6);
      gg.fillStyle(0x0c0a09, 1).fillRect(22, 14, 20, 5);
      gg.fillStyle(0xc4b5fd, 1).fillCircle(27, 16, 2).fillCircle(37, 16, 2);
      gg.fillStyle(0x292524, 1).fillRect(12, 28, 40, 34);
      gg.fillStyle(0x6d28d9, 1).fillRect(12, 28, 40, 6);
      gg.fillStyle(0xa8a29e, 1).fillRect(18, 62, 10, 26).fillRect(36, 62, 10, 26);
      gg.fillStyle(0x71717a, 1).fillRoundedRect(46, 30, 16, 30, 4); // shield on his facing side
      gg.fillStyle(0xd4d4d8, 1).fillRect(4, 20, 4, 50);
    });
    make('fx_flame', 22, 30, (gg) => {
      gg.fillStyle(0xdc2626, 0.9).fillTriangle(0, 30, 11, 0, 22, 30);
      gg.fillStyle(0xfbbf24, 1).fillTriangle(5, 30, 11, 10, 17, 30);
    });
    make('fx_bubble', 18, 18, (gg) => {
      gg.fillStyle(0x7dd3fc, 0.45).fillCircle(9, 9, 8);
      gg.lineStyle(2, 0xe0f2fe, 0.9).strokeCircle(9, 9, 8);
      gg.fillStyle(0xffffff, 0.9).fillCircle(6, 6, 2);
    });
    make('fx_feather', 24, 10, (gg) => {
      gg.fillStyle(0xe2e8f0, 1).fillEllipse(13, 5, 22, 7);
      gg.lineStyle(1, 0x475569, 1).lineBetween(1, 5, 23, 5);
    });

    const brush = this.textures.createCanvas('lightBrush', 256, 256);
    const bctx = brush?.getContext();
    if (brush && bctx) {
      const grad = bctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      bctx.fillStyle = grad;
      bctx.fillRect(0, 0, 256, 256);
      brush.refresh();
    }
  }

  private makeSpikeTileTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x374151, 1);
    g.fillRect(0, 14, 20, 4);
    g.fillStyle(0xd1d5db, 1);
    g.fillTriangle(0, 15, 5, 0, 10, 15);
    g.fillTriangle(10, 15, 15, 0, 20, 15);
    g.fillStyle(0xef4444, 1);
    g.fillTriangle(3, 3, 5, 0, 7, 3);
    g.fillTriangle(13, 3, 15, 0, 17, 3);
    g.generateTexture('spikeTile', 20, 18);
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
