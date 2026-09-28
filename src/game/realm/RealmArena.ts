import Phaser from 'phaser';
import type { CircuitPro } from '../data/circuitRoster';
import type { PadButtons } from '../systems/gamepad';
import { BOUT_MS, COUNTDOWN_MS, PRO_RULES, boutRewards, findArenaGate, killPoints, ladder, proTarget } from './arena';
import type { HazardSpec } from './realmBosses';
import { REALM_ENEMIES, type RealmEnemyDef } from './realmEnemies';
import type { ItemId } from './items';
import type { PocketWorld } from './pocketGen';
import { grantMilestone, realmMeta, saveMeta } from './progression';
import { RealmPanel, type PanelRow } from './RealmPanel';
import type { RealmHero } from './RealmHero';
import type { World } from './worldGen';

interface ArenaHost {
  world: World;
  /** true inside the colosseum pocket */
  inside: boolean;
  player: () => { x: number; y: number };
  hero: () => RealmHero;
  occupied: (tx: number, ty: number) => boolean;
  available: () => boolean;
  pause: (open: boolean) => void;
  notify: (title: string, sub: string) => void;
  grant: (item: ItemId, count: number) => void;
  spawn: (def: RealmEnemyDef, x: number, y: number) => void;
  hazard: (spec: HazardSpec) => void;
  darken: (alpha: number | null) => void;
  clearEnemies: () => void;
  save: () => void;
}

interface Bout {
  pro: CircuitPro;
  showboat: boolean;
  target: number;
  score: number;
  kills: number;
  /** counts down: countdown first, then the bout */
  countdown: number;
  left: number;
  spawnTimer: number;
  boltTimer: number;
  savedGuard: number;
}

const FONT = 'system-ui, sans-serif';

/** The colosseum: its overworld gate, the ladder board inside, and each sixty-second bout. */
export class RealmArena {
  gate?: { tx: number; ty: number };
  bout?: Bout;
  private beaten: string[];
  private best: Record<string, number>;
  private panel: RealmPanel;
  private scene: Phaser.Scene;
  private host: ArenaHost;

  constructor(scene: Phaser.Scene, host: ArenaHost, savedGate?: { tx: number; ty: number }) {
    this.scene = scene;
    this.host = host;
    const meta = realmMeta(host.hero().snap.profile).arena;
    this.beaten = [...meta.beaten];
    this.best = { ...meta.bestScores };
    this.panel = new RealmPanel(scene, { view: () => this.view(), onClose: () => { this.panel.close(); this.host.pause(false); } });
    if (!host.inside) {
      this.gate = savedGate ?? findArenaGate(host.world, host.occupied);
      this.drawGate();
    } else {
      const pw = host.world as PocketWorld;
      const x = 9.5 * 16;
      const y = pw.arena.floorY * 16;
      const board = scene.add.graphics({ x, y }).setDepth(4);
      board.fillStyle(0x3f2a1d).fillRect(-2, -34, 4, 34).fillRect(-18, -46, 36, 20);
      board.fillStyle(0xef4444).fillRect(-16, -44, 32, 16);
      scene.add.text(x, y - 50, '🏆 THE LADDER', { fontSize: '9px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0b0714aa', padding: { x: 3, y: 1 } })
        .setOrigin(0.5, 1).setDepth(4);
    }
  }

  get open(): boolean { return this.panel.open; }
  get champion(): boolean { return this.beaten.includes('brucelee'); }

