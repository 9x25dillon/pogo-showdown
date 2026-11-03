import Phaser from 'phaser';
import { RH, RW } from '../config';
import type { PadButtons } from '../systems/gamepad';
import { hint } from '../systems/inputHints';

export interface PanelRow {
  label: string;
  action?: () => void;
  enabled?: boolean;
  color?: string;
  /** a second button at the end of the row; touch has no X button, so this is how it reaches a secondary action */
  alt?: { label: string; action: () => void };
}

export interface PanelView {
  title: string;
  subtitle?: string;
  tabs?: string[];
  tab?: number;
  rows: PanelRow[];
  feedback?: string;
  footer?: string;
  accent?: number;
  /** px per row; 34 fits 8 rows a page */
  rowHeight?: number;
}

interface PanelHost {
  view: () => PanelView;
  onClose: () => void;
  onTab?: (dir: -1 | 1) => void;
  /** X / J on the selected row, for a secondary action */
  onAlt?: (index: number) => void;
}

const FONT = 'system-ui, sans-serif';

/**
 * One full-screen menu for every in-world activity (hero, duels, arena,
 * rifts): mouse/touch rows, ↑↓ + A for pads and keys, LB/RB or ←→ tabs.
 * Each child gets its own scroll factor - Phaser 4 containers don't pass
 * it down to hit tests (see Hand_off.md).
 */
export class RealmPanel {
  index = 0;
  private panel?: Phaser.GameObjects.Container;
  private rows: PanelRow[] = [];
  private openFrame = false;
  private scene: Phaser.Scene;
  private host: PanelHost;

  constructor(scene: Phaser.Scene, host: PanelHost) {
    this.scene = scene;
    this.host = host;
  }

  get open(): boolean { return !!this.panel; }

  show(index = 0): void {
    this.index = index;
    this.openFrame = true;
    this.render();
  }

  close(): void {
    this.panel?.destroy();
    this.panel = undefined;
  }

