import Phaser from 'phaser';
import type { PadButtons } from '../systems/gamepad';

export interface PanelRow {
  label: string;
  action?: () => void;
  enabled?: boolean;
  color?: string;
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
    const panel = this.scene.add.container(480, 270).setDepth(85);
    this.panel = panel;
    const text = (x: number, y: number, s: string, size = 14, color = '#e2e8f0') => {
      const t = this.scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, lineSpacing: 5 });
      panel.add(t);
      return t;
    };
    panel.add(this.scene.add.rectangle(0, 0, 960, 540, 0x030712, 0.7).setInteractive());
    panel.add(this.scene.add.rectangle(0, 0, 760, 500, 0x0e0a1a).setStrokeStyle(2, accent));
    text(-356, -232, view.title, 22, accentHex).setFontStyle('bold');
    if (view.subtitle) text(-356, -200, view.subtitle, 12, '#b7aed0').setWordWrapWidth(700);
    const button = (x: number, y: number, w: number, label: string, action: () => void, on = false) => {
      const b = this.scene.add.rectangle(x, y, w, 26, on ? accent : 0x241b3a).setStrokeStyle(1, accent).setInteractive({ useHandCursor: true });
      b.on('pointerdown', action);
      panel.add(b);
      text(x, y, label, 12, '#ffffff').setOrigin(0.5).setFontStyle('bold');
    };
    button(350, -228, 36, '×', () => this.host.onClose());
    if (view.tabs) {
      const tw = 700 / view.tabs.length;
      view.tabs.forEach((label, i) => button(-350 + tw * (i + 0.5), -150, tw - 8, label, () => {
        const dir = i - (view.tab ?? 0);
        if (dir !== 0) for (let n = 0; n < Math.abs(dir); n++) this.host.onTab?.(dir > 0 ? 1 : -1);
      }, i === view.tab));
    }
    const top = view.tabs ? -128 : -170;
    const page = Math.floor(this.index / pageSize);
    const pages = Math.max(1, Math.ceil(this.rows.length / pageSize));
    this.rows.slice(page * pageSize, (page + 1) * pageSize).forEach((row, i) => {
      const idx = page * pageSize + i;
      const y = top + i * rowH + rowH / 2;
      const selected = idx === this.index;
      const bg = this.scene.add.rectangle(0, y, 720, rowH - 4, selected ? 0x2a2146 : 0x16112a)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xfacc15 : 0x2e2548).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.index = idx;
        if (row.enabled !== false && row.action) row.action();
        else this.render();
      });
      panel.add(bg);
      text(-348, y, row.label, 13, row.enabled === false ? '#6b6180' : row.color ?? '#e2e8f0').setOrigin(0, 0.5);
    });
    if (pages > 1) {
      button(250, 172, 36, '‹', () => this.page(-1, pageSize));
      button(340, 172, 36, '›', () => this.page(1, pageSize));
      text(295, 172, `${page + 1}/${pages}`, 12).setOrigin(0.5);
    }
    if (view.feedback) text(-356, 158, view.feedback, 12, '#fcd68c').setWordWrapWidth(560);
    text(-356, 214, view.footer ?? '↑ ↓ choose · A / K select · LB RB / ← → tabs · B / Esc close', 11, '#8b80a8');
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
    } else if (pressed.x || J(keys.j)) this.host.onAlt?.(this.index);
  }
}