  private drawGate(): void {
    const g = this.gate!;
    const x = g.tx * 16;
    const y = (g.ty + 1) * 16;
    const art = this.scene.add.graphics({ x, y }).setDepth(3);
    art.fillStyle(0x7f1d1d).fillRect(0, -80, 8, 80).fillRect(56, -80, 8, 80);
    art.fillStyle(0xb91c1c).fillRect(-4, -92, 72, 14);
    art.fillStyle(0xfacc15).fillTriangle(8, -92, 32, -110, 56, -92);
    art.fillStyle(0x1c0a0a, 0.85).fillRect(8, -78, 48, 78);
    this.scene.add.text(x + 32, y - 114, '🏆 THE CIRCUIT ARENA', { fontSize: '10px', fontFamily: FONT, fontStyle: 'bold', color: '#fde68a', backgroundColor: '#0b0714aa', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1).setDepth(12);
  }

  nearGate(): boolean {
    const g = this.gate;
    if (!g || this.host.inside) return false;
    const p = this.host.player();
    return Math.abs((g.tx + 2) * 16 - p.x) < 34 && Math.abs((g.ty + 1) * 16 - p.y) < 40;
  }

  nearBoard(): boolean {
    if (!this.host.inside || this.bout) return false;
    const p = this.host.player();
    return Math.abs(9.5 * 16 - p.x) < 30;
  }

  prompt(): string {
    return this.nearBoard() ? '▼ / S / tap · the Circuit ladder' : '';
  }

  interact(): void {
    if (!this.nearBoard() || !this.host.available()) return;
    this.host.pause(true);
    this.panel.show(Math.min(this.beaten.length, ladder().length - 1) * 2);
  }

  hud(): string {
    const b = this.bout;
    if (!b) return this.host.inside ? `🏆 Circuit ladder ${this.beaten.length}/11${this.champion ? ' · CIRCUIT CHAMPION' : ''} · the board is by the entrance` : '';
    if (b.countdown > 0) return `🏆 ${b.pro.name} · ${PRO_RULES[b.pro.id].title} · starts in ${Math.ceil(b.countdown / 1000)}`;
    return `🏆 vs ${b.pro.name} · ⏱ ${Math.ceil(b.left / 1000)}s · ${b.score} / ${b.target}${b.score >= b.target ? ' ✓ beaten, keep going' : ''} · ${b.kills} kills${b.showboat ? ' · SHOWBOAT' : ''}`;
  }

  recordLines(): string[] {
    return [`Circuit Arena · ${this.beaten.length}/11 pros beaten${this.champion ? ' · ✦ Circuit Champion' : ''}${this.beaten.length ? ` · best vs ${ladder().filter((p) => this.best[p.id]).map((p) => `${p.name} ${this.best[p.id]}`).slice(-3).join(', ')}` : ''}`];
  }

  private view() {
    const rows: PanelRow[] = [];
    ladder().forEach((pro, i) => {
      const rule = PRO_RULES[pro.id];
      const beaten = this.beaten.includes(pro.id);
      const open = i <= this.beaten.length;
      const best = this.best[pro.id] ? ` · best ${this.best[pro.id]}` : '';
      rows.push({
        label: `${beaten ? '✓' : open ? '▸' : '🔒'} ${pro.emoji} ${pro.name} · “${rule.title}”: ${rule.blurb} · mark ${proTarget(pro.skill, false)}${best}`,
        enabled: open, color: beaten ? '#a7f3d0' : undefined, action: () => this.begin(pro, false),
      });
      rows.push({
        label: `      Showboat · mark ${proTarget(pro.skill, true)} · double rewards`,
        enabled: open, color: '#fca5a5', action: () => this.begin(pro, true),
      });
    });
    return {
      title: '🏆 THE CIRCUIT LADDER',
      subtitle: 'Sixty seconds, the pro\'s rules. Score = each kill\'s toughness × your style combo. Beat the mark. Each win opens the next pro; first wins pay a Tech Point.',
      rows, accent: 0xef4444, rowHeight: 30,
    };
  }

  private begin(pro: CircuitPro, showboat: boolean): void {
    this.panel.close();
    this.host.pause(false);
    const hero = this.host.hero();
    this.bout = { pro, showboat, target: proTarget(pro.skill, showboat), score: 0, kills: 0, countdown: COUNTDOWN_MS, left: BOUT_MS, spawnTimer: 0, boltTimer: 2000, savedGuard: hero.guard };
    const rule = PRO_RULES[pro.id];
    this.host.notify(`${pro.emoji} ${pro.name.toUpperCase()}`, `“${rule.title}” · ${rule.blurb} · mark ${this.bout.target}`);
  }

  /** the scene reports every kill during a bout */
  onKill(def: RealmEnemyDef): void {
    const b = this.bout;
    if (!b || b.countdown > 0) return;
    b.kills++;
    b.score += killPoints(def.hp, this.host.hero().comboMult);
  }

  onDeath(): void {
    if (this.bout) void this.end(false, 'you fell');
  }

  update(dt: number): void {
    const b = this.bout;
    if (!b) return;
    const rule = PRO_RULES[b.pro.id];
    const hero = this.host.hero();
    if (b.countdown > 0) {
      b.countdown -= dt;
      if (b.countdown <= 0) {
        if (rule.dark) this.host.darken(0.9);
        if (rule.noGuard) hero.guard = 0;
        if (rule.plunder) hero.timers.plunder = BOUT_MS;
      }
      return;
    }
    if (rule.noGuard) hero.guard = 0;
    b.left -= dt;
    b.spawnTimer -= dt;
    const pw = this.host.world as PocketWorld;
    if (b.spawnTimer <= 0) {
      b.spawnTimer = rule.spawnMs;
      const id = rule.enemies[Math.floor(Math.random() * rule.enemies.length)];
      const base = REALM_ENEMIES[id];
      const def = { ...base, hp: Math.round(base.hp * rule.hpMult), damage: Math.round(base.damage * rule.damageMult), speed: base.speed * rule.speedMult };
      const side = Math.random() < 0.5 ? pw.arena.x0 + 2 : pw.arena.x1 - 2;
      const flies = def.ai === 'fly';
      this.host.spawn(def, side * 16, (pw.arena.floorY - (flies ? 8 : 0)) * 16);
    }
    if (rule.bolts) {
      b.boltTimer -= dt;
      if (b.boltTimer <= 0) {
        b.boltTimer = rule.bolts;
        const p = this.host.player();
        this.host.hazard({ x: p.x + (Math.random() - 0.5) * 160, y: 5 * 16, texture: 'fx_soul', vx: 0, vy: 420, damage: 14, lifespanMs: 2200, solidStops: true });
      }
    }
    if (b.left <= 0) void this.end(b.score >= b.target, b.score >= b.target ? 'the mark is beaten' : 'time');
  }

  private async end(won: boolean, reason: string): Promise<void> {
    const b = this.bout;
    if (!b) return;
    this.bout = undefined;
    const rule = PRO_RULES[b.pro.id];
    const hero = this.host.hero();
    if (rule.dark) this.host.darken(null);
    if (rule.noGuard) hero.guard = Math.min(hero.stats.guardPips, b.savedGuard);
    if (rule.plunder) hero.timers.plunder = 0;
    this.host.clearEnemies();
    const id = b.pro.id;
    this.best[id] = Math.max(this.best[id] ?? 0, b.score);
    const lines: string[] = [`${b.score} / ${b.target} · ${b.kills} kills · ${reason}`];
    if (won) {
      const first = !this.beaten.includes(id);
      if (first) this.beaten.push(id);
      const reward = boutRewards(b.pro.skill, first, b.showboat);
      hero.gainXp(reward.xp);
      for (const [item, n] of Object.entries(reward.items)) this.host.grant(item as ItemId, n);
      lines.push(`+${reward.xp} XP · ${Object.entries(reward.items).map(([i, n]) => `${n} ${i}`).join(' · ')}`);
      if (first && (await grantMilestone(`arena:${id}`))) lines.push('+1 TECH POINT');
      await hero.bank();
      if (first && id === 'brucelee') lines.push('✦ CIRCUIT CHAMPION ✦');
    }
    await saveMeta((m) => { m.arena = { beaten: [...this.beaten], bestScores: { ...this.best } }; });
    this.host.notify(won ? `${b.pro.name.toUpperCase()} BEATEN` : `${b.pro.name.toUpperCase()} WINS`, lines.join('\n'));
    this.host.save();
  }

  updateInput(pressed: PadButtons, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    this.panel.updateInput(pressed, keys);
  }
}
