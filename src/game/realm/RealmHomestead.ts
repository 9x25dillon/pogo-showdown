import Phaser from 'phaser';
import { ITEM_NAME, type ItemId } from './items';
import { CHEST_SLOTS, FURNITURE, FURNITURE_KINDS, occupies, placementProblem, restoreHomestead, sheltered, transferStock,
  type Furniture, type FurnitureKind, type HomesteadSave, type Stock, type TileReader } from './homestead';
import type { PadButtons } from '../systems/gamepad';

interface HomeHost {
  tile: TileReader;
  pack: () => Stock;
  player: () => { x: number; y: number };
  available: () => boolean;
  danger: () => boolean;
  changed: (crafted?: boolean) => void;
  claim: (at?: { x: number; y: number }) => void;
  rest: () => void;
  pause: (open: boolean) => void;
  notify: (text: string) => void;
}
interface MenuRow { label: string; action: () => void; enabled?: boolean }
const FONT = 'system-ui, sans-serif';
const PAGE_SIZE = 7;

/** Furniture, building preview and storage UI live outside the combat scene. */
export class RealmHomestead {
  readonly data: HomesteadSave;
  selected?: FurnitureKind;
  panel?: Phaser.GameObjects.Container;
  private preview: Phaser.GameObjects.Graphics;
  private art: Phaser.GameObjects.Container;
  private marker: Phaser.GameObjects.Text;
  private rows: MenuRow[] = [];
  private index = 0;
  private mode: 'build' | 'furniture' | 'deposit' | 'withdraw' = 'build';
  private target?: Furniture;
  private feedback = '';
  private candidate?: { tx: number; ty: number; problem?: string };
  private openFrame = false;
  private scene: Phaser.Scene;
  private host: HomeHost;

  constructor(scene: Phaser.Scene, host: HomeHost, save?: HomesteadSave) {
    this.scene = scene;
    this.host = host;
    this.data = restoreHomestead(save, host.tile);
    this.art = scene.add.container(0, 0).setDepth(3);
    this.preview = scene.add.graphics().setDepth(21);
    this.marker = scene.add.text(0, 0, 'HOME', { fontFamily: FONT, fontSize: '10px', color: '#a7f3d0', backgroundColor: '#102c2a' })
      .setOrigin(0.5, 1).setDepth(4);
    this.drawFurniture();
  }

  get open(): boolean { return !!this.panel; }
  get home(): Furniture | undefined { return this.data.furniture.find(f => f.id === this.data.homeId); }
  get placing(): boolean { return !!this.selected; }

  nearby(): Furniture | undefined {
    const p = this.host.player();
    return this.data.furniture.filter(f => Math.hypot(p.x - (f.tx + FURNITURE[f.kind].width / 2) * 16, p.y - (f.ty + 1) * 16) < 64)
      .sort((a, b) => this.distance(a) - this.distance(b))[0];
  }

  private distance(f: Furniture): number {
    const p = this.host.player();
    return Math.hypot(p.x - (f.tx + FURNITURE[f.kind].width / 2) * 16, p.y - (f.ty + 1) * 16);
  }

  warmth(): boolean {
    return this.host.available() && !this.host.danger() && this.data.furniture.some(f => f.kind === 'campfire' && this.distance(f) < 96);
  }

  lights(): { x: number; y: number; r: number }[] {
    return this.data.furniture.filter(f => f.kind === 'campfire').map(f => ({ x: (f.tx + 1) * 16, y: f.ty * 16, r: 160 }));
  }

  protects(tx: number, ty: number, support = false): boolean {
    return this.data.furniture.some(f => occupies(f, tx, ty, support));
  }

  toggle(): void {
    if (this.open) { this.close(); return; }
    if (!this.host.available()) return;
    this.cancelPlacement();
    this.mode = 'build'; this.index = 0; this.feedback = ''; this.target = undefined;
    this.host.pause(true);
    this.openFrame = true;
    this.render();
  }

  interact(): void {
    if (!this.host.available() || this.open) return;
    const target = this.nearby();
    if (!target) return;
    this.cancelPlacement();
    this.target = target; this.mode = 'furniture'; this.index = 0; this.feedback = '';
    this.host.pause(true);
    this.openFrame = true;
    this.render();
  }

  close(): void {
    this.panel?.destroy(); this.panel = undefined;
    this.host.pause(false);
  }

  cancelPlacement(): void { this.selected = undefined; this.candidate = undefined; this.preview.clear(); }

  private canAfford(kind: FurnitureKind): boolean {
    const pack = this.host.pack();
    return (pack[kind] ?? 0) > 0 || Object.entries(FURNITURE[kind].cost).every(([id, n]) => (pack[id as ItemId] ?? 0) >= n);
  }

