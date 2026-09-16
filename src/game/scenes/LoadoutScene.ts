import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from '../config';
import {
  MASTERY_TIERS,
  POG_TIERS,
  TIER_CUMULATIVE_COST,
  TRADE_IN_REFUND_RATE,
  YOYO_TIERS,
  type TierFlavor,
} from '../data/loadoutData';
import { getProfile } from '../db/repository';
import {
  SETUP_LABELS,
  axisPoints,
  characterLevel,
  computeAdvantage,
  getLoadout,
  hasUsedCurrentTier,
  nextTierCost,
  tradeInAxis,
  unlockNextTier,
  techPointsAvailable,
} from '../db/loadoutRepository';
import type { AxisId, AxisState, PlayerLoadout } from '../db/loadoutSchema';
import { CHARACTER_LEVEL_MAX } from '../data/loadoutData';

const AXIS_META: Record<AxisId, { title: string; tiers: TierFlavor[]; hint: string }> = {
  pog: { title: 'POG STACK', tiers: POG_TIERS, hint: 'stacked on the footpeg — finite, tradable' },
  yoyo: { title: 'YOYO RIG', tiers: YOYO_TIERS, hint: 'hung off the handle — finite, tradable' },
  mastery: { title: 'CHARACTER MASTERY', tiers: MASTERY_TIERS, hint: 'your own technique — not tradable' },
};

export class LoadoutScene extends Phaser.Scene {
  constructor() {
    super('Loadout');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(WIDTH / 2, 40, 'THE LOCKER', {
        fontSize: '26px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#f9d64b',
      })
      .setOrigin(0.5);

    const loading = this.add
      .text(WIDTH / 2, HEIGHT / 2, 'loading gear…', {
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b6180',
      })
      .setOrigin(0.5);

    const back = this.add
      .text(WIDTH / 2, HEIGHT - 22, '← back to circuit', {
        fontSize: '15px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Circuit'));

    void this.loadAndRender().then(() => loading.destroy());
  }

  private async loadAndRender(): Promise<void> {
    const [loadout, profile] = await Promise.all([getLoadout(), getProfile()]);
    const totalRuns = profile.totalRuns;
    const available = techPointsAvailable(loadout);
    const advantage = computeAdvantage(loadout, totalRuns);
    const setup = SETUP_LABELS[advantage.path];

    this.add
      .text(WIDTH / 2, 70, `⚙️ ${available} Tech Points available · ${loadout.techPointsEarned} earned lifetime`, {
        fontSize: '12px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 94, `${setup.emoji} ${setup.label} — +${Math.round(advantage.percent)}% battle advantage`, {
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#f9d64b',
      })
      .setOrigin(0.5);

    const panelH = 148;
    const gap = 8;
    let y = 130;

    (['pog', 'yoyo', 'mastery'] as AxisId[]).forEach((axisId) => {
      this.renderAxisPanel(axisId, loadout, totalRuns, y, panelH);
      y += panelH + gap;
    });

    this.renderNaturalPanel(loadout, totalRuns, y);
  }

