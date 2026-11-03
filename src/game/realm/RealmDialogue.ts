import Phaser from 'phaser';
import { RH, RW } from '../config';
import type { PadButtons } from '../systems/gamepad';
import type { Speaker, StoryLine } from './story';

const FONT = 'Georgia, serif';
/** ignore advance presses this soon after a line appears, so a held attack can't skip it */
const LINE_GUARD_MS = 180;
const CHARS_PER_MS = 0.05;

export interface DialogueHost {
  pause: (open: boolean) => void;
  /** who is speaking: display name, portrait texture, accent colour */
  speaker: (who: Speaker) => { name: string; face?: string; color: number };
  /** an answer was chosen */
  answered: (ask: string, id: string) => void;
}

/**
 * Story scenes: a speech box along the bottom with the speaker's portrait.
 * A tap anywhere, or A / Space, writes out the line and then moves on; a line
 * with choices waits for one. Menu / Esc skips the scene, but never a question.
 */
export class RealmDialogue {
  /** every scene played, for the regression suite */
  readonly played: number[] = [];
  private scene: Phaser.Scene;
  private host: DialogueHost;
  private parts: Phaser.GameObjects.GameObject[] = [];
  private lines: StoryLine[] = [];
  private index = 0;
  private shownAt = 0;
  private done?: () => void;
  private typing?: { text: Phaser.GameObjects.Text; full: string };
  private choiceButtons: { bg: Phaser.GameObjects.Rectangle; id: string }[] = [];
  private choiceIndex = 0;

  constructor(scene: Phaser.Scene, host: DialogueHost) {
    this.scene = scene;
    this.host = host;
  }

  get open(): boolean { return this.lines.length > 0; }

  play(lines: StoryLine[], done?: () => void): void {
    this.played.push(lines.length);
    this.lines = lines;
    this.index = 0;
    this.done = done;
    if (lines.length === 0) { this.finish(); return; }
    this.host.pause(true);
    this.render();
  }

  private clear(): void {
    for (const p of this.parts) p.destroy();
    this.parts = [];
    this.choiceButtons = [];
  }

  private ui<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T): T {
    o.setScrollFactor(0).setDepth(90);
    this.parts.push(o);
    return o;
  }

  private render(): void {
    this.clear();
    this.typing = undefined;
    this.shownAt = this.scene.time.now;
    const line = this.lines[this.index];
    const who = this.host.speaker(line.who);
    // the whole screen advances, so a tap anywhere works and never reaches the world
    const shield = this.ui(this.scene.add.rectangle(RW / 2, RH / 2, RW, RH, 0x000000, 0.28)).setInteractive();
    shield.on('pointerdown', () => this.advance());
    const boxW = Math.min(RW - 40, 1000);
    const boxH = 132;
    const boxX = RW / 2;
    const boxY = line.choices ? RH - 196 : RH - 80;
    this.ui(this.scene.add.rectangle(boxX, boxY, boxW, boxH, 0x0b0714, 0.97).setStrokeStyle(2, who.color));
    const left = boxX - boxW / 2;
    let textX = left + 24;
    if (who.face) {
      this.ui(this.scene.add.rectangle(left + 66, boxY, 92, 112, 0x1c1430).setStrokeStyle(1, who.color));
      const img = this.ui(this.scene.add.image(left + 66, boxY + 54, who.face).setOrigin(0.5, 1));
      img.setScale(Math.min(84 / img.width, 104 / img.height));
      textX = left + 128;
    }
    const hex = `#${who.color.toString(16).padStart(6, '0')}`;
    if (who.name) this.ui(this.scene.add.text(textX, boxY - 56, who.name, { fontSize: '15px', fontFamily: FONT, fontStyle: 'bold', color: hex }));
    const text = this.ui(this.scene.add.text(textX, who.name ? boxY - 32 : boxY - 46, line.text, {
      fontSize: '17px', fontFamily: FONT, fontStyle: line.who === 'narrator' ? 'italic' : 'normal', color: '#f4eee0', lineSpacing: 6,
      wordWrap: { width: boxW - (textX - left) - 28 },
    }));
    // fix the wrapping up front, so words never jump lines as they type out
    const full = text.getWrappedText(line.text).join('\n');
    text.setWordWrapWidth(null).setText('');
    this.typing = { text, full };
    if (line.choices) {
      const n = line.choices.length;
      const w = Math.min(320, (boxW - 16 * (n - 1)) / n);
      this.choiceIndex = 0;
      line.choices.forEach((choice, i) => {
        const x = boxX + (i - (n - 1) / 2) * (w + 16);
        const bg = this.ui(this.scene.add.rectangle(x, RH - 78, w, 76, 0x241b3a).setStrokeStyle(2, i === 0 ? 0xfacc15 : who.color).setInteractive({ useHandCursor: true }));
        bg.on('pointerdown', () => this.choose(choice.id));
        this.ui(this.scene.add.text(x, RH - 78, choice.label, { fontSize: '15px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: w - 20 } }).setOrigin(0.5));
        this.choiceButtons.push({ bg, id: choice.id });
      });
    } else {
      this.ui(this.scene.add.text(boxX + boxW / 2 - 18, boxY + 60, '▼', { fontSize: '13px', color: '#a8a29e' }).setOrigin(1, 1));
    }
  }

  private choose(id: string): void {
    if (this.scene.time.now - this.shownAt < LINE_GUARD_MS) return;
    const line = this.lines[this.index];
    if (line?.ask) this.host.answered(line.ask, id);
    this.next();
  }

  private advance(): void {
    if (this.scene.time.now - this.shownAt < LINE_GUARD_MS) return;
    // the first press finishes the line, the next moves on; a question waits for its answer
    if (this.typing) { this.typing.text.setText(this.typing.full); this.typing = undefined; this.shownAt = this.scene.time.now; return; }
    if (this.lines[this.index]?.choices) return;
    this.next();
  }

  private next(): void {
    this.index++;
    if (this.index >= this.lines.length) this.finish();
    else this.render();
  }

  private finish(): void {
    this.clear();
    this.typing = undefined;
    this.lines = [];
    const done = this.done;
    this.done = undefined;
    this.host.pause(false);
    done?.();
  }

  /** skip to the next question, or the end of the scene */
  private skip(): void {
    const ask = this.lines.findIndex((l, i) => i >= this.index && l.choices);
    if (ask < 0) { this.finish(); return; }
    this.index = ask;
    this.render();
  }

  updateInput(pressed: PadButtons, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    const J = Phaser.Input.Keyboard.JustDown;
    if (this.typing) {
      const n = Math.floor((this.scene.time.now - this.shownAt) * CHARS_PER_MS);
      this.typing.text.setText(this.typing.full.slice(0, n));
      if (n >= this.typing.full.length) this.typing = undefined;
    }
    if (pressed.menu || J(keys.esc)) { this.skip(); return; }
    if (this.choiceButtons.length) {
      const dir = (pressed.right || J(keys.right) ? 1 : 0) - (pressed.left || J(keys.left) ? 1 : 0);
      if (dir) {
        const n = this.choiceButtons.length;
        this.choiceIndex = (this.choiceIndex + dir + n) % n;
        this.choiceButtons.forEach((b, i) => b.bg.setStrokeStyle(2, i === this.choiceIndex ? 0xfacc15 : 0x5b4a86));
      }
      if (pressed.a || J(keys.space) || J(keys.k)) {
        if (this.typing) this.advance();
        else this.choose(this.choiceButtons[this.choiceIndex].id);
      }
      return;
    }
    if (pressed.a || pressed.x || J(keys.j) || J(keys.k) || J(keys.space)) this.advance();
  }
}
