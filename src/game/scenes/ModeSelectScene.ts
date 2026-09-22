import Phaser from 'phaser';
import { music } from '../systems/music';
import { COLORS, HEIGHT, WIDTH } from '../config';
import { ensureSeasonSimulated, getProfile } from '../db/repository';
import { TIERS } from '../db/schema';
import { LEVELS } from '../data/levels';
import { questProgressFor } from '../db/questRepository';
import { attachPadMenu } from '../ui/padMenu';

interface ModeButtonOpts {
  y: number;
  label: string;
  sublabel: string;
  color: number;
  enabled: boolean;
  onTap?: () => void;
}

export class ModeSelectScene extends Phaser.Scene {
  private rankText!: Phaser.GameObjects.Text;
  private circuitSublabel?: Phaser.GameObjects.Text;
  private trickLabSublabel?: Phaser.GameObjects.Text;
  private questSublabel?: Phaser.GameObjects.Text;
  private modeButtons: Phaser.GameObjects.Rectangle[] = [];
  private questButton?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('ModeSelect');
  }

  create(): void {
    music.play('menu');
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.modeButtons = [];
    this.questButton = undefined;

    this.add
      .text(WIDTH / 2, 74, 'POGO SHOWDOWN', {
        fontSize: '34px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#f9d64b',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 112, 'history’s icons. high school. no chill.', {
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5);

    this.rankText = this.add
      .text(WIDTH / 2, 138, '', {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#6b6180',
      })
      .setOrigin(0.5);

    this.makeModeButton({
      y: 188,
      label: '\u{1F91A}  Pogo Dash',
      sublabel: 'endless dodge & trick run',
      color: 0xf9d64b,
      enabled: true,
      onTap: () => this.scene.start('CharacterSelect'),
    });

    this.makeModeButton({
      y: 262,
      label: '\u{1F3C6}  The Circuit',
      sublabel: 'loading…',
      color: 0xef4444,
      enabled: true,
      onTap: () => this.scene.start('Circuit'),
    });

    this.makeModeButton({
      y: 336,
      label: '\u{1F94F}  Pog Battles',
      sublabel: 'best-of-3 slams · win their signature pog',
      color: 0x8b5cf6,
      enabled: true,
      onTap: () => this.scene.start('PogBattle'),
    });

    this.makeModeButton({
      y: 410,
      label: '\u{1FA80} Yoyo Trick Lab',
      sublabel: 'freestyle combos · 60s · swipe the pattern',
      color: 0x14b8a6,
      enabled: true,
      onTap: () => this.scene.start('TrickLab'),
    });

    this.makeModeButton({
      y: 484,
      label: '\u{1F4CB}  Leaderboard',
      sublabel: 'top pogo dashers',
      color: 0x22c55e,
      enabled: true,
      onTap: () => this.scene.start('Leaderboard'),
    });

    this.makeModeButton({
      y: 558,
      label: '\u{1F392}  Pog Binder',
      sublabel: 'your collection · equip onto the footpeg',
      color: 0xf97316,
      enabled: true,
      onTap: () => this.scene.start('PogBinder'),
    });

    this.makeModeButton({
      y: 632,
      label: '\u{1F3C1}  Pog Quest',
      sublabel: 'race · fight · boss · 2P co-op',
      color: 0x38bdf8,
      enabled: true,
      onTap: () => this.scene.start('PlatformerLevelSelect', { tab: 'solo' }),
    });

    this.makeModeButton({
      y: 706,
      label: '\u{2694}\u{FE0F}  Forever Realm',
      sublabel: 'dig · build a home · store loot · conquer the realms',
      color: 0xe11d48,
      enabled: true,
      onTap: () => this.scene.start('Realm', { newWorld: false }),
    });

    // controller users almost always want Pog Quest (the only pad-playable mode), so start focused there
    attachPadMenu(this, this.modeButtons, { initial: Math.max(0, this.modeButtons.indexOf(this.questButton!)) });

    this.add
      .text(WIDTH / 2, HEIGHT - 40, 'swipe to dodge · up to bounce · down to duck', {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b6180',
      })
      .setOrigin(0.5);

    const muteToggle = this.add
      .text(WIDTH - 22, 22, music.muted ? '🔇' : '🔊', { fontSize: '22px' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    muteToggle.on('pointerdown', () => muteToggle.setText(music.toggleMute() ? '🔇' : '🔊'));

    void this.loadRankInfo();
  }

  private async loadRankInfo(): Promise<void> {
    await ensureSeasonSimulated();
    const profile = await getProfile();
    if (!this.scene.isActive() || !this.rankText.active) return;
    const tier = TIERS.find((t) => t.id === profile.tier) ?? TIERS[0];
    this.rankText.setText(
      profile.circuitUnlockedAt
        ? `${tier.label} · best ${profile.careerBestScore} · Circuit ${profile.circuitWins}-${profile.circuitLosses}`
        : `${tier.label} · best ${profile.careerBestScore}`,
    );

    if (this.trickLabSublabel && (profile.trickLabBest ?? 0) > 0) {
      this.trickLabSublabel.setText(`freestyle combos · best ${profile.trickLabBest}`);
    }

    if (this.questSublabel) {
      const cleared = LEVELS.filter((l) => questProgressFor(profile, l.id).clears > 0).length;
      if (cleared > 0) this.questSublabel.setText(`race · fight · boss · 2P co-op · ${cleared}/${LEVELS.length} cleared`);
    }

    const circuitSub = this.circuitSublabel;
    if (circuitSub) {
      circuitSub.setText(
        profile.circuitUnlockedAt ? 'standings · today’s scheduled match' : `locked — reach PRO standing`,
      );
    }
  }

  private makeModeButton(opts: ModeButtonOpts): void {
    const w = 340;
    const h = 66;
    const x = WIDTH / 2;
    const alpha = opts.enabled ? 1 : 0.45;

    const bg = this.add
      .rectangle(x, opts.y, w, h, opts.color, 0.18)
      .setStrokeStyle(2, opts.color, alpha)
      .setAlpha(alpha);

    this.add
      .text(x, opts.y - 12, opts.label, {
        fontSize: '21px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(alpha);

    const sub = this.add
      .text(x, opts.y + 17, opts.sublabel, {
        fontSize: '12px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5)
      .setAlpha(alpha);

    if (opts.label.includes('Circuit')) this.circuitSublabel = sub;
    if (opts.label.includes('Trick Lab')) this.trickLabSublabel = sub;
    if (opts.label.includes('Pog Quest')) this.questSublabel = sub;

    if (opts.enabled && opts.onTap) {
      this.modeButtons.push(bg);
      if (opts.label.includes('Pog Quest')) this.questButton = bg;
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(opts.color, 0.32));
      bg.on('pointerout', () => bg.setFillStyle(opts.color, 0.18));
      bg.on('pointerdown', () => {
        bg.disableInteractive();
        this.tweens.add({
          targets: bg,
          scale: 0.96,
          duration: 80,
          yoyo: true,
          onComplete: () => opts.onTap && opts.onTap(),
        });
      });
    }
  }
}
