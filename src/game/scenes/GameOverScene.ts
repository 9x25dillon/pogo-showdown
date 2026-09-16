import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { COLORS, HEIGHT, REGISTRY_KEY_LAST_RESULT, WIDTH } from '../config';
import { leaderboardService } from '../systems/LeaderboardService';

interface RunResult {
  score: number;
  bestCombo: number;
  characterId: string;
}

const NAME_KEY = 'pogo-showdown:playerName';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    const result = (this.registry.get(REGISTRY_KEY_LAST_RESULT) as RunResult | undefined) ?? {
      score: 0,
      bestCombo: 0,
      characterId: CHARACTERS[0].id,
    };
    const character = CHARACTERS.find((c) => c.id === result.characterId) ?? CHARACTERS[0];

    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(WIDTH / 2, 90, 'WIPED OUT', {
        fontSize: '32px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ef4444',
      })
      .setOrigin(0.5);

    this.add.text(WIDTH / 2, 150, character.emoji, { fontSize: '48px' }).setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 220, `${Math.floor(result.score)}`, {
        fontSize: '52px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 268, 'SCORE', {
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 310, `best combo x${result.bestCombo}`, {
        fontSize: '16px',
        fontFamily: 'system-ui, sans-serif',
        color: '#f9d64b',
      })
      .setOrigin(0.5);

    const status = this.add
      .text(WIDTH / 2, 350, 'saving score…', {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b6180',
      })
      .setOrigin(0.5);

    const savedName = (() => {
      try {
        return localStorage.getItem(NAME_KEY) ?? character.name;
      } catch {
        return character.name;
      }
    })();

    leaderboardService
      .submitScore({
        name: savedName,
        characterId: character.id,
        score: Math.floor(result.score),
        date: new Date().toISOString(),
      })
      .then(({ rank }) => {
        status.setText(`local rank #${rank + 1}`);
      })
      .catch(() => status.setText(''));

    try {
      localStorage.setItem(NAME_KEY, savedName);
    } catch {
      // ignore
    }

    this.makeButton(WIDTH / 2, HEIGHT - 190, 'RUN IT BACK', COLORS.accent, '#221a10', () => this.scene.start('Run'));
    this.makeButton(WIDTH / 2, HEIGHT - 118, 'CHANGE CHARACTER', 0x8b5cf6, '#ffffff', () =>
      this.scene.start('CharacterSelect'),
    );
    this.makeButton(WIDTH / 2, HEIGHT - 50, 'LEADERBOARD', 0x22c55e, '#08210f', () =>
      this.scene.start('Leaderboard'),
    );
  }

  private makeButton(x: number, y: number, label: string, color: number, textColor: string, onTap: () => void): void {
    const btn = this.add.rectangle(x, y, 300, 54, color, 1).setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontSize: '17px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: textColor,
      })
      .setOrigin(0.5);
    btn.on('pointerdown', () => {
      this.tweens.add({ targets: btn, scale: 0.96, duration: 70, yoyo: true, onComplete: onTap });
    });
  }
}
