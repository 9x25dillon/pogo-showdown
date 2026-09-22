import Phaser from 'phaser';
import { COLORS, HEIGHT, REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, WIDTH } from '../config';
import { LEVELS, type LevelDef } from '../data/levels';
import { pogDef } from '../data/pogs';
import { isLevelUnlocked, questProgressFor } from '../db/questRepository';
import { getProfile } from '../db/repository';
import { padLabel, readPads } from '../systems/gamepad';
import { attachPadMenu } from '../ui/padMenu';

const FONT = 'system-ui, sans-serif';

function levelTag(level: LevelDef): { label: string; color: number } {
  if (level.coop) return { label: 'CO-OP 2P', color: 0x6ee7ff };
  if (level.bossLevel) return { label: 'BOSS', color: 0xef4444 };
  return { label: 'RACE', color: 0x4ade80 };
}

type Tab = 'solo' | 'coop';

/** Pog Quest's hub: every level, what it rewards, and your best on it. Solo and co-op on separate tabs. */
export class PlatformerLevelSelectScene extends Phaser.Scene {
  private tab: Tab = 'solo';

  constructor() {
    super('PlatformerLevelSelect');
  }

  create(data: { tab?: Tab } = {}): void {
    this.tab = data.tab ?? 'solo';
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
      .text(WIDTH / 2, HEIGHT - 76, 'keys: move WASD/arrows · jump W/Space · item F · swap Q\nco-op P2: arrows · item / or Enter · swap .', {
        fontSize: '11px', fontFamily: FONT, color: '#6b6180', align: 'center', lineSpacing: 3,
      })
      .setOrigin(0.5);

    const padText = this.add
      .text(WIDTH / 2, HEIGHT - 104, '', { fontSize: '11px', fontFamily: FONT, fontStyle: 'bold', color: '#38bdf8', align: 'center' })
      .setOrigin(0.5);
    const onUpdate = (time: number) => {
      const pads = readPads(time);
      padText.setText(
        pads.length === 0
          ? '🎮 controller? press any button on it'
          : `🎮 ${pads.map((p) => padLabel(p.id)).join(' + ')} · A jump · X item · Y swap · LB/RB tabs`,
      );
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));

    const tabs: Tab[] = ['solo', 'coop'];
    tabs.forEach((tab, i) => {
      const x = WIDTH / 2 + (i === 0 ? -80 : 80);
      const active = tab === this.tab;
      const bg = this.add.rectangle(x, 108, 150, 28, active ? 0x38bdf8 : 0x1c1430).setStrokeStyle(1, 0x38bdf8, 0.8)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, 108, tab === 'solo' ? 'SOLO' : 'CO-OP 2P', {
        fontSize: '12px', fontFamily: FONT, fontStyle: 'bold', color: active ? '#07202c' : '#b7aed0',
      }).setOrigin(0.5);
      bg.on('pointerdown', () => { if (!active) this.scene.restart({ tab }); });
    });

    void this.render();
  }

  private switchTab(): void {
    this.scene.restart({ tab: this.tab === 'solo' ? 'coop' : 'solo' });
  }

  private async render(): Promise<void> {
    const profile = await getProfile();
    if (!this.scene.isActive()) return;

    const rows: Phaser.GameObjects.Rectangle[] = [];
    let focus = -1;
    const rowH = 50;
    const shown = LEVELS.map((level, i) => ({ level, i })).filter(({ level }) => !!level.coop === (this.tab === 'coop'));
    shown.forEach(({ level, i }, row) => {
      const y = 150 + row * rowH;
      const unlocked = isLevelUnlocked(profile, i);
      const progress = questProgressFor(profile, level.id);
      const tag = levelTag(level);
      const cleared = progress.clears > 0;

      const bg = this.add
        .rectangle(WIDTH / 2, y, 420, rowH - 6, tag.color, unlocked ? 0.14 : 0.05)
        .setStrokeStyle(2, tag.color, unlocked ? 0.8 : 0.25);

      this.add
        .text(44, y - 9, `${row + 1}. ${level.name}`, { fontSize: '14px', fontFamily: FONT, fontStyle: 'bold', color: unlocked ? '#ffffff' : '#6b6180' })
        .setOrigin(0, 0.5);
      this.add
        .text(WIDTH - 44, y - 9, tag.label, {
          fontSize: '10px', fontFamily: FONT, fontStyle: 'bold', color: '#0b0714',
          backgroundColor: `#${tag.color.toString(16).padStart(6, '0')}`, padding: { x: 5, y: 2 },
        })
        .setOrigin(1, 0.5)
        .setAlpha(unlocked ? 1 : 0.4);

      const reward = level.rewardPogId ? pogDef(level.rewardPogId) : undefined;
      let status: string;
      if (!unlocked) status = '🔒 clear the previous level to unlock';
      else if (cleared) status = `✓ cleared ×${progress.clears}${progress.bestTimeSeconds !== null ? ` · best ${progress.bestTimeSeconds.toFixed(1)}s` : ''} · 🪙 ${progress.bestCoins}`;
      else status = reward ? `reward: ${reward.emoji} ${reward.name}` : 'not cleared yet';
      if (level.coop && unlocked && !cleared) status += ' · 2 players';
      this.add
        .text(44, y + 9, status, { fontSize: '11px', fontFamily: FONT, color: cleared ? '#4ade80' : '#b7aed0' })
        .setOrigin(0, 0.5);

      if (unlocked) {
        // controller focus starts on the first solo level you haven't cleared yet
        if (focus < 0 && !cleared) focus = rows.length;
        rows.push(bg);
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
    attachPadMenu(this, rows, { initial: Math.max(0, focus), onBack: () => this.scene.start('ModeSelect'), onShoulder: () => this.switchTab() });
  }
}
