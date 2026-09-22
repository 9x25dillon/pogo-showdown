import Phaser from 'phaser';
import { CACHE_LOOT, expeditionProgress, findFoundryEntrance, trapPhase, type ExpeditionProgress } from './expeditions';
import { FOUNDRY_ROOMS, type FoundryWorld } from './foundryGen';
import { ITEM_NAME, type ItemId } from './items';
import { T } from './tiles';
import type { World } from './worldGen';
import type { PadButtons } from '../systems/gamepad';

interface ExpeditionHost {
  world: World;
  foundry: boolean;
  player: () => { x: number; y: number };
  occupied: (tx: number, ty: number) => boolean;
  tile: (tx: number, ty: number) => number;
  setTile: (tx: number, ty: number, id: number) => void;
  available: () => boolean;
  pause: (open: boolean) => void;
  save: () => void;
  notify: (title: string, detail: string) => void;
  grant: (item: ItemId, count: number) => void;
  checkpoint: (x: number, y: number) => void;
  hurt: (damage: number, x: number) => void;
  guard: (x: number, y: number) => void;
}

/** The expedition owns room props, traps, discovery, journal, and survey visuals. */
export class RealmExpedition {
  readonly progress: ExpeditionProgress;
  readonly switches = new Set<number>();
  readonly caches = new Set<number>();
  elapsed = 0;
  trapClock = 0;
  completed = false;
  panel?: Phaser.GameObjects.Container;
  oreMarks: number[] = [];
  private host: ExpeditionHost;
  private scene: Phaser.Scene;
  private props: Phaser.GameObjects.Container;
  private machinery: Phaser.GameObjects.Graphics;
  private oreGlow: Phaser.GameObjects.Graphics;
  private guardSpawns = new Set<number>();
  private room = -1;
  private surveyTimer = 0;
  private menuIndex = 0;

  constructor(scene: Phaser.Scene, host: ExpeditionHost, saved?: ExpeditionProgress) {
    this.scene = scene; this.host = host;
    this.progress = expeditionProgress(saved);
    this.props = scene.add.container(0, 0).setDepth(4);
    this.machinery = scene.add.graphics().setDepth(13);
    this.oreGlow = scene.add.graphics().setDepth(51);
    if (!host.foundry && !('pocket' in host.world)) {
      this.progress.entrance ??= findFoundryEntrance(host.world, host.occupied);
    }
    if (host.foundry) { this.progress.discovered = true; this.progress.attempts++; }
    this.drawProps();
  }

  get open(): boolean { return !!this.panel; }
  get readyForBoss(): boolean { return this.switches.size === 3; }
  get entrance(): { tx: number; ty: number } | undefined { return this.progress.entrance; }
  private get world(): FoundryWorld { return this.host.world as FoundryWorld; }
  private distance(tx: number, ty: number): number {
    const p = this.host.player(); return Math.hypot((tx + 0.5) * 16 - p.x, (ty + 1) * 16 - p.y);
  }
  nearEntrance(): boolean {
    const e = this.entrance;
    return !('pocket' in this.host.world) && !!e && this.distance(e.tx + 1, e.ty) < 40;
  }

  private nearby(): { kind: 'switch' | 'cache'; index: number } | undefined {
    if (!this.host.foundry) return;
    for (let i = 0; i < this.world.stations.length; i++) {
      const s = this.world.stations[i];
      if (!this.switches.has(i) && this.distance(s.tx, s.ty) < 38) return { kind: 'switch', index: i };
    }
    for (let i = 0; i < this.world.caches.length; i++) {
      const c = this.world.caches[i];
      if (!this.caches.has(i) && this.distance(c.tx, c.ty) < 34) return { kind: 'cache', index: i };
    }
  }

  prompt(): string {
    const target = this.nearby();
    if (!target) return '';
    return target.kind === 'switch' ? `▼ / S / tap · restore ${this.world.stations[target.index].name} regulator`
      : `▼ / S / tap · open ${this.world.caches[target.index].name}`;
  }

  interact(): void {
    if (!this.host.available()) return;
    const target = this.nearby();
    if (!target) return;
    const i = target.index;
    if (target.kind === 'switch') {
      this.switches.add(i);
      const station = this.world.stations[i];
      for (let y = 29; y < this.world.arena.floorY; y++) this.host.setTile(station.gate, y, T.AIR);
      this.host.checkpoint((station.tx + 0.5) * 16, (station.ty + 1) * 16);
      this.host.notify('PRESSURE RESTORED', `${this.switches.size}/3 regulators · checkpoint secured · +25 health`);
    } else {
      this.caches.add(i); this.progress.cachesOpened++;
      for (const [item, count] of Object.entries(CACHE_LOOT[i])) this.host.grant(item as ItemId, count);
      this.host.notify(this.world.caches[i].name.toUpperCase(), Object.entries(CACHE_LOOT[i]).map(([item, count]) => `${count} ${ITEM_NAME[item as ItemId]}`).join(' · '));
    }
    this.drawProps(); this.host.save();
  }

