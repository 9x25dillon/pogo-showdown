import Phaser from 'phaser';
import { music } from '../systems/music';
import { COLORS, HEIGHT, WIDTH } from '../config';
import { INPUT_GLYPH, TRICKS, lengthsForProgress, windowPerInput, type TrickDef, type TrickInput } from '../data/tricks';
import { recordTrickLabSession } from '../db/repository';

const SESSION_SECONDS = 60;
const STRINGS = 3;
const SWIPE_THRESHOLD = 28;
const TAP_MAX_MS = 250;
const ACCENT = 0x14b8a6;
const ACCENT_HEX = '#14b8a6';
const FONT = 'system-ui, sans-serif';

/**
 * Yoyo Trick Lab: a named trick is shown as a short swipe/tap pattern;
 * reproduce it inside the timing window to land it. Landed tricks chain
 * into a combo multiplier (same shape as Pogo Dash's), a drop breaks the
 * chain and costs a string. 60 second sessions, 3 strings.
 */
export class TrickLabScene extends Phaser.Scene {
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private landed = 0;
  private strings = STRINGS;
  private sessionLeft = SESSION_SECONDS;
  private over = false;
  private started = false;
  private sessionStartedAt = 0;

  private trick!: TrickDef;
  private step = 0;
  private trickWindow = 0;
  private trickLeft = 0;
  private lastTrickName = '';