  prepare(kind: FurnitureKind): void {
    if (!this.host.available() || !this.canAfford(kind)) return;
    this.close(); this.selected = kind;
    this.host.notify(`Place ${ITEM_NAME[kind]} · aim + click / K / RT · H / LT to cancel`);
  }

  aim(tx: number, ty: number): void {
    this.preview.clear();
    if (!this.selected) return;
    // Smart ground snap makes chest-height controller aim useful for floor furniture.
    let y = ty;
    for (let drop = 0; drop <= 4; drop++) {
      if (this.host.tile(tx, ty + drop + 1) !== 0) { y = ty + drop; break; }
    }
    const d = FURNITURE[this.selected];
    const p = this.host.player();
    const distance = Math.hypot((tx + d.width / 2) * 16 - p.x, (y + 1) * 16 - p.y);
    const problem = distance > 88 ? 'Move closer to the building site.' : placementProblem(this.selected, tx, y, this.host.tile, this.data.furniture);
    this.candidate = { tx, ty: y, problem };
    const color = problem ? 0xfb7185 : 0x6ee7b7;
    this.preview.fillStyle(color, 0.18).fillRect(tx * 16, (y - d.clearance + 1) * 16, d.width * 16, d.clearance * 16);
    this.preview.lineStyle(2, color).strokeRect(tx * 16, (y - d.clearance + 1) * 16, d.width * 16, d.clearance * 16);
  }

  placementHint(): string {
    return this.candidate?.problem ?? `Place ${this.selected ? ITEM_NAME[this.selected] : ''} · click / K / RT · H / LT cancels`;
  }

  place(): boolean {
    if (!this.selected || !this.candidate || !this.host.available()) return false;
    // Recheck terrain, reach and resources at the moment of placement.
    this.aim(this.candidate.tx, this.candidate.ty);
    const { tx, ty, problem } = this.candidate;
    if (problem || !this.canAfford(this.selected)) return false;
    const kind = this.selected;
    const pack = this.host.pack();
    const crafted = !((pack[kind] ?? 0) > 0);
    if (!crafted) pack[kind]!--;
    else for (const [id, n] of Object.entries(FURNITURE[kind].cost)) pack[id as ItemId] = (pack[id as ItemId] ?? 0) - n;
    const id = Math.max(0, ...this.data.furniture.map(f => f.id)) + 1;
    this.data.furniture.push({ id, kind, tx, ty, stock: {} });
    this.cancelPlacement(); this.drawFurniture(); this.host.changed(crafted);
    this.host.notify(`${ITEM_NAME[kind]} built · stand nearby and press S / ▼, or tap the prompt`);
    return true;
  }

  private claim(bed: Furniture): void {
    this.data.homeId = bed.id;
    this.host.claim({ x: (bed.tx + 1.5) * 16, y: (bed.ty + 1) * 16 });
    this.drawFurniture(); this.host.changed();
  }

  private rest(bed: Furniture): void {
    if (this.host.danger()) { this.feedback = 'Enemies are nearby. Clear the area before resting.'; this.render(); return; }
    if (!sheltered(bed, this.host.tile)) { this.feedback = 'Build a roof 3–7 tiles above all three bed tiles to rest.'; this.render(); return; }
    this.claim(bed); this.host.rest(); this.close();
    this.host.notify('Rested and restored · this bed is your home');
  }

  private packFurniture(f: Furniture): void {
    if (Object.values(f.stock).some(n => n > 0)) { this.feedback = 'Empty this chest before packing it up.'; this.render(); return; }
    if (this.data.homeId === f.id) { this.data.homeId = undefined; this.host.claim(); }
    this.data.furniture.splice(this.data.furniture.indexOf(f), 1);
    const pack = this.host.pack(); pack[f.kind] = (pack[f.kind] ?? 0) + 1;
    this.drawFurniture(); this.host.changed(); this.close();
    this.host.notify(`${ITEM_NAME[f.kind]} packed · place it again from HOME`);
  }

  private transfer(item: ItemId, all = false): void {
    const f = this.target!;
    const deposit = this.mode === 'deposit';
    const from = deposit ? this.host.pack() : f.stock;
    const to = deposit ? f.stock : this.host.pack();
    const moved = transferStock(from, to, item, all ? Infinity : 1, deposit ? CHEST_SLOTS : Infinity);
    this.feedback = moved ? `${deposit ? 'Stored' : 'Withdrew'} ${moved} ${ITEM_NAME[item]}.` : 'Chest full: withdraw an item type to free a slot.';
    if (moved) this.host.changed();
    this.render();
  }