  private renderAxisPanel(axisId: AxisId, loadout: PlayerLoadout, totalRuns: number, top: number, h: number): void {
    const meta = AXIS_META[axisId];
    const axis: AxisState = loadout[axisId];
    const flavor = meta.tiers[axis.tier];
    const points = axisPoints(axis);
    const cost = nextTierCost(axis);
    const usable = hasUsedCurrentTier(axis, totalRuns);
    const available = techPointsAvailable(loadout);
    const cy = top + h / 2;

    this.add.rectangle(WIDTH / 2, cy, WIDTH - 40, h, flavor.color, 0.1).setStrokeStyle(1, flavor.color, 0.5);

    this.add
      .text(30, top + 14, meta.title, {
        fontSize: '11px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#6b6180',
      })
      .setOrigin(0, 0.5);

    this.add.text(30, top + 38, flavor.emoji, { fontSize: '22px' }).setOrigin(0, 0.5);
    this.add
      .text(58, top + 38, flavor.name, {
        fontSize: '15px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(WIDTH - 30, top + 38, `${points}/24 pts`, {
        fontSize: '12px',
        fontFamily: 'system-ui, sans-serif',
        color: '#b7aed0',
      })
      .setOrigin(1, 0.5);

    // tier dots
    for (let i = 1; i <= 4; i++) {
      const dotX = 58 + (i - 1) * 22;
      this.add
        .circle(dotX, top + 60, 6, i <= axis.tier ? flavor.color : 0x2e2a3d)
        .setStrokeStyle(1, flavor.color, 0.6);
    }

    this.add
      .text(30, top + 78, meta.hint, {
        fontSize: '10px',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b6180',
      })
      .setOrigin(0, 0.5);

    // action buttons
    const btnY = top + h - 26;
    if (cost === null) {
      this.add
        .text(WIDTH / 2 - 90, btnY, 'MAXED OUT', {
          fontSize: '12px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: '#4ade80',
        })
        .setOrigin(0.5);
    } else {
      const canAfford = available >= cost;
      const enabled = usable && canAfford;
      const label = !usable ? 'play 1 run first' : `EQUIP NEXT (${cost} TP)`;
      const btn = this.add
        .rectangle(WIDTH / 2 - 90, btnY, 170, 32, enabled ? COLORS.accent : 0x2e2a3d, 1)
        .setStrokeStyle(1, enabled ? COLORS.accent : 0x463d5c);
      this.add
        .text(WIDTH / 2 - 90, btnY, label, {
          fontSize: '11px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: enabled ? '#221a10' : '#6b6180',
        })
        .setOrigin(0.5);
      if (enabled) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
          void unlockNextTier(axisId, totalRuns).then(() => this.scene.restart());
        });
      }
    }

    if (axis.tier > 0) {
      const refund = Math.floor(TIER_CUMULATIVE_COST[axis.tier] * TRADE_IN_REFUND_RATE);
      const tradeBtn = this.add
        .rectangle(WIDTH / 2 + 90, btnY, 130, 32, 0x1c1430, 1)
        .setStrokeStyle(1, 0x8b5cf6, 0.7)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(WIDTH / 2 + 90, btnY, `TRADE IN (+${refund})`, {
          fontSize: '11px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: '#c4b5fd',
        })
        .setOrigin(0.5);
      tradeBtn.on('pointerdown', () => {
        void tradeInAxis(axisId).then(() => this.scene.restart());
      });
    }
  }

  private renderNaturalPanel(loadout: PlayerLoadout, totalRuns: number, top: number): void {
    const level = characterLevel(totalRuns);
    const untouched = loadout.techPointsSpent === 0;
    const unlocked = level >= CHARACTER_LEVEL_MAX;

    this.add
      .text(WIDTH / 2, top + 14, `Character Level ${level}/${CHARACTER_LEVEL_MAX}`, {
        fontSize: '13px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#b7aed0',
      })
      .setOrigin(0.5);

    const barW = 300;
    const pct = Phaser.Math.Clamp(level / CHARACTER_LEVEL_MAX, 0, 1);
    this.add.rectangle(WIDTH / 2, top + 34, barW, 10, 0x1c1430).setStrokeStyle(1, 0x362a52);
    if (pct > 0) this.add.rectangle(WIDTH / 2 - barW / 2, top + 34, barW * pct, 10, 0x38bdf8).setOrigin(0, 0.5);

    const status = unlocked
      ? untouched
        ? '⭐ THE NATURAL is active — pure skill, +15% ceiling'
        : '⭐ The Natural is unlocked, but you’ve spent Tech Points — you’re on a named path instead'
      : `⭐ secret — reach level ${CHARACTER_LEVEL_MAX} without spending any Tech Points`;

    this.add
      .text(WIDTH / 2, top + 56, status, {
        fontSize: '11px',
        fontFamily: 'system-ui, sans-serif',
        color: unlocked && untouched ? '#f9d64b' : '#6b6180',
        align: 'center',
        wordWrap: { width: WIDTH - 60 },
      })
      .setOrigin(0.5);
  }
}
