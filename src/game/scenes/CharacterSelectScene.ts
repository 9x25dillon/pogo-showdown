import Phaser from 'phaser';
import { equippedPerks } from '../db/pogRepository';
import { CHARACTERS } from '../data/characters';
import { COLORS, HEIGHT, REGISTRY_KEY_CHARACTER, REGISTRY_KEY_PERKS, WIDTH } from '../config';

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private cardTexts: Phaser.GameObjects.Text[] = [];
  private cards: Phaser.GameObjects.Rectangle[] = [];
  private portrait!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private clubText!: Phaser.GameObjects.Text;
  private perkText!: Phaser.GameObjects.Text;

  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cardTexts = [];
    this.cards = [];

    this.add
      .text(WIDTH / 2, 56, 'PICK YOUR FRESHMAN', {
        fontSize: '26px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // big preview panel
    const panelY = 190;
    this.add.rectangle(WIDTH / 2, panelY, 400, 220, 0x1c1430, 1).setStrokeStyle(2, 0x362a52);
    this.portrait = this.add
      .text(WIDTH / 2, panelY - 50, CHARACTERS[0].emoji, { fontSize: '64px' })
      .setOrigin(0.5);
    this.nameText = this.add
      .text(WIDTH / 2, panelY + 20, CHARACTERS[0].name, {
        fontSize: '26px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.clubText = this.add
      .text(WIDTH / 2, panelY + 50, CHARACTERS[0].club, {
        fontSize: '15px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5);
    this.perkText = this.add
      .text(WIDTH / 2, panelY + 78, CHARACTERS[0].perk, {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        color: '#f9d64b',
      })
      .setOrigin(0.5);

    // grid of roster cards
    const cols = 4;
    const cardW = 96;
    const cardH = 96;
    const gapX = 12;
    const gapY = 12;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = WIDTH / 2 - gridW / 2 + cardW / 2;
    const startY = 400;

    CHARACTERS.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      const card = this.add
        .rectangle(x, y, cardW, cardH, c.color, 0.15)
        .setStrokeStyle(2, c.color, i === 0 ? 1 : 0.4)
        .setInteractive({ useHandCursor: true });
      this.cards.push(card);

      this.add.text(x, y - 14, c.emoji, { fontSize: '30px' }).setOrigin(0.5);
      const label = this.add
        .text(x, y + 26, c.name, {
          fontSize: '11px',
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      this.cardTexts.push(label);

      card.on('pointerdown', () => this.select(i));
    });

    // start button
    const startBtn = this.add
      .rectangle(WIDTH / 2, HEIGHT - 70, 260, 60, COLORS.accent, 1)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(WIDTH / 2, HEIGHT - 70, 'BOUNCE IN', {
        fontSize: '20px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#221a10',
      })
      .setOrigin(0.5);
    startBtn.on('pointerdown', () => {
      this.registry.set(REGISTRY_KEY_CHARACTER, CHARACTERS[this.selectedIndex].id);
      // equipped pog perks are read synchronously by RunScene, so resolve them here first
      void equippedPerks().then((perks) => {
        this.registry.set(REGISTRY_KEY_PERKS, perks);
        this.scene.start('Run');
      });
    });

    // back
    const back = this.add
      .text(24, 24, '← menu', {
        fontSize: '15px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('ModeSelect'));
  }

  private select(i: number): void {
    this.selectedIndex = i;
    const c = CHARACTERS[i];
    this.portrait.setText(c.emoji);
    this.nameText.setText(c.name);
    this.clubText.setText(c.club);
    this.perkText.setText(c.perk);
    this.cards.forEach((card, idx) => {
      card.setStrokeStyle(2, CHARACTERS[idx].color, idx === i ? 1 : 0.4);
    });
    this.tweens.add({ targets: this.portrait, scale: { from: 1.3, to: 1 }, duration: 200, ease: 'Back.Out' });
  }
}
