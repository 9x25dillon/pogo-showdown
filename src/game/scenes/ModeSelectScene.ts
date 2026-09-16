import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from '../config';

interface ModeButtonOpts {
  y: number;
  label: string;
  sublabel: string;
  color: number;
  enabled: boolean;
  onTap?: () => void;
}

export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super('ModeSelect');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(WIDTH / 2, 90, 'POGO SHOWDOWN', {
        fontSize: '38px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#f9d64b',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 130, 'history’s icons. high school. no chill.', {
        fontSize: '15px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5);

    this.makeModeButton({
      y: 260,
      label: '\u{1F91A}  Pogo Dash',
      sublabel: 'endless dodge & trick run',
      color: 0xf9d64b,
      enabled: true,
      onTap: () => this.scene.start('CharacterSelect'),
    });

    this.makeModeButton({
      y: 380,
      label: '\u{1FA80}  Pog Battles',
      sublabel: 'turn-based · win their stack — coming soon',
      color: 0x8b5cf6,
      enabled: false,
    });

    this.makeModeButton({
      y: 480,
      label: '\u{1FA80} Yoyo Trick Lab',
      sublabel: 'freestyle combos — coming soon',
      color: 0x14b8a6,
      enabled: false,
    });

    this.makeModeButton({
      y: 600,
      label: '\u{1F3C6}  Leaderboard',
      sublabel: 'top pogo dashers',
      color: 0x22c55e,
      enabled: true,
      onTap: () => this.scene.start('Leaderboard'),
    });

    this.add
      .text(WIDTH / 2, HEIGHT - 40, 'swipe to dodge · up to bounce · down to duck', {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b6180',
      })
      .setOrigin(0.5);
  }

  private makeModeButton(opts: ModeButtonOpts): void {
    const w = 340;
    const h = 84;
    const x = WIDTH / 2;
    const alpha = opts.enabled ? 1 : 0.45;

    const bg = this.add
      .rectangle(x, opts.y, w, h, opts.color, 0.18)
      .setStrokeStyle(2, opts.color, alpha)
      .setAlpha(alpha);

    this.add
      .text(x, opts.y - 12, opts.label, {
        fontSize: '22px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(alpha);

    this.add
      .text(x, opts.y + 18, opts.sublabel, {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5)
      .setAlpha(alpha);

    if (opts.enabled && opts.onTap) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(opts.color, 0.32));
      bg.on('pointerout', () => bg.setFillStyle(opts.color, 0.18));
      bg.on('pointerdown', () => {
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