  private makeRows(): MenuRow[] {
    if (this.mode === 'build') return FURNITURE_KINDS.map(kind => {
      const pack = this.host.pack();
      const cost = (pack[kind] ?? 0) > 0 ? `Packed: ${pack[kind]} · no material cost` : Object.entries(FURNITURE[kind].cost)
        .map(([id, n]) => `${ITEM_NAME[id as ItemId]} ${pack[id as ItemId] ?? 0}/${n}`).join('    ');
      return { label: `${ITEM_NAME[kind]}    ${cost}\n${FURNITURE[kind].description}`, action: () => this.prepare(kind), enabled: this.canAfford(kind) };
    });
    const f = this.target!;
    if (this.mode === 'deposit' || this.mode === 'withdraw') {
      const pack = this.host.pack();
      const stock = this.mode === 'deposit' ? pack : f.stock;
      const items = (Object.keys(ITEM_NAME) as ItemId[]).filter(id => (stock[id] ?? 0) > 0);
      return [
        { label: '‹ Back to chest', action: () => { this.mode = 'furniture'; this.index = 0; this.feedback = ''; this.render(); } },
        ...items.map(item => ({ label: `${ITEM_NAME[item]}     pack ${pack[item] ?? 0}   /   chest ${f.stock[item] ?? 0}`, action: () => this.transfer(item) })),
      ];
    }
    const rows: MenuRow[] = [];
    if (f.kind === 'chest') {
      for (const mode of ['deposit', 'withdraw'] as const) rows.push({ label: mode === 'deposit' ? 'Store items from your pack' : 'Take items from this chest',
        action: () => { this.mode = mode; this.index = 0; this.feedback = ''; this.render(); } });
      rows.push({ label: 'Quick stack · store matching item types', action: () => {
        let total = 0;
        for (const item of Object.keys(f.stock) as ItemId[]) if ((f.stock[item] ?? 0) > 0) total += transferStock(this.host.pack(), f.stock, item, Infinity, CHEST_SLOTS);
        this.feedback = total ? `Stored ${total} items in matching stacks.` : 'No matching items in your pack.';
        if (total) this.host.changed(); this.render();
      } });
    } else if (f.kind === 'bed') {
      rows.push({ label: this.data.homeId === f.id ? '✓ Your home · respawn here in the overworld' : 'Set home · respawn at this bed', action: () => { this.claim(f); this.feedback = 'Home set. Follow the HOME compass to return.'; this.render(); } });
      rows.push({ label: 'Rest · restore health and sleep until dawn', action: () => this.rest(f) });
    } else rows.push({ label: 'Warmth · faster healing within 6 tiles, away from enemies', action: () => {}, enabled: false });
    rows.push({ label: 'Pack up furnishing', action: () => this.packFurniture(f) });
    return rows;
  }

