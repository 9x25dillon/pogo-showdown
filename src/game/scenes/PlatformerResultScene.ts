import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { COLORS, REGISTRY_KEY_LAST_PLATFORMER_RESULT, WIDTH } from '../config';
import type { PlatformerResult } from '../db/platformerResult';

const FONT = 'system-ui, sans-serif';

function fallbackResult(): PlatformerResult {
  return { raceOutcome: 'fell', coins: 0, elapsedSeconds: 0, bestStompCombo: 0, characterId: CHARACTERS[0].id };
}

const OUTCOME_COPY: Record<PlatformerResult['raceOutcome'], { title: string; color: string; sub: string }> = {
  playerWon: { title: 'YOU WIN THE RACE!', color: '#4ade80', sub: 'first to the flag' },
  rivalWon: { title: 'RIVAL WINS', color: '#ef4444', sub: 'they beat you to the flag' },
  fell: { title: 'OUT OF LIVES', color: '#ef4444', sub: 'the flats got the better of you' },
};

export class PlatformerResultScene extends Phaser.Scene {
  constructor() {
    super('PlatformerResult');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    const result = (this.registry.get(REGISTRY_KEY_LAST_PLATFORMER_RESULT) as PlatformerResult | undefined) ?? fallbackResult();
    const character = CHARACTERS.find((c) => c.id === result.characterId) ?? CHARACTERS[0];
    const copy = OUTCOME_COPY[result.raceOutcome];

    this.add.text(WIDTH / 2, 140, character.emoji, { fontSize: '56px' }).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 220, copy.title, { fontSize: '28px', fontFamily: FONT, fontStyle: 'bold', color: copy.color })
      .setOrigin(0.5);
    this.add.text(WIDTH / 2, 258, copy.sub, { fontSize: '14px', fontFamily: FONT, color: '#b7aed0' }).setOrigin(0.5);

    this.add.rectangle(WIDTH / 2, 380, 360, 180, 0x1c1430).setStrokeStyle(1, 0x362a52);
    const stats = [
      `🪙 Coins collected: ${result.coins}`,
      `⏱️ Time: ${result.elapsedSeconds.toFixed(1)}s`,
      `👟 Best stomp combo: ${result.bestStompCombo}`,
    ];
    this.add
      .text(WIDTH / 2, 380, stats.join('\n\n'), { fontSize: '15px', fontFamily: FONT, color: '#ffffff', align: 'center', lineSpacing: 6 })
      .setOrigin(0.5);

    this.makeButton(560, 'RETRY', COLORS.accent, '#221a10', () => this.scene.start('PlatformerRun'));
    this.makeButton(630, 'MENU', 0x22c55e, '#ffffff', () => this.scene.start('ModeSelect'));
  }

  private makeButton(y: number, label: string, color: number, textColor: string, onTap: () => void): void {
    const btn = this.add.rectangle(WIDTH / 2, y, 300, 54, color).setInteractive({ useHandCursor: true });
    this.add.text(WIDTH / 2, y, label, { fontSize: '19px', fontFamily: FONT, fontStyle: 'bold', color: textColor }).setOrigin(0.5);
    btn.on('pointerdown', () => {
      btn.disableInteractive();
      this.tweens.add({ targets: btn, scale: 0.96, duration: 80, yoyo: true, onComplete: onTap });
    });
  }
}