  victory(): void {
    if (this.completed) return;
    this.completed = true;
    const first = this.progress.clears === 0;
    this.progress.clears++;
    this.progress.bestMs = Math.min(this.progress.bestMs ?? Infinity, this.elapsed);
    this.progress.lantern = true;
    if (first) { this.progress.lanternEnabled = true; this.host.grant('wardenCore', 1); }
    this.host.notify(first ? 'THE SURVEY LANTERN IS YOURS' : 'FOUNDRY EXPEDITION COMPLETE',
      first ? 'Nearby ore now shines through stone. Bring the Warden Core trophy home.' : 'Iron salvaged · return through the portal, or explore the galleries.');
    this.host.save();
  }

  objective(): string {
    if (this.host.foundry) return this.completed ? 'Foundry cleared · return through the portal'
      : this.readyForBoss ? 'Find and defeat the Clockwork Warden' : `Foundry · restore regulators ${this.switches.size}/3 · caches ${this.caches.size}/3`;
    if (!this.progress.discovered) return 'Lost Ruins · a brass arch lies west of spawn · N / R3 journal';
    if (this.progress.clears) return `Survey Lantern ${this.progress.lanternEnabled ? 'ON' : 'OFF'} · N / R3 journal`;
    if (!this.entrance || 'pocket' in this.host.world) return 'Buried Foundry discovered · return to the overworld to explore';
    const dx = (this.entrance.tx + 1.5) * 16 - this.host.player().x;
    return `Buried Foundry ${dx < 0 ? '←' : '→'} ${Math.round(this.distance(this.entrance.tx + 1, this.entrance.ty) / 16)} m · N / R3 journal`;
  }

  update(dt: number): void {
    if (!this.host.available() || this.open) return;
    const p = this.host.player();
    if (!this.host.foundry && !('pocket' in this.host.world) && this.entrance && !this.progress.discovered && this.distance(this.entrance.tx + 1, this.entrance.ty) < 200) {
      this.progress.discovered = true;
      this.host.notify('LOST RUIN DISCOVERED', 'The Buried Foundry · marked on your map · N / R3 opens your expedition journal');
      this.host.save();
    }
    if (this.host.foundry) {
      if (!this.completed) this.elapsed += dt;
      this.trapClock += dt;
      const room = FOUNDRY_ROOMS.findIndex(r => p.x / 16 >= r.x0 && p.x / 16 < r.x1);
      if (room >= 0 && room !== this.room) {
        this.room = room; this.host.notify(FOUNDRY_ROOMS[room].name, FOUNDRY_ROOMS[room].detail);
      }
      this.world.guards.forEach((guard, i) => {
        if (!this.guardSpawns.has(i) && this.distance(guard.tx, guard.ty) < 460) {
          this.guardSpawns.add(i); this.host.guard((guard.tx + 0.5) * 16, (guard.ty + 1) * 16);
        }
      });
      this.drawTraps();
    }
    this.surveyTimer -= dt;
    if (this.surveyTimer <= 0) { this.surveyTimer = 250; this.drawSurvey(); }
  }

  private drawTraps(): void {
    const g = this.machinery.clear();
    const p = this.host.player();
    for (const trap of this.world.traps) {
      const x = trap.tx * 16, floor = (trap.ty + 1) * 16;
      if (Math.abs(x - p.x) > 650) continue;
      const phase = trapPhase(this.trapClock, trap.offset);
      const color = phase === 'active' ? 0xf97316 : phase === 'warning' ? 0xfbbf24 : 0x426577;
      g.fillStyle(0x182b34).fillRect(x, floor - 5, 32, 5);
      g.lineStyle(2, color).lineBetween(x + 3, floor - 3, x + 29, floor - 3);
      if (trap.kind === 'press') {
        g.fillStyle(0x617782).fillRect(x + 12, floor - 150, 8, phase === 'active' ? 136 : 44);
        g.fillStyle(color).fillRect(x - 4, phase === 'active' ? floor - 25 : floor - 110, 40, 21);
      }
      if (phase === 'warning') {
        g.fillStyle(0xfbbf24, 0.2 + Math.sin(this.trapClock / 80) * 0.1).fillRect(x, floor - 60, 32, 58);
      } else if (phase === 'active') {
        if (trap.kind === 'steam') for (let n = 0; n < 4; n++) {
          g.fillStyle(n % 2 ? 0xfed7aa : 0xcbd5e1, 0.45).fillEllipse(x + 16 + Math.sin(this.trapClock / 90 + n) * 5, floor - 10 - n * 16, 20 + n * 4, 24);
        }
        if (p.x + 8 > x && p.x - 8 < x + 32 && p.y > floor - 62 && p.y - 40 < floor) this.host.hurt(trap.kind === 'press' ? 22 : 12, x + 16);
      }
    }
  }

