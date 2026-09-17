import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { COLORS, REGISTRY_KEY_LAST_PLATFORMER_RESULT, REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, WIDTH } from '../config';
import { LEVELS } from '../data/levels';
import type { PlatformerResult } from '../db/platformerResult';

const FONT = 'system-ui, sans-serif';

function fallbackResult(): PlatformerResult {
  return { raceOutcome: 'fell', coins: 0, elapsedSeconds: 0, bestStompCombo: 0, characterId: CHARACTERS[0].id, levelIndex: 0 };
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
    const level = LEVELS[result.levelIndex] ?? LEVELS[0];
    const hasNextLevel = result.raceOutcome === 'playerWon' && result.levelIndex < LEVELS.length - 1;

    this.add.text(WIDTH / 2, 120, character.emoji, { fontSize: '52px' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 172, level.name, { fontSize: '13px', fontFamily: FONT, color: '#6b6180' }).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 208, copy.title, { fontSize: '26px', fontFamily: FONT, fontStyle: 'bold', color: copy.color })
      .setOrigin(0.5);
    this.add.text(WIDTH / 2, 244, copy.sub, { fontSize: '14px', fontFamily: FONT, color: '#b7aed0' }).setOrigin(0.5);

    this.add.rectangle(WIDTH / 2, 360, 360, 180, 0x1c1430).setStrokeStyle(1, 0x362a52);
    const stats = [
      `🪙 Coins collected: ${result.coins}`,
      `⏱️ Time: ${result.elapsedSeconds.toFixed(1)}s`,
      `👟 Best stomp combo: ${result.bestStompCombo}`,
    ];
    this.add
      .text(WIDTH / 2, 360, stats.join('\n\n'), { fontSize: '15px', fontFamily: FONT, color: '#ffffff', align: 'center', lineSpacing: 6 })
      .setOrigin(0.5);

    let y = 540;
    if (hasNextLevel) {
      this.makeButton(y, 'NEXT LEVEL', 0x4ade80, '#0b2417', () => {
        this.registry.set(REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, result.levelIndex + 1);
        this.scene.start('PlatformerRun');
      });
      y += 68;
    }
    this.makeButton(y, 'RETRY', COLORS.accent, '#221a10', () => {
      this.registry.set(REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, result.levelIndex);
      this.scene.start('PlatformerRun');
    });
    y += 68;
    this.makeButton(y, 'MENU', 0x22c55e, '#ffffff', () => this.scene.start('ModeSelect'));
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
