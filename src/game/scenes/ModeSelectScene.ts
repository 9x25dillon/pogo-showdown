import Phaser from 'phaser';
import { COLORS, HEIGHT, REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, WIDTH } from '../config';
import { ensureSeasonSimulated, getProfile } from '../db/repository';
import { TIERS } from '../db/schema';

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

  constructor() {
    super('ModeSelect');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);

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
      y: 214,
      label: '\u{1F91A}  Pogo Dash',
      sublabel: 'endless dodge & trick run',
      color: 0xf9d64b,
      enabled: true,
      onTap: () => this.scene.start('CharacterSelect'),
    });

    this.makeModeButton({
      y: 300,
      label: '\u{1F3C6}  The Circuit',
      sublabel: 'loading…',
      color: 0xef4444,
      enabled: true,
      onTap: () => this.scene.start('Circuit'),
    });

    this.makeModeButton({
      y: 386,
      label: '\u{1F94F}  Pog Battles',
      sublabel: 'best-of-3 slams · win their signature pog',
      color: 0x8b5cf6,
      enabled: true,
      onTap: () => this.scene.start('PogBattle'),
    });

    this.makeModeButton({
      y: 472,
      label: '\u{1FA80} Yoyo Trick Lab',
      sublabel: 'freestyle combos · 60s · swipe the pattern',
      color: 0x14b8a6,
      enabled: true,
      onTap: () => this.scene.start('TrickLab'),
    });

    this.makeModeButton({
      y: 558,
      label: '\u{1F4CB}  Leaderboard',
      sublabel: 'top pogo dashers',
      color: 0x22c55e,
      enabled: true,
      onTap: () => this.scene.start('Leaderboard'),
    });

    this.makeModeButton({
      y: 644,
      label: '\u{1F392}  Pog Binder',
      sublabel: 'your collection · equip onto the footpeg',
      color: 0xf97316,
      enabled: true,
      onTap: () => this.scene.start('PogBinder'),
    });

    this.makeModeButton({
      y: 730,
      label: '\u{1F3C1}  Pog Quest',
      sublabel: 'race to the flag · fight & stomp',
      color: 0x38bdf8,
      enabled: true,
      onTap: () => {
        this.registry.set(REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, 0);
        this.scene.start('PlatformerRun');
      },
    });

    this.add
      .text(WIDTH / 2, HEIGHT - 40, 'swipe to dodge · up to bounce · down to duck', {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b6180',
      })
      .setOrigin(0.5);

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

    const circuitSub = this.circuitSublabel;
    if (circuitSub) {
      circuitSub.setText(
        profile.circuitUnlockedAt ? 'standings · today’s scheduled match' : `locked — reach PRO standing`,
      );
    }
  }

  private makeModeButton(opts: ModeButtonOpts): void {
    const w = 340;
    const h = 74;
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

    if (opts.enabled && opts.onTap) {
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
