import Phaser from 'phaser';
import { music } from '../systems/music';
import { CHARACTERS } from '../data/characters';
import { COLORS, HEIGHT, WIDTH } from '../config';
import { leaderboardService } from '../systems/LeaderboardService';

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('Leaderboard');
  }

  create(): void {
    music.play('menu');
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(WIDTH / 2, 60, 'TOP DASHERS', {
        fontSize: '28px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#22c55e',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 92, 'saved on this device · online leaderboards coming soon', {
        fontSize: '12px',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b6180',
      })
      .setOrigin(0.5);

    const listTop = 130;
    this.add.rectangle(WIDTH / 2, listTop + 270, 420, 560, 0x1c1430, 0.6).setStrokeStyle(1, 0x362a52);

    leaderboardService.getTop(10).then((entries) => {
      if (entries.length === 0) {
        this.add
          .text(WIDTH / 2, listTop + 40, 'no runs yet — be the first!', {
            fontSize: '15px',
            fontFamily: 'system-ui, sans-serif',
            color: '#b7aed0',
          })
          .setOrigin(0.5);
        return;
      }

      entries.forEach((entry, i) => {
        const y = listTop + 40 + i * 46;
        const character = CHARACTERS.find((c) => c.id === entry.characterId);
        const rankColor = i === 0 ? '#f9d64b' : i === 1 ? '#c0c0c8' : i === 2 ? '#cd7f32' : '#b7aed0';

        this.add
          .text(70, y, `#${i + 1}`, {
            fontSize: '16px',
            fontFamily: 'system-ui, sans-serif',
            fontStyle: 'bold',
            color: rankColor,
          })
          .setOrigin(0, 0.5);

        this.add.text(120, y, character?.emoji ?? '❓', { fontSize: '20px' }).setOrigin(0, 0.5);

        this.add
          .text(160, y, entry.name, {
            fontSize: '15px',
            fontFamily: 'system-ui, sans-serif',
            color: '#ffffff',
          })
          .setOrigin(0, 0.5);

        this.add
          .text(WIDTH - 70, y, `${entry.score}`, {
            fontSize: '17px',
            fontFamily: 'system-ui, sans-serif',
            fontStyle: 'bold',
            color: '#ffffff',
          })
          .setOrigin(1, 0.5);
      });
    });

    const back = this.add
      .text(WIDTH / 2, HEIGHT - 40, '← back to menu', {
        fontSize: '15px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('ModeSelect'));
  }
}