  render(): void {
    this.panel?.destroy();
    const view = this.host.view();
    const accent = view.accent ?? 0x7c3aed;
    const accentHex = `#${accent.toString(16).padStart(6, '0')}`;
    this.rows = view.rows;
    this.index = Phaser.Math.Clamp(this.index, 0, Math.max(0, this.rows.length - 1));
    const rowH = view.rowHeight ?? 34;
    const pageSize = Math.max(1, Math.floor(300 / rowH));
    // the card grows with the screen, so long rows get the room a wide phone has
    const cardW = Math.min(RW - 40, 1040);
    const left = -cardW / 2 + 24;
    const right = cardW / 2 - 24;
    const panel = this.scene.add.container(RW / 2, RH / 2).setDepth(85);
    this.panel = panel;
    const text = (x: number, y: number, s: string, size = 14, color = '#e2e8f0') => {
      const t = this.scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, lineSpacing: 5 });
      panel.add(t);
      return t;
    };
    // a tap outside the card closes it, so a touch screen is never stuck in a menu
    const shade = this.scene.add.rectangle(0, 0, RW, RH, 0x030712, 0.7).setInteractive();
    shade.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (Math.abs(p.x - RW / 2) > cardW / 2 || Math.abs(p.y - RH / 2) > 250) this.host.onClose();
    });
    panel.add(shade);
    panel.add(this.scene.add.rectangle(0, 0, cardW, 500, 0x0e0a1a).setStrokeStyle(2, accent).setInteractive());
    panel.add(this.scene.add.rectangle(0, -250 + 3, cardW - 4, 4, accent, 0.8));
    text(left, -232, view.title, 22, accentHex).setFontStyle('bold');
    if (view.subtitle) text(left, -200, view.subtitle, 12, '#b7aed0').setWordWrapWidth(cardW - 60);
    const button = (x: number, y: number, w: number, label: string, action: () => void, on = false, h = 26) => {
      const b = this.scene.add.rectangle(x, y, w, h, on ? accent : 0x241b3a).setStrokeStyle(1, accent).setInteractive({ useHandCursor: true });
      b.on('pointerdown', action);
      panel.add(b);
      text(x, y, label, 12, '#ffffff').setOrigin(0.5).setFontStyle('bold');
    };
    button(right - 14, -226, 48, '×', () => this.host.onClose(), false, 36);
    if (view.tabs) {
      const tw = (cardW - 60) / view.tabs.length;
      view.tabs.forEach((label, i) => button(left + 6 + tw * (i + 0.5), -150, tw - 8, label, () => {
        const dir = i - (view.tab ?? 0);
        if (dir !== 0) for (let n = 0; n < Math.abs(dir); n++) this.host.onTab?.(dir > 0 ? 1 : -1);
      }, i === view.tab, 30));
    }
    const top = view.tabs ? -128 : -170;
    const page = Math.floor(this.index / pageSize);
    const pages = Math.max(1, Math.ceil(this.rows.length / pageSize));
    this.rows.slice(page * pageSize, (page + 1) * pageSize).forEach((row, i) => {
      const idx = page * pageSize + i;
      const y = top + i * rowH + rowH / 2;
      const selected = idx === this.index;
      const bg = this.scene.add.rectangle(0, y, cardW - 40, rowH - 4, selected ? 0x2a2146 : 0x16112a)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xfacc15 : 0x2e2548).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.index = idx;
        if (row.enabled !== false && row.action) row.action();
        else this.render();
      });
      panel.add(bg);
      const room = cardW - 64 - (row.alt ? 106 : 0);
      const label = text(left + 8, y, row.label, 13, row.enabled === false ? '#6b6180' : row.color ?? '#e2e8f0').setOrigin(0, 0.5);
      // a row that doesn't fit wraps to two tight lines instead of running off the card
      if (label.width > room) label.setFontSize(11).setLineSpacing(0).setWordWrapWidth(room);
      if (row.alt) {
        const alt = row.alt;
        button(right - 50, y, 96, alt.label, () => { this.index = idx; alt.action(); }, false, rowH - 8);
      }
    });
    if (pages > 1) {
      button(right - 100, 172, 44, '‹', () => this.page(-1, pageSize), false, 32);
      button(right - 10, 172, 44, '›', () => this.page(1, pageSize), false, 32);
      text(right - 55, 172, `${page + 1}/${pages}`, 12).setOrigin(0.5);
    }
    if (view.feedback) text(left, 158, view.feedback, 12, '#fcd68c').setWordWrapWidth(cardW - 200);
    text(left, 214, view.footer ?? hint('↑ ↓ choose · A / K select · LB RB / ← → tabs · B / Esc close', 'tap a row · tap × or outside to close'), 11, '#8b80a8');
    for (const child of panel.list) (child as Phaser.GameObjects.Rectangle).setScrollFactor(0);
  }

  private page(dir: number, pageSize: number): void {
    const pages = Math.max(1, Math.ceil(this.rows.length / pageSize));
    this.index = ((Math.floor(this.index / pageSize) + dir + pages) % pages) * pageSize;
    this.render();
  }

  updateInput(pressed: PadButtons, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    if (!this.open) return;
    if (this.openFrame) { this.openFrame = false; return; }
    const J = Phaser.Input.Keyboard.JustDown;
    if (pressed.b || J(keys.esc)) { this.host.onClose(); return; }
    if (this.rows.length) {
      if (pressed.down || J(keys.down)) { this.index = (this.index + 1) % this.rows.length; this.render(); }
      if (pressed.up || J(keys.up)) { this.index = (this.index - 1 + this.rows.length) % this.rows.length; this.render(); }
    }
    if (pressed.rb || J(keys.right)) this.host.onTab?.(1);
    if (pressed.lb || J(keys.left)) this.host.onTab?.(-1);
    if (pressed.a || J(keys.k) || J(keys.space)) {
      const row = this.rows[this.index];
      if (row && row.enabled !== false) row.action?.();
    } else if (pressed.x || J(keys.j)) {
      const alt = this.rows[this.index]?.alt;
      if (alt) alt.action();
      else this.host.onAlt?.(this.index);
    }
  }
}