  private drawSurvey(): void {
    this.oreGlow.clear(); this.oreMarks = [];
    if (!this.progress.lantern || !this.progress.lanternEnabled) return;
    const p = this.host.player(), cx = Math.floor(p.x / 16), cy = Math.floor((p.y - 20) / 16);
    for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
      if (dx * dx + dy * dy > 144) continue;
      const id = this.host.tile(cx + dx, cy + dy);
      const color = id === T.COPPER ? 0xfb923c : id === T.IRON ? 0xcffafe : id === T.SOULSTONE ? 0xfb7185 : 0;
      if (!color) continue;
      this.oreMarks.push((cy + dy) * this.host.world.w + cx + dx);
      this.oreGlow.fillStyle(color, 0.18).fillRect((cx + dx) * 16, (cy + dy) * 16, 16, 16);
      this.oreGlow.lineStyle(1, color, 0.85).strokeRect((cx + dx) * 16 + 1, (cy + dy) * 16 + 1, 14, 14);
    }
  }

  toggleJournal(): void {
    if (this.open) { this.close(); return; }
    if (!this.host.available()) return;
    this.menuIndex = 0; this.host.pause(true); this.renderJournal();
  }
  close(): void { this.panel?.destroy(); this.panel = undefined; this.host.pause(false); }
  private journalAction(): void {
    if (this.menuIndex === 0 && this.progress.lantern) {
      this.progress.lanternEnabled = !this.progress.lanternEnabled;
      this.drawSurvey(); this.host.save(); this.renderJournal();
    } else if (this.menuIndex === 1) this.close();
  }
  updateInput(pressed: PadButtons, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    const J = Phaser.Input.Keyboard.JustDown;
    if (pressed.b || pressed.r3 || J(keys.n) || J(keys.esc)) { this.close(); return; }
    if (pressed.down || pressed.up || J(keys.up) || J(keys.down)) { this.menuIndex = 1 - this.menuIndex; this.renderJournal(); }
    if (pressed.a || J(keys.k) || J(keys.space)) this.journalAction();
  }

  private renderJournal(): void {
    this.panel?.destroy();
    const panel = this.scene.add.container(480, 270).setDepth(88).setScrollFactor(0); this.panel = panel;
    const text = (x: number, y: number, label: string, size = 14, color = '#d2dfe4') => {
      const t = this.scene.add.text(x, y, label, { fontFamily: 'system-ui, sans-serif', fontSize: `${size}px`, color, lineSpacing: 7, wordWrap: { width: 630 } }).setScrollFactor(0); panel.add(t); return t;
    };
    panel.add(this.scene.add.rectangle(0, 0, 960, 540, 0x030912, 0.75).setScrollFactor(0).setInteractive());
    panel.add(this.scene.add.rectangle(0, 0, 716, 484, 0x12232d).setStrokeStyle(2, 0xb18c52));
    text(-324, -217, 'LOST RUINS', 25, '#f9d68c');
    text(-324, -181, 'EXPEDITION JOURNAL / 01', 11, '#91adb7');
    text(-324, -148, 'THE BURIED FOUNDRY', 19, '#ffffff');
    text(-324, -116, this.objective(), 13, '#f9d68c');
    const steps = [
      [this.progress.discovered, 'Find the brass arch west of the overworld spawn.'],
      [this.readyForBoss || this.progress.clears > 0, 'Restore three pressure regulators. Each secures a checkpoint.'],
      [this.progress.clears > 0, 'Defeat the Clockwork Warden. Strike its blue, venting core.'],
      [this.progress.lantern, 'Claim the Survey Lantern and bring the Warden Core home.'],
    ] as const;
    steps.forEach(([done, label], i) => text(-324, -75 + i * 29, `${done ? '✓' : '○'}  ${label}`, 13, done ? '#8de8d1' : '#d2dfe4'));
    text(-324, 58, `${this.progress.clears} clears · ${this.progress.cachesOpened} caches recovered${this.progress.bestMs ? ` · best ${Math.floor(this.progress.bestMs / 60000)}:${Math.floor(this.progress.bestMs / 1000 % 60).toString().padStart(2, '0')}` : ''}`, 12, '#91adb7');
    text(-324, 88, 'Pack healing draughts; a copper blade helps. Amber warns of steam and presses.\nUpper galleries hide three supply caches. The entrance portal always leads out.', 12);
    const buttons = [this.progress.lantern ? `Survey Lantern: ${this.progress.lanternEnabled ? 'ON' : 'OFF'} · reveal ore within 12 tiles` : 'Survey Lantern locked · defeat the Clockwork Warden', 'Close journal'];
    buttons.forEach((label, i) => {
      const b = this.scene.add.rectangle(0, 157 + i * 43, 648, 34, this.menuIndex === i ? 0x37515a : 0x1c343f)
        .setStrokeStyle(1, this.menuIndex === i ? 0xf9d68c : 0x48616b).setScrollFactor(0).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { this.menuIndex = i; this.journalAction(); }); panel.add(b);
      text(-308, 148 + i * 43, label, 12, i === 0 && !this.progress.lantern ? '#91adb7' : '#ffffff');
    });
    text(-324, 225, '↑ ↓ choose · A select · N / R3 / B / Esc close', 10, '#91adb7');
  }

  private drawProps(): void {
    this.props.removeAll(true);
    const g = this.scene.add.graphics(); this.props.add(g);
    if (!this.host.foundry) {
      if ('pocket' in this.host.world || !this.entrance) return;
      const x = this.entrance.tx * 16, floor = (this.entrance.ty + 1) * 16;
      g.fillStyle(0x142732, 0.95).fillRoundedRect(x, floor - 66, 48, 66, 20);
      g.lineStyle(5, 0xb58d4e).strokeRoundedRect(x + 2, floor - 64, 44, 63, 18);
      g.lineStyle(2, 0x5fd6d9).strokeCircle(x + 24, floor - 38, 12);
      for (let i = 0; i < 4; i++) g.lineStyle(2, 0xb58d4e).lineBetween(x + 12 + i * 8, floor - 22, x + 12 + i * 8, floor - 2);
      const label = this.scene.add.text(x + 24, floor - 84, 'BURIED FOUNDRY', { fontSize: '11px', fontFamily: 'system-ui, sans-serif', color: '#f9d68c', backgroundColor: '#12232d' }).setOrigin(0.5, 1);
      this.props.add(label); return;
    }
    // Background pipes and supports tie the machinery rooms together.
    for (let x = 18; x < this.world.w - 8; x += 16) {
      g.lineStyle(3, 0x46616a, 0.65).lineBetween(x * 16, 31 * 16, x * 16, 47 * 16);
      g.lineStyle(3, 0x946d3b, 0.6).lineBetween(x * 16, 33 * 16, (x + 16) * 16, 33 * 16);
    }
    this.world.stations.forEach((s, i) => {
      const x = s.tx * 16, y = s.ty * 16;
      g.fillStyle(0x263b46).fillRect(x - 8, y - 27, 32, 43);
      g.lineStyle(3, this.switches.has(i) ? 0x6ee7b7 : 0xfbbf24).strokeCircle(x + 8, y - 10, 13);
      g.lineStyle(3, 0xe5b55c).lineBetween(x - 1, y - 19, x + 17, y - 1).lineBetween(x + 17, y - 19, x - 1, y - 1);
      const t = this.scene.add.text(x + 8, y - 47, this.switches.has(i) ? '✓ CHECKPOINT' : `${s.name.toUpperCase()} REGULATOR`, { fontSize: '10px', color: '#f9d68c', backgroundColor: '#12232d' }).setOrigin(0.5);
      this.props.add(t);
    });
    this.world.caches.forEach((c, i) => {
      const x = c.tx * 16, y = c.ty * 16;
      g.fillStyle(this.caches.has(i) ? 0x33434b : 0x9a713d).fillRoundedRect(x - 8, y - 6, 32, 22, 3);
      g.lineStyle(2, this.caches.has(i) ? 0x617782 : 0xf9d68c).strokeRect(x - 7, y - 5, 30, 20);
      g.fillStyle(this.caches.has(i) ? 0x263b46 : 0x67e8f9).fillRect(x + 5, y + 1, 5, 6);
    });
  }
}
