import Phaser from 'phaser';
import { COLORS, HEIGHT, REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, WIDTH } from '../config';
import { LEVELS, type LevelDef } from '../data/levels';
import { pogDef } from '../data/pogs';
import { isLevelUnlocked, questProgressFor } from '../db/questRepository';
import { getProfile } from '../db/repository';

const FONT = 'system-ui, sans-serif';

function levelTag(level: LevelDef): { label: string; color: number } {
  if (level.coop) return { label: 'CO-OP 2P', color: 0x6ee7ff };
  if (level.bossLevel) return { label: 'BOSS', color: 0xef4444 };
  return { label: 'RACE', color: 0x4ade80 };
}

/** Pog Quest's hub: every level, what it rewards, and your best on it. */
export class PlatformerLevelSelectScene extends Phaser.Scene {
  constructor() {
    super('PlatformerLevelSelect');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add
      .text(WIDTH / 2, 50, 'POG QUEST', { fontSize: '28px', fontFamily: FONT, fontStyle: 'bold', color: '#38bdf8' })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 82, 'first clear of each level: +1 Tech Point & a pog', { fontSize: '12px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5);

    const back = this.add
      .text(WIDTH / 2, HEIGHT - 36, '← back to menu', { fontSize: '15px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('ModeSelect'));

    this.add
      .text(WIDTH / 2, HEIGHT - 70, 'keys: move WASD/arrows · jump W/Space · item F · swap Q\nco-op P2: arrows · item / or Enter · swap .', {
        fontSize: '11px', fontFamily: FONT, color: '#6b6180', align: 'center', lineSpacing: 3,
      })
      .setOrigin(0.5);

    void this.render();
  }

  private async render(): Promise<void> {
    const profile = await getProfile();
    if (!this.scene.isActive()) return;

    const rowH = 108;
    LEVELS.forEach((level, i) => {
      const y = 170 + i * rowH;
      const unlocked = isLevelUnlocked(profile, i);
      const progress = questProgressFor(profile, level.id);
      const tag = levelTag(level);
      const cleared = progress.clears > 0;

      const bg = this.add
        .rectangle(WIDTH / 2, y, 420, rowH - 14, tag.color, unlocked ? 0.14 : 0.05)
        .setStrokeStyle(2, tag.color, unlocked ? 0.8 : 0.25);

      this.add
        .text(46, y - 26, `${i + 1}. ${level.name}`, { fontSize: '18px', fontFamily: FONT, fontStyle: 'bold', color: unlocked ? '#ffffff' : '#6b6180' })
        .setOrigin(0, 0.5);
      this.add
        .text(WIDTH - 46, y - 26, tag.label, {
          fontSize: '11px', fontFamily: FONT, fontStyle: 'bold', color: '#0b0714',
          backgroundColor: `#${tag.color.toString(16).padStart(6, '0')}`, padding: { x: 6, y: 3 },
        })
        .setOrigin(1, 0.5)
        .setAlpha(unlocked ? 1 : 0.4);

      const reward = level.rewardPogId ? pogDef(level.rewardPogId) : undefined;
      let status: string;
      if (!unlocked) status = '🔒 clear the previous level to unlock';
      else if (cleared) status = `✓ cleared ×${progress.clears}${progress.bestTimeSeconds !== null ? ` · best ${progress.bestTimeSeconds.toFixed(1)}s` : ''} · 🪙 ${progress.bestCoins}`;
      else status = reward ? `reward: ${reward.emoji} ${reward.name}` : 'not cleared yet';
      this.add
        .text(46, y + 4, status, { fontSize: '12px', fontFamily: FONT, color: cleared ? '#4ade80' : '#b7aed0' })
        .setOrigin(0, 0.5);
      if (level.coop && unlocked) {
        this.add
          .text(46, y + 26, 'two players: split the touch controls or share a keyboard', { fontSize: '11px', fontFamily: FONT, color: '#6b6180' })
          .setOrigin(0, 0.5);
      }

      if (unlocked) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(tag.color, 0.26));
        bg.on('pointerout', () => bg.setFillStyle(tag.color, 0.14));
        bg.on('pointerdown', () => {
          bg.disableInteractive();
          this.registry.set(REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, i);
          this.tweens.add({ targets: bg, scale: 0.97, duration: 70, yoyo: true, onComplete: () => this.scene.start('PlatformerRun') });
        });
      }
    });
  }
}
