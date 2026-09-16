import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from '../config';
import { RARITY_COLOR, RARITY_LABEL, describePerks, pogDef, type PogDef } from '../data/pogs';
import { computeCurrentAdvantage } from '../db/loadoutRepository';
import {
  battleOpponents,
  dropAvailableToday,
  getCollection,
  rankedUnlocked,
  resolveBattle,
  type BattleOpponent,
} from '../db/pogRepository';
import type { PogInstance } from '../db/pogSchema';
import { getProfile } from '../db/repository';

const FONT = 'system-ui, sans-serif';
const ROUNDS_TO_WIN = 2;
const BAR_W = 340;
const SWEET_HALF = 22; // px either side of centre = perfect slam

type Phase = 'select' | 'wager' | 'battle' | 'result';

/**
 * Pog Battles: pick an opponent, (stake a pog if they're a pro), then
 * best-of-3 slams. Each slam is a marker sweeping across a bar - tap to
 * stop it near the centre. Your slam power is closeness to centre;
 * theirs is skill-derived with variance. Win to take their signature
 * pog (one drop per opponent per day); lose a ranked battle and your
 * stake is gone for good.
 */
export class PogBattleScene extends Phaser.Scene {
  private phase: Phase = 'select';
  private opponent!: BattleOpponent;
  private wager: PogInstance | null = null;
  private advantagePercent = 0;

