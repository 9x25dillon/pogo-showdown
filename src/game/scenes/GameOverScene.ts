import { masterySummary, progressFor } from '../systems/characterMastery';
import Phaser from 'phaser';
import { music } from '../systems/music';
import { CHARACTERS } from '../data/characters';
import { COLORS, HEIGHT, REGISTRY_KEY_LAST_RESULT, WIDTH } from '../config';
import { getProfile } from '../db/repository';
import type { RunResult } from '../db/runResult';
import { TIERS } from '../db/schema';
import { SETUP_LABELS } from '../db/loadoutRepository';
import { leaderboardService } from '../systems/LeaderboardService';

const NAME_KEY = 'pogo-showdown:playerName';

function fallbackResult(): RunResult {
  return {
    score: 0,
    bestCombo: 0,
    characterId: CHARACTERS[0].id,
    leveledUp: false,
    newTierId: 'rookie',
    justUnlockedCircuit: false,
    techPointsGranted: 0,
    circuitMatch: null,
  };
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    music.play('loss');
    this.cameras.main.setBackgroundColor(COLORS.bg);
    void this.build();
  }

  private async build(): Promise<void> {
    const result = (this.registry.get(REGISTRY_KEY_LAST_RESULT) as RunResult | undefined) ?? fallbackResult();
    const character = CHARACTERS.find((c) => c.id === result.characterId) ?? CHARACTERS[0];
    const profile = await getProfile();

    let cursor = 64;

    this.add
      .text(WIDTH / 2, cursor, 'WIPED OUT', {
        fontSize: '28px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ef4444',
      })
      .setOrigin(0.5);
    cursor += 46;

    this.add.text(WIDTH / 2, cursor, character.emoji, { fontSize: '42px' }).setOrigin(0.5);
    cursor += 52;

    if (result.justUnlockedCircuit) {
      const banner = this.add
        .text(WIDTH / 2, cursor, '\u{1F3C6} YOU WENT PRO — THE CIRCUIT IS OPEN', {
          fontSize: '14px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: '#221a10',
          backgroundColor: '#f9d64b',
          padding: { x: 12, y: 8 },
          align: 'center',
          wordWrap: { width: WIDTH - 60 },
        })
        .setOrigin(0.5);
      this.tweens.add({ targets: banner, scale: { from: 0.8, to: 1 }, duration: 260, ease: 'Back.Out' });
      cursor += 50;
    } else if (result.leveledUp) {
      const tier = TIERS.find((t) => t.id === result.newTierId);
      this.add
        .text(WIDTH / 2, cursor, `TIER UP → ${tier?.label ?? result.newTierId}`, {
          fontSize: '15px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: '#f9d64b',
        })
        .setOrigin(0.5);
      cursor += 34;
    }

    this.add
      .text(WIDTH / 2, cursor, `${Math.floor(result.score)}`, {
        fontSize: '50px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    cursor += 40;
    this.add
      .text(WIDTH / 2, cursor, 'SCORE', { fontSize: '13px', fontFamily: 'system-ui, sans-serif', color: '#b7aed0' })
      .setOrigin(0.5);
    cursor += 32;

    this.add
      .text(WIDTH / 2, cursor, `best combo x${result.bestCombo}`, {
        fontSize: '15px',
        fontFamily: 'system-ui, sans-serif',
        color: '#f9d64b',
      })
      .setOrigin(0.5);
    cursor += 28;
    const progress = progressFor(profile, character.id);
    this.add.text(WIDTH / 2, cursor, `${character.name} · ${masterySummary(progress)}`, {
      fontSize: '11px', fontFamily: 'system-ui, sans-serif', color: '#38bdf8',
    }).setOrigin(0.5);
    cursor += 28;

    if (result.circuitMatch) {
      const m = result.circuitMatch;
      const color = m.won ? 0x22c55e : 0xef4444;
      const setup = SETUP_LABELS[m.setupPath];
      const boxH = m.advantagePercent > 0 ? 78 : 60;
      this.add.rectangle(WIDTH / 2, cursor + boxH / 2 - 8, WIDTH - 60, boxH, color, 0.15).setStrokeStyle(1, color, 0.6);
      this.add
        .text(WIDTH / 2, cursor + 8, `CIRCUIT MATCH — ${m.won ? 'WIN' : 'LOSS'}`, {
          fontSize: '13px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: m.won ? '#4ade80' : '#f87171',
        })
        .setOrigin(0.5);
      this.add
        .text(WIDTH / 2, cursor + 30, `${m.battleScore} – ${m.opponentScore} ${m.opponentEmoji} ${m.opponentName}`, {
          fontSize: '13px',
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      if (m.advantagePercent > 0) {
        this.add
          .text(
            WIDTH / 2,
            cursor + 50,
            `${setup.emoji} ${setup.label} · run score ${m.yourScore} × ${(1 + m.advantagePercent / 100).toFixed(2)} (+${m.advantagePercent}%)`,
            {
              fontSize: '11px',
              fontFamily: 'system-ui, sans-serif',
              color: '#b7aed0',
            },
          )
          .setOrigin(0.5);
      }
      cursor += boxH + 14;
    }

    if (result.techPointsGranted > 0) {
      const tpBanner = this.add
        .text(WIDTH / 2, cursor, `⚙️ +${result.techPointsGranted} Tech Point${result.techPointsGranted > 1 ? 's' : ''}`, {
          fontSize: '13px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: '#38bdf8',
        })
        .setOrigin(0.5);
      this.tweens.add({ targets: tpBanner, scale: { from: 0.7, to: 1 }, duration: 220, ease: 'Back.Out' });
      cursor += 30;
    }

    const status = this.add
      .text(WIDTH / 2, cursor, 'saving score…', {
        fontSize: '12px',
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
      .then(({ rank }) => status.setText(`local rank #${rank + 1}`))
      .catch(() => status.setText(''));

    try {
      localStorage.setItem(NAME_KEY, savedName);
    } catch {
      // ignore
    }

    const buttons: { label: string; color: number; textColor: string; onTap: () => void }[] = [
      { label: 'RUN IT BACK', color: COLORS.accent, textColor: '#221a10', onTap: () => this.scene.start('Run') },
      {
        label: 'CHANGE CHARACTER',
        color: 0x8b5cf6,
        textColor: '#ffffff',
        onTap: () => this.scene.start('CharacterSelect'),
      },
    ];
    if (profile.circuitUnlockedAt) {
      buttons.push({ label: 'THE CIRCUIT', color: 0xef4444, textColor: '#ffffff', onTap: () => this.scene.start('Circuit') });
    }
    buttons.push({
      label: 'LEADERBOARD',
      color: 0x22c55e,
      textColor: '#08210f',
      onTap: () => this.scene.start('Leaderboard'),
    });

    const bottomMargin = 50;
    const step = 68;
    buttons.forEach((b, i) => {
      const y = HEIGHT - bottomMargin - (buttons.length - 1 - i) * step;
      this.makeButton(WIDTH / 2, y, b.label, b.color, b.textColor, b.onTap);
    });
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
      btn.disableInteractive();
      this.tweens.add({ targets: btn, scale: 0.96, duration: 70, yoyo: true, onComplete: onTap });
    });
  }
}