  private render(): void {
    this.panel?.destroy();
    this.rows = this.makeRows();
    this.index = Math.min(this.index, this.rows.length - 1);
    const panel = this.scene.add.container(480, 270).setScrollFactor(0).setDepth(85);
    this.panel = panel;
    const addText = (x: number, y: number, text: string, size = 14, color = '#e2e8f0') => {
      const t = this.scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, lineSpacing: 7 }); panel.add(t); return t;
    };
    panel.add(this.scene.add.rectangle(0, 0, 960, 540, 0x030712, 0.65).setInteractive());
    panel.add(this.scene.add.rectangle(0, 0, 720, 480, 0x101c26).setStrokeStyle(2, 0x427c75));
    addText(-332, -216, this.mode === 'build' ? 'HOMESTEAD' : ITEM_NAME[this.target!.kind].toUpperCase(), 24, '#a7f3d0');
    const sub = this.mode === 'build' ? 'Make a place to return to. Select a furnishing, then place it in the world.'
      : this.target!.kind === 'chest' ? `${Object.values(this.target!.stock).filter(n => n > 0).length}/${CHEST_SLOTS} storage slots · ${this.mode === 'furniture' ? 'supplies saved here' : this.mode === 'deposit' ? 'PACK → CHEST' : 'CHEST → PACK'}`
      : this.target!.kind === 'bed' ? `${sheltered(this.target!, this.host.tile) ? 'Sheltered' : 'Needs a roof to rest'} · ${this.host.danger() ? 'enemies nearby' : 'area clear'}` : 'A light in the Forever Realm';
    addText(-332, -180, sub, 12, '#9cbbbf');
    const button = (x: number, y: number, w: number, label: string, action: () => void) => {
      const b = this.scene.add.rectangle(x, y, w, 32, 0x28454c).setStrokeStyle(1, 0x427c75).setInteractive({ useHandCursor: true });
      b.on('pointerdown', action); panel.add(b); addText(x, y - 9, label, 13).setOrigin(0.5, 0);
    };
    button(305, -205, 52, '×', () => this.close());
    const page = Math.floor(this.index / PAGE_SIZE);
    const pageRows = this.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    pageRows.forEach((row, i) => {
      const idx = page * PAGE_SIZE + i;
      const y = this.mode === 'build' ? -110 + i * 90 : -122 + i * 39;
      const selected = idx === this.index;
      const b = this.scene.add.rectangle(0, y, 664, this.mode === 'build' ? 78 : 34, selected ? 0x29474b : 0x192e39)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0x6ee7b7 : 0x2d4b55).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { this.index = idx; if (row.enabled !== false) row.action(); else this.render(); });
      panel.add(b);
      addText(-318, y, row.label, this.mode === 'build' ? 13 : 14, row.enabled === false ? '#81969c' : '#e2e8f0').setOrigin(0, 0.5);
    });
    addText(-332, 157, this.feedback || (this.mode === 'build' ? 'Mine trees for wood, stone for rock, copper ore; defeat slimes for gel.' : ''), 12, '#fcd68c').setWordWrapWidth(660);
    if (this.mode === 'deposit' || this.mode === 'withdraw') {
      button(-242, 204, 180, 'Move selected stack', () => this.transferSelectedStack());
      button(175, 204, 48, '‹', () => this.page(-1));
      button(290, 204, 48, '›', () => this.page(1));
      addText(232, 195, `${page + 1}/${Math.ceil(this.rows.length / PAGE_SIZE)}`, 12).setOrigin(0.5, 0);
      addText(-42, 190, 'A / click: one\nX: whole stack', 11, '#9cbbbf');
    } else addText(-332, 208, '↑ ↓ choose · A / K select · H / LT / B / Esc close', 12, '#9cbbbf');
    // Hit tests read each child. Phaser 4's container propagation skips inherited properties.
    for (const child of panel.list) (child as Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text).setScrollFactor(0);
  }

  private transferSelectedStack(): void {
    if (this.index === 0) return;
    const stock = this.mode === 'deposit' ? this.host.pack() : this.target!.stock;
    const item = (Object.keys(ITEM_NAME) as ItemId[]).filter(id => (stock[id] ?? 0) > 0)[this.index - 1];
    if (item) this.transfer(item, true);
  }

  private page(direction: number): void {
    const pages = Math.ceil(this.rows.length / PAGE_SIZE);
    this.index = ((Math.floor(this.index / PAGE_SIZE) + direction + pages) % pages) * PAGE_SIZE;
    this.render();
  }

  updateInput(pressed: PadButtons, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    if (!this.open) return;
    if (this.openFrame) { this.openFrame = false; return; }
    const J = Phaser.Input.Keyboard.JustDown;
    if (pressed.b || pressed.lt || J(keys.h) || J(keys.esc)) { this.close(); return; }
    if (pressed.down || J(keys.down)) { this.index = (this.index + 1) % this.rows.length; this.render(); }
    if (pressed.up || J(keys.up)) { this.index = (this.index - 1 + this.rows.length) % this.rows.length; this.render(); }
    if (pressed.rb || J(keys.right)) this.page(1);
    if (pressed.lb || J(keys.left)) this.page(-1);
    if (pressed.a || J(keys.k) || J(keys.space)) { const row = this.rows[this.index]; if (row.enabled !== false) row.action(); }
    else if ((this.mode === 'deposit' || this.mode === 'withdraw') && (pressed.x || J(keys.j))) this.transferSelectedStack();
  }

  private drawFurniture(): void {
    this.art.removeAll(true);
    for (const f of this.data.furniture) {
      const g = this.scene.add.graphics({ x: f.tx * 16, y: f.ty * 16 });
      this.art.add(g);
      if (f.kind === 'bed') {
        g.fillStyle(0x624638).fillRect(0, 4, 48, 8).fillRect(0, 0, 4, 16).fillRect(44, 4, 4, 12);
        g.fillStyle(0x277b77).fillRect(5, 2, 38, 7);
        g.fillStyle(0xe2e8d3).fillRoundedRect(5, 1, 10, 6, 2);
        g.lineStyle(1, 0x68bdb0).lineBetween(17, 3, 41, 3);
      } else if (f.kind === 'chest') {
        g.fillStyle(0x573c29).fillRoundedRect(0, 0, 32, 16, 3);
        g.fillStyle(0xa37240).fillRect(2, 2, 28, 5);
        g.lineStyle(2, 0xe0b969).strokeRect(2, 1, 28, 14).lineBetween(1, 8, 31, 8);
        g.fillStyle(0xfde68a).fillRect(14, 6, 4, 5);
      } else {
        g.fillStyle(0x69717a).fillEllipse(16, 13, 32, 7);
        g.fillStyle(0x704332).fillRect(5, 10, 22, 4);
        g.fillStyle(0xf97316).fillTriangle(6, 11, 16, -12, 26, 11);
        g.fillStyle(0xfde68a).fillTriangle(11, 11, 18, -4, 22, 11);
      }
    }
    const home = this.home;
    this.marker.setVisible(!!home);
    if (home) this.marker.setPosition((home.tx + 1.5) * 16, home.ty * 16 - 8);
  }
}