  // battle state
  private round = 0;
  private youWins = 0;
  private themWins = 0;
  private rounds: { you: number; them: number }[] = [];
  private marker!: Phaser.GameObjects.Rectangle;
  private markerT = 0;
  private markerDir = 1;
  private sweeping = false;
  private sweepSpeed = 1.6; // full bar widths per second
  private roundText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super('PogBattle');
  }

  create(): void {
    this.phase = 'select';
    this.wager = null;
    this.round = 0;
    this.youWins = 0;
    this.themWins = 0;
    this.rounds = [];
    this.sweeping = false;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    void this.showSelect();
  }

  update(_t: number, delta: number): void {
    if (this.phase !== 'battle' || !this.sweeping) return;
    this.markerT += (delta / 1000) * this.sweepSpeed * this.markerDir;
    if (this.markerT >= 1) {
      this.markerT = 1;
      this.markerDir = -1;
    } else if (this.markerT <= 0) {
      this.markerT = 0;
      this.markerDir = 1;
    }
    this.marker.x = WIDTH / 2 - BAR_W / 2 + this.markerT * BAR_W;
  }

  // ---------------- select ----------------

  private async showSelect(): Promise<void> {
    this.children.removeAll();
    this.phase = 'select';

    this.add
      .text(WIDTH / 2, 40, 'POG BATTLES', { fontSize: '26px', fontFamily: FONT, fontStyle: 'bold', color: '#8b5cf6' })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 68, 'best of 3 slams · win their signature pog · one drop per opponent per day', {
        fontSize: '11px',
        fontFamily: FONT,
        color: '#b7aed0',
      })
      .setOrigin(0.5);

    const [unlocked, profile] = await Promise.all([rankedUnlocked(), getProfile()]);
    const opponents = battleOpponents();
    const claimed = new Set<string>();
    await Promise.all(
      opponents.map(async (o) => {
        if (!(await dropAvailableToday(o.id))) claimed.add(o.id);
      }),
    );

    this.add.text(24, 92, 'PRACTICE  ·  highschoolers, no stakes', { fontSize: '12px', fontFamily: FONT, fontStyle: 'bold', color: '#b7aed0' });
    this.renderOpponentGrid(opponents.filter((o) => !o.ranked), 118, claimed, true);

    const rankedTop = 118 + 2 * 96 + 22;
    this.add.text(24, rankedTop, unlocked ? 'RANKED  ·  circuit pros, stake a pog' : `RANKED  ·  locked — reach PRO standing (you: ${profile.tier})`, {
      fontSize: '12px',
      fontFamily: FONT,
      fontStyle: 'bold',
      color: unlocked ? '#f9d64b' : '#6b6180',
    });
    this.renderOpponentGrid(opponents.filter((o) => o.ranked), rankedTop + 26, claimed, unlocked);

    const back = this.add
      .text(WIDTH / 2, HEIGHT - 30, '← back to menu', { fontSize: '15px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('ModeSelect'));
  }

  private renderOpponentGrid(list: BattleOpponent[], top: number, claimed: Set<string>, enabled: boolean): void {
    const cols = 4;
    const w = 104;
    const h = 86;
    const gap = 8;
    const startX = WIDTH / 2 - ((cols - 1) * (w + gap)) / 2;
    list.forEach((o, i) => {
      const x = startX + (i % cols) * (w + gap);
      const y = top + Math.floor(i / cols) * (h + gap) + h / 2;
      const done = claimed.has(o.id);
      const alpha = enabled ? 1 : 0.35;
      const card = this.add
        .rectangle(x, y, w, h, o.color, 0.16)
        .setStrokeStyle(2, o.color, alpha)
        .setAlpha(alpha);
      this.add.text(x, y - 24, o.emoji, { fontSize: '22px' }).setOrigin(0.5).setAlpha(alpha);
      this.add
        .text(x, y + 2, o.name, { fontSize: '11px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5)
        .setAlpha(alpha);
      const drop = o.drop;
      this.add
        .text(x, y + 20, done ? 'claimed today' : drop ? `${drop.emoji} ${RARITY_LABEL[drop.rarity]}` : '—', {
          fontSize: '10px',
          fontFamily: FONT,
          color: done ? '#6b6180' : `#${RARITY_COLOR[drop?.rarity ?? 'common'].toString(16).padStart(6, '0')}`,
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
      this.add
        .text(x + w / 2 - 4, y - h / 2 + 3, `${o.skill}`, { fontSize: '9px', fontFamily: FONT, color: '#6b6180' })
        .setOrigin(1, 0)
        .setAlpha(alpha);

      if (enabled) {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => {
          this.opponent = o;
          if (o.ranked) void this.showWager();
          else void this.startBattle();
        });
      }
    });
  }

  // ---------------- wager ----------------

  private async showWager(): Promise<void> {
    this.children.removeAll();
    this.phase = 'wager';
    const owned = await getCollection();

    this.add
      .text(WIDTH / 2, 40, `STAKE A POG vs ${this.opponent.name}`, { fontSize: '20px', fontFamily: FONT, fontStyle: 'bold', color: '#f9d64b' })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 68, 'lose, and it’s gone. win, and you take theirs.', { fontSize: '12px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5);

    if (owned.length === 0) {
      this.add
        .text(WIDTH / 2, HEIGHT / 2, 'you don’t own a pog to stake.\nbeat a highschooler first.', {
          fontSize: '16px',
          fontFamily: FONT,
          color: '#ffffff',
          align: 'center',
        })
        .setOrigin(0.5);
    }

    const cols = 3;
    const w = 140;
    const h = 96;
    const gap = 10;
    const startX = WIDTH / 2 - ((cols - 1) * (w + gap)) / 2;
    owned.slice(0, 15).forEach((inst, i) => {
      const def = pogDef(inst.defId);
      if (!def) return;
      const x = startX + (i % cols) * (w + gap);
      const y = 130 + Math.floor(i / cols) * (h + gap);
      const rc = RARITY_COLOR[def.rarity];
      const card = this.add
        .rectangle(x, y, w, h, rc, 0.14)
        .setStrokeStyle(2, rc, 0.8)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, y - 26, def.emoji, { fontSize: '22px' }).setOrigin(0.5);
      this.add.text(x, y + 2, def.name, { fontSize: '11px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      this.add
        .text(x, y + 22, `${RARITY_LABEL[def.rarity]}${inst.equipped ? ' · equipped' : ''}`, {
          fontSize: '10px',
          fontFamily: FONT,
          color: `#${rc.toString(16).padStart(6, '0')}`,
        })
        .setOrigin(0.5);
      card.on('pointerdown', () => {
        this.wager = inst;
        void this.startBattle();
      });
    });

    const back = this.add
      .text(WIDTH / 2, HEIGHT - 30, '← pick someone else', { fontSize: '15px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => void this.showSelect());
  }

  // ---------------- battle ----------------

  private async startBattle(): Promise<void> {
    this.children.removeAll();
    this.phase = 'battle';
    this.round = 0;
    this.youWins = 0;
    this.themWins = 0;
    this.rounds = [];

    // the Locker's Advantage only matters at circuit level: ranked battles
    const profile = await getProfile();
    this.advantagePercent = this.opponent.ranked ? (await computeCurrentAdvantage(profile.totalRuns)).percent : 0;

    const o = this.opponent;
    this.add.circle(WIDTH / 2, 120, 44, o.color, 0.9).setStrokeStyle(4, 0xffffff, 0.2);
    this.add.text(WIDTH / 2, 120, o.emoji, { fontSize: '38px' }).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 182, `${o.name} — ${o.epithet}`, { fontSize: '16px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 206, `${o.ranked ? 'RANKED' : 'PRACTICE'} · skill ${o.skill}${this.advantagePercent ? ` · your advantage +${Math.round(this.advantagePercent)}%` : ''}`, {
        fontSize: '12px',
        fontFamily: FONT,
        color: o.ranked ? '#f9d64b' : '#b7aed0',
      })
      .setOrigin(0.5);

    if (this.wager) {
      const wd = pogDef(this.wager.defId);
      this.add
        .text(WIDTH / 2, 228, `staked: ${wd?.emoji ?? ''} ${wd?.name ?? ''}`, { fontSize: '12px', fontFamily: FONT, color: '#ef4444' })
        .setOrigin(0.5);
    }

    this.scoreText = this.add
      .text(WIDTH / 2, 290, '0 — 0', { fontSize: '44px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    this.add.text(WIDTH / 2 - 90, 322, 'YOU', { fontSize: '12px', fontFamily: FONT, color: '#b7aed0' }).setOrigin(0.5);
    this.add.text(WIDTH / 2 + 90, 322, 'THEM', { fontSize: '12px', fontFamily: FONT, color: '#b7aed0' }).setOrigin(0.5);

    this.roundText = this.add
      .text(WIDTH / 2, 372, '', { fontSize: '20px', fontFamily: FONT, fontStyle: 'bold', color: '#f9d64b' })
      .setOrigin(0.5);

    // slam bar
    const by = 470;
    this.add.rectangle(WIDTH / 2, by, BAR_W, 22, 0x1c1430).setStrokeStyle(2, 0x362a52);
    this.add.rectangle(WIDTH / 2, by, SWEET_HALF * 2, 22, 0x4ade80, 0.35);
    this.add.rectangle(WIDTH / 2, by, SWEET_HALF * 5, 22, 0xf9d64b, 0.12);
    this.add.rectangle(WIDTH / 2, by, 2, 30, 0xffffff, 0.6);
    this.marker = this.add.rectangle(WIDTH / 2 - BAR_W / 2, by, 8, 34, 0x8b5cf6).setStrokeStyle(2, 0xffffff);

    this.hintText = this.add
      .text(WIDTH / 2, 530, '', { fontSize: '15px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5);

    const zone = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0).setInteractive();
    zone.on('pointerdown', () => this.onSlamTap());
    this.input.keyboard?.on('keydown-SPACE', () => this.onSlamTap());

    this.beginRound();
  }

  private beginRound(): void {
    this.round += 1;
    this.markerT = 0;
    this.markerDir = 1;
    const base = this.opponent.ranked ? 1.9 : 1.5;
    this.sweepSpeed = base + (this.round - 1) * 0.35;
    this.roundText.setText(`ROUND ${this.round}`);
    this.hintText.setText('tap when the marker hits the centre');
    this.sweeping = false;
    this.time.delayedCall(500, () => {
      if (this.phase === 'battle') this.sweeping = true;
    });
  }

  private onSlamTap(): void {
    if (this.phase !== 'battle' || !this.sweeping) return;
    this.sweeping = false;

    const distPx = Math.abs(this.markerT - 0.5) * BAR_W;
    let you = Math.round(100 - Math.min(100, Math.max(0, (distPx - SWEET_HALF) / (BAR_W / 2 - SWEET_HALF)) * 100));
    you = Math.min(100, Math.round(you * (1 + this.advantagePercent / 100)));

    const s = this.opponent.skill;
    const them = Math.round(Math.min(100, s * 0.55 + Math.random() * 45));

    this.rounds.push({ you, them });
    const youWon = you > them || (you === them && Math.random() < 0.5);
    if (youWon) this.youWins += 1;
    else this.themWins += 1;
    this.scoreText.setText(`${this.youWins} — ${this.themWins}`);

    const label = you >= 96 ? 'PERFECT SLAM' : you >= 80 ? 'CLEAN SLAM' : you >= 50 ? 'WOBBLY' : 'FLIPPED';
    this.hintText.setText(`${label}  ·  you ${you}  vs  them ${them}  ·  ${youWon ? 'round yours' : 'round theirs'}`);
    this.hintText.setColor(youWon ? '#4ade80' : '#ef4444');
    this.cameras.main.shake(100, youWon ? 0.004 : 0.008);

    const done = this.youWins >= ROUNDS_TO_WIN || this.themWins >= ROUNDS_TO_WIN;
    this.time.delayedCall(1100, () => {
      if (this.phase !== 'battle') return;
      this.hintText.setColor('#b7aed0');
      if (done) void this.finish();
      else this.beginRound();
    });
  }

  // ---------------- result ----------------

  private async finish(): Promise<void> {
    this.phase = 'result';
    const won = this.youWins > this.themWins;
    const res = await resolveBattle({
      opponent: this.opponent,
      rounds: this.rounds,
      won,
      wagerInstanceId: this.wager?.id ?? null,
    });

    const depth = 10;
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.94).setDepth(depth);
    this.add
      .text(WIDTH / 2, 190, won ? 'YOU TOOK THE STACK' : 'SLAMMED', {
        fontSize: '28px',
        fontFamily: FONT,
        fontStyle: 'bold',
        color: won ? '#4ade80' : '#ef4444',
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.add
      .text(WIDTH / 2, 232, `${this.youWins} — ${this.themWins} vs ${this.opponent.name}`, { fontSize: '16px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5)
      .setDepth(depth + 1);

    let y = 300;
    if (res.dropped) {
      this.renderDropCard(res.dropped, y, depth + 1);
      y += 150;
    } else if (won && res.dropWasAlreadyClaimed) {
      this.add
        .text(WIDTH / 2, y, 'already claimed their pog today — come back tomorrow', { fontSize: '13px', fontFamily: FONT, color: '#b7aed0' })
        .setOrigin(0.5)
        .setDepth(depth + 1);
      y += 40;
    } else if (res.lostInstance) {
      const ld = pogDef(res.lostInstance.defId);
      this.add
        .text(WIDTH / 2, y, `${ld?.emoji ?? ''} ${ld?.name ?? 'your stake'} is gone.`, { fontSize: '15px', fontFamily: FONT, fontStyle: 'bold', color: '#ef4444' })
        .setOrigin(0.5)
        .setDepth(depth + 1);
      y += 40;
    } else if (!won) {
      this.add
        .text(WIDTH / 2, y, 'practice — nothing lost', { fontSize: '13px', fontFamily: FONT, color: '#b7aed0' })
        .setOrigin(0.5)
        .setDepth(depth + 1);
      y += 40;
    }

    // ranked rematches must re-stake: the previous stake may be gone (loss) and
    // a stake is the price of admission either way
    this.makeButton(Math.max(y + 30, 560), 'REMATCH', 0xf9d64b, '#221a10', () => {
      this.wager = null;
      if (this.opponent.ranked) void this.showWager();
      else void this.startBattle();
    }, depth + 1);
    this.makeButton(Math.max(y + 100, 630), 'POG BINDER', 0xf97316, '#221a10', () => this.scene.start('PogBinder'), depth + 1);
    this.makeButton(Math.max(y + 170, 700), 'MENU', 0x22c55e, '#ffffff', () => this.scene.start('ModeSelect'), depth + 1);
  }

  private renderDropCard(def: PogDef, y: number, depth: number): void {
    const rc = RARITY_COLOR[def.rarity];
    this.add.rectangle(WIDTH / 2, y + 40, 300, 130, rc, 0.16).setStrokeStyle(3, rc).setDepth(depth);
    this.add.circle(WIDTH / 2 - 100, y + 40, 30, def.color, 0.95).setStrokeStyle(3, rc).setDepth(depth);
    this.add.text(WIDTH / 2 - 100, y + 40, def.emoji, { fontSize: '28px' }).setOrigin(0.5).setDepth(depth + 1);
    this.add
      .text(WIDTH / 2 - 55, y + 4, `NEW: ${def.name}`, { fontSize: '15px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0, 0)
      .setDepth(depth + 1);
    this.add
      .text(WIDTH / 2 - 55, y + 26, RARITY_LABEL[def.rarity], { fontSize: '12px', fontFamily: FONT, color: `#${rc.toString(16).padStart(6, '0')}` })
      .setOrigin(0, 0)
      .setDepth(depth + 1);
    this.add
      .text(WIDTH / 2 - 55, y + 46, describePerks(def.perks).join(' · '), { fontSize: '12px', fontFamily: FONT, color: '#f9d64b', wordWrap: { width: 190 } })
      .setOrigin(0, 0)
      .setDepth(depth + 1);
    this.add
      .text(WIDTH / 2, y + 116, 'equip it in the Pog Binder', { fontSize: '11px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5)
      .setDepth(depth + 1);
  }

  private makeButton(y: number, label: string, color: number, textColor: string, onTap: () => void, depth: number): void {
    const btn = this.add
      .rectangle(WIDTH / 2, y, 300, 54, color)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(WIDTH / 2, y, label, { fontSize: '19px', fontFamily: FONT, fontStyle: 'bold', color: textColor })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    btn.on('pointerdown', () => {
      this.tweens.add({ targets: btn, scale: 0.96, duration: 70, yoyo: true, onComplete: onTap });
    });
  }
}
