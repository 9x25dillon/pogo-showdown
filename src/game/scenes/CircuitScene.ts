import Phaser from 'phaser';
import { music } from '../systems/music';
import { CIRCUIT_ROSTER } from '../data/circuitRoster';
import { COLORS, HEIGHT, WIDTH } from '../config';
import { getProfile, getStandings, getTodayOpponent, type StandingsEntry } from '../db/repository';
import { CIRCUIT_UNLOCK_TIER, TIERS, tierIndex } from '../db/schema';
import { todayKey } from '../systems/dates';
import { CharacterCard, skillStars } from '../ui/CharacterCard';

export class CircuitScene extends Phaser.Scene {
  constructor() {
    super('Circuit');
  }

  create(): void {
    music.play('menu');
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(WIDTH / 2, 46, 'THE CIRCUIT', {
        fontSize: '28px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#f9d64b',
      })
      .setOrigin(0.5);

    const loading = this.add
      .text(WIDTH / 2, HEIGHT / 2, 'loading standings…', {
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b6180',
      })
      .setOrigin(0.5);

    this.buildBackButton();
    this.buildLockerButton();

    void this.loadAndRender().then(() => loading.destroy());
  }

  private buildBackButton(): void {
    const back = this.add
      .text(WIDTH / 2, HEIGHT - 26, '← back to menu', {
        fontSize: '15px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('ModeSelect'));
  }

  private buildLockerButton(): void {
    const locker = this.add
      .text(WIDTH - 20, 24, '\u{1F392} Locker', {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#38bdf8',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    locker.on('pointerdown', () => this.scene.start('Loadout'));
  }

  private async loadAndRender(): Promise<void> {
    const profile = await getProfile();

    if (!profile.circuitUnlockedAt) {
      this.renderLocked(profile.careerBestScore, profile.tier);
      return;
    }

    const standings = await getStandings();
    this.renderUnlocked(standings, profile.lastCircuitMatchDate === todayKey());
  }

  private renderLocked(bestScore: number, currentTierId: string): void {
    const proTier = TIERS.find((t) => t.id === CIRCUIT_UNLOCK_TIER)!;
    const currentTier = TIERS.find((t) => t.id === currentTierId) ?? TIERS[0];

    this.add
      .text(WIDTH / 2, 84, `reach PRO standing to enter — ${bestScore} / ${proTier.threshold} best score`, {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
        align: 'center',
        wordWrap: { width: WIDTH - 60 },
      })
      .setOrigin(0.5);

    // progress bar
    const barW = 360;
    const pct = Phaser.Math.Clamp(bestScore / proTier.threshold, 0, 1);
    this.add.rectangle(WIDTH / 2, 118, barW, 14, 0x1c1430).setStrokeStyle(1, 0x362a52);
    if (pct > 0) {
      this.add.rectangle(WIDTH / 2 - barW / 2, 118, barW * pct, 14, COLORS.accent).setOrigin(0, 0.5);
    }

    // tier ladder
    const ladderTop = 160;
    TIERS.forEach((t, i) => {
      const y = ladderTop + i * 30;
      const reached = tierIndex(currentTier.id) >= i;
      this.add
        .text(WIDTH / 2 - 140, y, t.label, {
          fontSize: '14px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: t.id === currentTier.id ? 'bold' : 'normal',
          color: reached ? '#f9d64b' : '#5c5470',
        })
        .setOrigin(0, 0.5);
      this.add
        .text(WIDTH / 2 + 140, y, `${t.threshold}+`, {
          fontSize: '12px',
          fontFamily: 'system-ui, sans-serif',
          color: reached ? '#b7aed0' : '#463d5c',
        })
        .setOrigin(1, 0.5);
    });

    this.add
      .text(WIDTH / 2, ladderTop + TIERS.length * 30 + 16, 'eleven legends await…', {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b6180',
      })
      .setOrigin(0.5);

    // locked roster teaser grid
    const cols = 4;
    const cardW = 96;
    const cardH = 96;
    const gapX = 12;
    const gapY = 12;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = WIDTH / 2 - gridW / 2 + cardW / 2;
    const startY = ladderTop + TIERS.length * 30 + 76;

    CIRCUIT_ROSTER.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      new CharacterCard(this, x, y, {
        width: cardW,
        height: cardH,
        color: p.color,
        emoji: p.emoji,
        title: p.name,
        locked: true,
      });
    });
  }

  private renderUnlocked(standings: StandingsEntry[], alreadyPlayed: boolean): void {
    const opponent = getTodayOpponent();
    const me = standings.find((s) => s.isPlayer);

    this.add
      .text(WIDTH / 2, 78, me ? `you: ${me.wins}W – ${me.losses}L · ${me.points} pts` : '', {
        fontSize: '15px',
        fontFamily: 'system-ui, sans-serif',
        color: '#f9d64b',
      })
      .setOrigin(0.5);

    // today's match panel
    const panelY = 150;
    this.add.rectangle(WIDTH / 2, panelY, WIDTH - 40, 130, 0x1c1430, 0.7).setStrokeStyle(1, 0x362a52);
    this.add
      .text(WIDTH / 2, panelY - 48, "TODAY'S MATCH", {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#6b6180',
      })
      .setOrigin(0.5);

    new CharacterCard(this, WIDTH / 2 - 130, panelY + 10, {
      width: 90,
      height: 90,
      color: opponent.color,
      emoji: opponent.emoji,
      title: opponent.name,
      subtitle: opponent.epithet,
      footer: skillStars(opponent.skill),
    });

    this.add
      .text(WIDTH / 2 - 40, panelY + 10, 'VS', {
        fontSize: '20px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#463d5c',
      })
      .setOrigin(0.5);

    if (alreadyPlayed) {
      this.add
        .text(WIDTH / 2 + 90, panelY + 10, 'played\ncome back\ntomorrow', {
          fontSize: '13px',
          fontFamily: 'system-ui, sans-serif',
          color: '#b7aed0',
          align: 'center',
        })
        .setOrigin(0.5);
    } else {
      const btn = this.add
        .rectangle(WIDTH / 2 + 90, panelY + 10, 130, 56, COLORS.accent, 1)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(WIDTH / 2 + 90, panelY + 10, 'PLAY\nTODAY', {
          fontSize: '14px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: '#221a10',
          align: 'center',
        })
        .setOrigin(0.5);
      btn.on('pointerdown', () => this.scene.start('CharacterSelect'));
    }

    // standings table
    const tableTop = panelY + 100;
    this.add
      .text(30, tableTop, '#', { fontSize: '11px', fontFamily: 'system-ui, sans-serif', color: '#6b6180' })
      .setOrigin(0, 0.5);
    this.add
      .text(64, tableTop, 'COMPETITOR', { fontSize: '11px', fontFamily: 'system-ui, sans-serif', color: '#6b6180' })
      .setOrigin(0, 0.5);
    this.add
      .text(WIDTH - 30, tableTop, 'W-L / PTS', { fontSize: '11px', fontFamily: 'system-ui, sans-serif', color: '#6b6180' })
      .setOrigin(1, 0.5);

    standings.forEach((s, i) => {
      const y = tableTop + 26 + i * 32;
      const rowColor = s.isPlayer ? 0xf9d64b : s.color;

      if (s.isPlayer) {
        this.add.rectangle(WIDTH / 2, y, WIDTH - 36, 28, 0xf9d64b, 0.1);
      }

      this.add
        .text(30, y, `${i + 1}`, {
          fontSize: '13px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: i === 0 ? '#f9d64b' : '#b7aed0',
        })
        .setOrigin(0, 0.5);

      this.add.text(56, y, s.emoji, { fontSize: '15px' }).setOrigin(0, 0.5);

      this.add
        .text(84, y, s.isPlayer ? `${s.name} (you)` : s.name, {
          fontSize: '13px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: s.isPlayer ? 'bold' : 'normal',
          color: s.isPlayer ? '#f9d64b' : '#ffffff',
        })
        .setOrigin(0, 0.5);

      const streakTag = s.streak >= 2 ? ` \u{1F525}${s.streak}` : '';
      this.add
        .text(WIDTH - 30, y, `${s.wins}-${s.losses} / ${s.points}${streakTag}`, {
          fontSize: '12px',
          fontFamily: 'system-ui, sans-serif',
          color: Phaser.Display.Color.IntegerToColor(rowColor).rgba,
        })
        .setOrigin(1, 0.5);
    });
  }
}