  private pointerActive = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerStartT = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private clockText!: Phaser.GameObjects.Text;
  private stringsText!: Phaser.GameObjects.Text;
  private trickNameText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerBarMaxW = 300;
  private glyphBoxes: Phaser.GameObjects.Rectangle[] = [];
  private glyphTexts: Phaser.GameObjects.Text[] = [];
  private yoyo!: Phaser.GameObjects.Arc;
  private yoyoString!: Phaser.GameObjects.Line;
  private yoyoAxle!: Phaser.GameObjects.Arc;
  private timerTrack!: Phaser.GameObjects.Rectangle;
  private startOverlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('TrickLab');
  }

  create(): void {
    music.play('explore');
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.landed = 0;
    this.strings = STRINGS;
    this.sessionLeft = SESSION_SECONDS;
    this.over = false;
    this.started = false;
    this.pointerActive = false;
    this.lastTrickName = '';
    this.glyphBoxes = [];
    this.glyphTexts = [];

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.buildHud();
    this.buildYoyo();
    this.setupInput();
    this.showStartOverlay();
  }

  update(_time: number, delta: number): void {
    if (!this.started || this.over) return;
    const dt = delta / 1000;

    this.sessionLeft -= dt;
    this.clockText.setText(`${Math.max(0, Math.ceil(this.sessionLeft))}s`);
    if (this.sessionLeft <= 0) {
      this.endSession();
      return;
    }

    this.trickLeft -= dt;
    const frac = Phaser.Math.Clamp(this.trickLeft / this.trickWindow, 0, 1);
    this.timerBar.width = this.timerBarMaxW * frac;
    this.timerBar.setFillStyle(frac < 0.3 ? COLORS.danger : ACCENT);
    if (this.trickLeft <= 0) this.dropTrick('TOO SLOW');
  }

  // ---------- setup ----------

  private buildHud(): void {
    this.add
      .text(WIDTH / 2, 44, 'YOYO TRICK LAB', {
        fontSize: '22px',
        fontFamily: FONT,
        fontStyle: 'bold',
        color: ACCENT_HEX,
      })
      .setOrigin(0.5);

    this.scoreText = this.add
      .text(WIDTH / 2, 96, '0', { fontSize: '40px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);

    this.comboText = this.add
      .text(WIDTH / 2, 132, '', { fontSize: '16px', fontFamily: FONT, fontStyle: 'bold', color: '#f9d64b' })
      .setOrigin(0.5);

    this.clockText = this.add
      .text(WIDTH - 30, 44, `${SESSION_SECONDS}s`, { fontSize: '20px', fontFamily: FONT, fontStyle: 'bold', color: '#b7aed0' })
      .setOrigin(1, 0.5);

    this.stringsText = this.add
      .text(30, 44, this.stringsLabel(), { fontSize: '18px', fontFamily: FONT })
      .setOrigin(0, 0.5);

    this.trickNameText = this.add
      .text(WIDTH / 2, 330, '', { fontSize: '26px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);

    this.timerTrack = this.add.rectangle(WIDTH / 2, 470, this.timerBarMaxW, 8, 0x1c1430).setStrokeStyle(1, 0x362a52);
    this.timerBar = this.add.rectangle(WIDTH / 2 - this.timerBarMaxW / 2, 470, this.timerBarMaxW, 8, ACCENT).setOrigin(0, 0.5);

    this.feedbackText = this.add
      .text(WIDTH / 2, 530, '', { fontSize: '24px', fontFamily: FONT, fontStyle: 'bold', color: '#4ade80' })
      .setOrigin(0.5)
      .setAlpha(0);

    this.add
      .text(WIDTH / 2, HEIGHT - 36, 'swipe ↑ ↓ ← →  ·  tap ●', { fontSize: '13px', fontFamily: FONT, color: '#6b6180' })
      .setOrigin(0.5);
  }

  private buildYoyo(): void {
    const hx = WIDTH / 2;
    const hy = 600;
    this.add.circle(hx, hy, 5, 0x8a8098);
    this.yoyoString = this.add.line(0, 0, hx, hy, hx, hy + 90, 0xb7aed0).setOrigin(0);
    this.yoyo = this.add.circle(hx, hy + 90, 22, ACCENT).setStrokeStyle(4, 0x0f766e);
    this.yoyoAxle = this.add.circle(hx, hy + 90, 5, 0x0b0714).setDepth(1);
    this.spinYoyo();
  }

  private spinYoyo(): void {
    this.tweens.add({ targets: this.yoyo, angle: '+=360', duration: 900, repeat: -1 });
  }

  private showStartOverlay(): void {
    const dim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.55).setDepth(5);
    const t1 = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 60, 'A trick is called.\nSwipe its pattern before the bar runs out.', {
        fontSize: '18px',
        fontFamily: FONT,
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(6);
    const t2 = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 10, `${SESSION_SECONDS} seconds · ${STRINGS} strings · chain for combo`, {
        fontSize: '14px',
        fontFamily: FONT,
        color: '#b7aed0',
      })
      .setOrigin(0.5)
      .setDepth(6);
    const btn = this.add
      .rectangle(WIDTH / 2, HEIGHT / 2 + 80, 240, 56, ACCENT)
      .setDepth(6)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, 'THROW DOWN', { fontSize: '20px', fontFamily: FONT, fontStyle: 'bold', color: '#052e2b' })
      .setOrigin(0.5)
      .setDepth(7);
    const back = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 140, '← back to menu', { fontSize: '15px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5)
      .setDepth(6)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('ModeSelect'));
    btn.on('pointerdown', () => this.startSession());
    this.startOverlay = [dim, t1, t2, btn, btnText, back];
  }

  private startSession(): void {
    for (const o of this.startOverlay) o.destroy();
    this.startOverlay = [];
    this.started = true;
    // the tap that pressed the button must not count as the first trick input;
    // Phaser dispatches game-object handlers before the scene-level pointerdown,
    // so we time-fence rather than flag-reset here
    this.pointerActive = false;
    this.sessionStartedAt = this.time.now;
    this.nextTrick();
  }

  private setupInput(): void {
    const onDown = (p: Phaser.Input.Pointer) => {
      if (this.started && this.time.now - this.sessionStartedAt < 120) return;
      this.pointerActive = true;
      this.pointerStartX = p.x;
      this.pointerStartY = p.y;
      this.pointerStartT = this.time.now;
    };

    const onUp = (p: Phaser.Input.Pointer) => {
      if (!this.pointerActive) return;
      this.pointerActive = false;
      if (!this.started || this.over) return;
      const dx = p.x - this.pointerStartX;
      const dy = p.y - this.pointerStartY;
      const dt = this.time.now - this.pointerStartT;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
        this.handleInput(dx > 0 ? 'right' : 'left');
      } else if (dy < -SWIPE_THRESHOLD) {
        this.handleInput('up');
      } else if (dy > SWIPE_THRESHOLD) {
        this.handleInput('down');
      } else if (dt < TAP_MAX_MS) {
        this.handleInput('tap');
      }
    };
    this.input.on('pointerdown', onDown);
    this.input.on('pointerup', onUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', onDown);
      this.input.off('pointerup', onUp);
    });

    const kb = this.input.keyboard;
    if (kb) {
      const bindings: Record<string, TrickInput> = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right', SPACE: 'tap' };
      for (const [key, input] of Object.entries(bindings)) {
        const handler = () => this.keyInput(input);
        kb.on(`keydown-${key}`, handler);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off(`keydown-${key}`, handler));
      }
    }
  }

  private keyInput(input: TrickInput): void {
    if (!this.started) {
      this.startSession();
      return;
    }
    if (!this.over) this.handleInput(input);
  }

  // ---------- trick flow ----------

  private nextTrick(): void {
    const [minLen, maxLen] = lengthsForProgress(this.landed);
    const pool = TRICKS.filter(
      (t) => t.sequence.length >= minLen && t.sequence.length <= maxLen && t.name !== this.lastTrickName,
    );
    this.trick = Phaser.Utils.Array.GetRandom(pool.length ? pool : TRICKS);
    this.lastTrickName = this.trick.name;
    // test hooks for automated drives
    const w = window as unknown as { __trick?: string; __seq?: TrickInput[] };
    w.__trick = this.trick.name;
    w.__seq = this.trick.sequence;
    this.step = 0;
    this.trickWindow = windowPerInput(this.landed) * this.trick.sequence.length + 0.4;
    this.trickLeft = this.trickWindow;

    this.trickNameText.setText(this.trick.name);
    this.tweens.add({ targets: this.trickNameText, scale: { from: 1.2, to: 1 }, duration: 160, ease: 'Back.Out' });
    this.renderGlyphs();
  }

  private renderGlyphs(): void {
    for (const b of this.glyphBoxes) b.destroy();
    for (const t of this.glyphTexts) t.destroy();
    this.glyphBoxes = [];
    this.glyphTexts = [];

    const seq = this.trick.sequence;
    const size = 64;
    const gap = 12;
    const totalW = seq.length * size + (seq.length - 1) * gap;
    const startX = WIDTH / 2 - totalW / 2 + size / 2;
    const y = 400;

    seq.forEach((input, i) => {
      const x = startX + i * (size + gap);
      const box = this.add.rectangle(x, y, size, size, 0x1c1430).setStrokeStyle(2, 0x362a52);
      const txt = this.add
        .text(x, y, INPUT_GLYPH[input], { fontSize: '34px', fontFamily: FONT, fontStyle: 'bold', color: '#b7aed0' })
        .setOrigin(0.5);
      this.glyphBoxes.push(box);
      this.glyphTexts.push(txt);
    });
    this.highlightCurrent();
  }

  private highlightCurrent(): void {
    this.glyphBoxes.forEach((box, i) => {
      if (i < this.step) {
        box.setFillStyle(ACCENT, 0.35).setStrokeStyle(2, ACCENT);
        this.glyphTexts[i].setColor('#ffffff');
      } else if (i === this.step) {
        box.setFillStyle(0x1c1430).setStrokeStyle(3, 0xf9d64b);
        this.glyphTexts[i].setColor('#f9d64b');
      } else {
        box.setFillStyle(0x1c1430).setStrokeStyle(2, 0x362a52);
        this.glyphTexts[i].setColor('#b7aed0');
      }
    });
  }

  private handleInput(input: TrickInput): void {
    const expected = this.trick.sequence[this.step];
    this.animateYoyo(input);

    if (input !== expected) {
      this.dropTrick('DROPPED');
      return;
    }

    this.step += 1;
    const box = this.glyphBoxes[this.step - 1];
    this.tweens.add({ targets: box, scale: { from: 1.25, to: 1 }, duration: 120 });
    this.highlightCurrent();

    if (this.step >= this.trick.sequence.length) this.landTrick();
  }

  private landTrick(): void {
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.landed += 1;

    const base = this.trick.sequence.length * 25;
    const speedBonus = Math.round((this.trickLeft / this.trickWindow) * 20);
    const multiplier = 1 + Math.min(this.combo, 12) * 0.12;
    const gained = Math.round((base + speedBonus) * multiplier);
    this.score += gained;

    this.scoreText.setText(`${this.score}`);
    this.tweens.add({ targets: this.scoreText, scale: { from: 1.15, to: 1 }, duration: 140 });
    this.comboText.setText(this.combo >= 2 ? `combo x${this.combo}  ·  ${multiplier.toFixed(2)}×` : '');
    this.showFeedback(`LANDED  +${gained}`, '#4ade80');

    this.time.delayedCall(220, () => {
      if (!this.over) this.nextTrick();
    });
  }

  private dropTrick(reason: string): void {
    this.combo = 0;
    this.strings -= 1;
    this.comboText.setText('');
    this.stringsText.setText(this.stringsLabel());
    this.showFeedback(reason, '#ef4444');
    this.cameras.main.shake(120, 0.004);

    if (this.strings <= 0) {
      this.endSession();
      return;
    }
    this.time.delayedCall(350, () => {
      if (!this.over) this.nextTrick();
    });
    // stop the timer from double-firing while the delay runs
    this.trickLeft = 999;
  }

  private showFeedback(msg: string, color: string): void {
    this.feedbackText.setText(msg).setColor(color).setAlpha(1).setScale(1.2);
    this.tweens.killTweensOf(this.feedbackText);
    this.tweens.add({ targets: this.feedbackText, alpha: 0, scale: 1, duration: 600, delay: 150 });
  }

  private animateYoyo(input: TrickInput): void {
    const hx = WIDTH / 2;
    const hy = 600;
    const rest = { x: hx, y: hy + 90 };
    const to =
      input === 'up' ? { x: hx, y: hy + 20 } :
      input === 'down' ? { x: hx, y: hy + 150 } :
      input === 'left' ? { x: hx - 110, y: hy + 60 } :
      input === 'right' ? { x: hx + 110, y: hy + 60 } :
      { x: hx, y: hy + 90 };
    this.tweens.killTweensOf(this.yoyo);
    this.yoyo.setPosition(rest.x, rest.y);
    this.tweens.add({
      targets: this.yoyo,
      x: to.x,
      y: to.y,
      duration: 110,
      yoyo: true,
      ease: 'Quad.Out',
      onUpdate: () => {
        this.yoyoString.setTo(hx, hy, this.yoyo.x, this.yoyo.y);
        this.yoyoAxle.setPosition(this.yoyo.x, this.yoyo.y);
      },
      onComplete: () => {
        this.yoyo.setPosition(rest.x, rest.y);
        this.yoyoAxle.setPosition(rest.x, rest.y);
        this.yoyoString.setTo(hx, hy, rest.x, rest.y);
        this.spinYoyo();
      },
    });
    if (input === 'tap') {
      this.tweens.add({ targets: this.yoyo, scale: { from: 1.3, to: 1 }, duration: 160 });
    }
  }

  private stringsLabel(): string {
    return '\u{1F9F5}'.repeat(this.strings) + '\u{2B1B}'.repeat(STRINGS - this.strings);
  }

  // ---------- end ----------

  private endSession(): void {
    if (this.over) return;
    this.over = true;
    this.timerBar.width = 0;
    this.clockText.setText('0s');
    this.tweens.killTweensOf(this.feedbackText);
    for (const b of this.glyphBoxes) b.destroy();
    for (const t of this.glyphTexts) t.destroy();
    this.glyphBoxes = [];
    this.glyphTexts = [];
    this.trickNameText.setVisible(false);
    this.feedbackText.setVisible(false);
    this.timerBar.setVisible(false);
    this.timerTrack.setVisible(false);
    void this.showResults();
  }

  private async showResults(): Promise<void> {
    const result = await recordTrickLabSession(this.score);
    const depth = 10;

    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.86).setDepth(depth);
    this.add
      .text(WIDTH / 2, 200, this.strings <= 0 ? 'STRING SNAPPED' : 'TIME', {
        fontSize: '30px',
        fontFamily: FONT,
        fontStyle: 'bold',
        color: this.strings <= 0 ? '#ef4444' : ACCENT_HEX,
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);

    this.add
      .text(WIDTH / 2, 280, `${this.score}`, { fontSize: '64px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(depth + 1);

    this.add
      .text(WIDTH / 2, 330, result.newBest ? 'NEW LAB BEST' : `lab best ${result.profile.trickLabBest ?? 0}`, {
        fontSize: '15px',
        fontFamily: FONT,
        fontStyle: 'bold',
        color: result.newBest ? '#f9d64b' : '#b7aed0',
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);

    this.add
      .text(WIDTH / 2, 380, `${this.landed} tricks landed  ·  best combo x${this.bestCombo}`, {
        fontSize: '15px',
        fontFamily: FONT,
        color: '#b7aed0',
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);

    this.add
      .text(WIDTH / 2, 410, `session #${result.profile.trickLabSessions ?? 1} · counts as Yoyo Rig use in the Locker`, {
        fontSize: '12px',
        fontFamily: FONT,
        color: '#6b6180',
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);

    this.makeButton(560, 'RUN IT BACK', 0xf9d64b, '#221a10', () => this.scene.restart(), depth + 1);
    this.makeButton(630, 'THE LOCKER', 0x8b5cf6, '#ffffff', () => this.scene.start('Loadout'), depth + 1);
    this.makeButton(700, 'MENU', 0x22c55e, '#ffffff', () => this.scene.start('ModeSelect'), depth + 1);
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
      btn.disableInteractive();
      this.tweens.add({ targets: btn, scale: 0.96, duration: 70, yoyo: true, onComplete: onTap });
    });
  }
}
