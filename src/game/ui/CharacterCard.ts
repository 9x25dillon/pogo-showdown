import Phaser from 'phaser';

export interface CardOptions {
  width: number;
  height: number;
  color: number;
  emoji: string;
  title: string;
  subtitle?: string;
  footer?: string;
  footerColor?: string;
  emojiSize?: number;
  titleSize?: number;
  subtitleSize?: number;
  selected?: boolean;
  locked?: boolean;
}

/**
 * Procedurally-drawn "trading card" for a character/pro/opponent - the
 * MVP's stand-in for illustrated art. Built from shapes + emoji + text
 * rather than raster assets, so it themes consistently and costs
 * nothing to add more of.
 */
export class CharacterCard extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private glow: Phaser.GameObjects.Rectangle;
  private emojiText: Phaser.GameObjects.Text;
  private titleText: Phaser.GameObjects.Text;
  private subtitleText?: Phaser.GameObjects.Text;
  private footerBg?: Phaser.GameObjects.Rectangle;
  private footerText?: Phaser.GameObjects.Text;
  private lockText?: Phaser.GameObjects.Text;
  private opts: CardOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: CardOptions) {
    super(scene, x, y);
    this.opts = opts;
    const { width: w, height: h, color, locked } = opts;

    this.glow = scene.add.rectangle(0, 0, w + 8, h + 8, color, 0.35).setVisible(!!opts.selected);
    this.bg = scene.add
      .rectangle(0, 0, w, h, color, locked ? 0.06 : 0.16)
      .setStrokeStyle(2, color, locked ? 0.25 : opts.selected ? 1 : 0.55);

    this.emojiText = scene.add
      .text(0, -h * 0.14, locked ? '❓' : opts.emoji, { fontSize: `${opts.emojiSize ?? Math.floor(h * 0.34)}px` })
      .setOrigin(0.5)
      .setAlpha(locked ? 0.35 : 1);

    this.titleText = scene.add
      .text(0, h * 0.2, locked ? '???' : opts.title, {
        fontSize: `${opts.titleSize ?? 13}px`,
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: locked ? '#5c5470' : '#ffffff',
        align: 'center',
        wordWrap: { width: w - 10 },
      })
      .setOrigin(0.5);

    this.add([this.glow, this.bg, this.emojiText, this.titleText]);

    if (opts.subtitle) {
      this.subtitleText = scene.add
        .text(0, h * 0.36, locked ? '' : opts.subtitle, {
          fontSize: `${opts.subtitleSize ?? 10}px`,
          fontFamily: 'system-ui, sans-serif',
          color: '#b7aed0',
          align: 'center',
          wordWrap: { width: w - 10 },
        })
        .setOrigin(0.5);
      this.add(this.subtitleText);
    }

    if (opts.footer && !locked) {
      this.footerBg = scene.add.rectangle(0, h / 2 - 12, w - 12, 20, color, 0.28).setStrokeStyle(1, color, 0.6);
      this.footerText = scene.add
        .text(0, h / 2 - 12, opts.footer, {
          fontSize: '11px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: opts.footerColor ?? '#ffffff',
        })
        .setOrigin(0.5);
      this.add([this.footerBg, this.footerText]);
    }

    if (locked) {
      this.lockText = scene.add.text(w / 2 - 16, -h / 2 + 14, '\u{1F512}', { fontSize: '16px' }).setOrigin(0.5);
      this.add(this.lockText);
    }

    scene.add.existing(this);
  }

  setSelected(selected: boolean): void {
    this.glow.setVisible(selected);
    this.bg.setStrokeStyle(2, this.opts.color, this.opts.locked ? 0.25 : selected ? 1 : 0.55);
  }
}

export function skillStars(skill: number): string {
  const n = Math.max(1, Math.min(5, Math.round(skill / 20)));
  return '⭐'.repeat(n);
}
