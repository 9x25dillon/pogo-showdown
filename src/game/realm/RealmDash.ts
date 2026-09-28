import Phaser from 'phaser';
import type { DashRecord } from '../db/schema';
import type { PadButtons } from '../systems/gamepad';
import { MEDALS, MEDAL_REWARDS, POGO_RANKS, STOMP_POINTS, TIME_LIMIT_PARS, medalFor, planCourses, pogoRank, scoreRun, type DashCourse } from './dash';
import type { ItemId } from './items';
import { grantMilestone, realmMeta, saveMeta } from './progression';
import { RealmPanel, type PanelRow } from './RealmPanel';
import type { RealmHero } from './RealmHero';
import type { World } from './worldGen';

interface DashHost {
  world: World;
  player: () => { x: number; y: number };
  hero: () => RealmHero;
  night: () => boolean;
  riding: () => boolean;
  available: () => boolean;
  pause: (open: boolean) => void;
  notify: (title: string, sub: string) => void;
  grant: (item: ItemId, count: number) => void;
  save: () => void;
}

interface Run {
  course: DashCourse;
  hardcore: boolean;
  t: number;
  next: number;
  stars: Set<number>;
  stompPoints: number;
}

const FONT = 'system-ui, sans-serif';

/** Dash Trial start posts, their gates and stars, the run timer and medals. */
export class RealmDash {
  readonly courses: DashCourse[];
  run?: Run;
  private records: Record<string, DashRecord>;
  private gfx: Phaser.GameObjects.Graphics;
  private panel: RealmPanel;
  private target?: DashCourse;
  private host: DashHost;

  constructor(scene: Phaser.Scene, host: DashHost) {
    this.host = host;
    this.courses = planCourses(host.world);
    this.records = { ...realmMeta(host.hero().snap.profile).dash };
    this.gfx = scene.add.graphics().setDepth(7);
    this.panel = new RealmPanel(scene, { view: () => this.view(), onClose: () => { this.panel.close(); this.host.pause(false); } });
    for (const c of this.courses) {
      const post = scene.add.graphics({ x: c.start.x, y: c.start.y }).setDepth(4);
      post.fillStyle(0x78716c).fillRect(-1, -40, 3, 40);
      post.fillStyle(c.night ? 0x818cf8 : 0xfacc15).fillTriangle(2, -40, 20, -34, 2, -28);
      scene.add.text(c.start.x, c.start.y - 44, `🏁 ${c.name}`, { fontSize: '9px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0b0714aa', padding: { x: 3, y: 1 } })
        .setOrigin(0.5, 1).setDepth(4);
    }
  }

  get open(): boolean { return this.panel.open; }

  totalBest(): number {
    return Object.values(this.records).reduce((n, r) => n + r.best, 0);
  }

  recordLines(): string[] {
    const rank = pogoRank(this.totalBest());
    return [
      `Pogo Rank · ${POGO_RANKS[rank].name} (${this.totalBest()} pts${rank < POGO_RANKS.length - 1 ? `, next at ${POGO_RANKS[rank + 1].points}` : ''})`,
      ...this.courses.map((c) => { const r = this.records[c.id]; return `  🏁 ${c.name} · best ${r?.best ?? 0} · ${MEDALS[r?.medal ?? 0] || 'no medal'}`; }),
    ];
  }

  nearby(): DashCourse | undefined {
    if (this.run) return undefined;
    const p = this.host.player();
    return this.courses.find((c) => Math.abs(c.start.x - p.x) < 28 && Math.abs(c.start.y - p.y) < 48);
  }

  prompt(): string {
    const c = this.nearby();
    if (!c) return '';
    const r = this.records[c.id];
    return `▼ / S / tap · 🏁 ${c.name}${r ? ` · best ${r.best} ${MEDALS[r.medal]}` : ''}`;
  }

  hud(): string {
    const r = this.run;
    if (!r) return '';
    const limit = r.course.par * TIME_LIMIT_PARS;
    return `🏁 ${r.course.name} · ⏱ ${(r.t / 1000).toFixed(1)}s / par ${r.course.par}s · gate ${r.next}/${r.course.gates.length} · ★ ${r.stars.size}${r.hardcore ? ' · HARDCORE' : ''}${r.t / 1000 > limit - 5 ? ' · HURRY' : ''}`;
  }

  interact(): void {
    const c = this.nearby();
    if (!c || !this.host.available()) return;
    this.target = c;
    this.host.pause(true);
    this.panel.show();
  }

  private view() {
    const c = this.target!;
    const r = this.records[c.id];
    const locked = c.night && !this.host.night();
    const rows: PanelRow[] = locked ? [{ label: 'The Night Circuit only runs after dusk. Come back when the moon is up.', enabled: false }] : [
      { label: `Run it · ${c.gates.length} gates · par ${c.par}s${this.host.riding() ? '' : ' · tip: ride your pogo stick'}`, action: () => this.begin(c, false) },
      { label: `Hardcore · one hit ends the run · ×1.5 score`, color: '#fca5a5', action: () => this.begin(c, true) },
    ];
    const rewards = c.medals.map((points, i) => `${MEDALS[i + 1]} ${points}+`).join(' · ');
    rows.push({ label: `Medals · ${rewards}`, enabled: false });
    rows.push({ label: `First medal of each kind pays materials + XP · first 🥇 pays a Tech Point`, enabled: false });
    return {
      title: `🏁 ${c.name.toUpperCase()}`,
      subtitle: `${c.blurb} · best ${r?.best ?? 0} ${r ? MEDALS[r.medal] : ''} · gate 100 · star 40 · stomp 25×chain · 25/s under par`,
      rows, accent: c.night ? 0x818cf8 : 0xfacc15,
    };
  }

  private begin(course: DashCourse, hardcore: boolean): void {
    this.panel.close();
    this.host.pause(false);
    this.run = { course, hardcore, t: 0, next: 0, stars: new Set(), stompPoints: 0 };
    this.host.notify(`🏁 ${course.name.toUpperCase()}`, `GO! · ${course.gates.length} gates · par ${course.par}s${hardcore ? ' · hardcore' : ''}`);
  }

  /** a stomp while running (from the pogo stick): chain is the stomps since last touching ground */
  stomped(chain: number): void {
    if (this.run) this.run.stompPoints += STOMP_POINTS * chain;
  }

  /** taking a hit ends a hardcore run */
  hurt(): void {
    if (this.run?.hardcore) this.fail('one hit, hardcore over');
  }

  fail(reason: string): void {
    if (!this.run) return;
    this.host.notify('RUN OVER', `${this.run.course.name} · ${reason}`);
    this.run = undefined;
  }

  update(dt: number): void {
    const r = this.run;
    this.draw();
    if (!r) return;
    r.t += dt;
    const p = this.host.player();
    const at = { x: p.x, y: p.y - 22 };
    r.course.stars.forEach((s, i) => { if (!r.stars.has(i) && Math.hypot(s.x - at.x, s.y - at.y) < 26) r.stars.add(i); });
    const g = r.course.gates[r.next];
    if (g && Math.abs(g.x - at.x) < 26 && Math.abs(g.y - at.y) < 38) {
      r.next++;
      if (r.next >= r.course.gates.length) { void this.finish(); return; }
    }
    if (r.t / 1000 > r.course.par * TIME_LIMIT_PARS) this.fail('out of time');
  }

  private async finish(): Promise<void> {
    const r = this.run!;
    this.run = undefined;
    const c = r.course;
    const seconds = r.t / 1000;
    const score = scoreRun(c, { gates: c.gates.length, stars: r.stars.size, stompPoints: r.stompPoints, seconds, hardcore: r.hardcore });
    const medal = medalFor(c, score);
    const before = this.records[c.id] ?? { best: 0, medal: 0 };
    const rankBefore = pogoRank(this.totalBest());
    const rec = { best: Math.max(before.best, score), medal: Math.max(before.medal, medal) };
    this.records[c.id] = rec;
    const hero = this.host.hero();
    const lines = [`${score} pts · ${seconds.toFixed(1)}s · ★ ${r.stars.size}/${c.stars.length}${medal ? ` · ${MEDALS[medal]}` : ''}${score > before.best ? ' · NEW BEST' : ''}`];
    for (let m = before.medal + 1; m <= medal; m++) {
      const reward = MEDAL_REWARDS[m];
      hero.gainXp(reward.xp);
      for (const [item, n] of Object.entries(reward.items)) this.host.grant(item as ItemId, n);
      lines.push(`first ${MEDALS[m]}: +${reward.xp} XP`);
    }
    if (medal === 3 && (await grantMilestone(`dash:${c.id}:gold`))) lines.push('+1 TECH POINT');
    const rankAfter = pogoRank(this.totalBest());
    for (let k = rankBefore + 1; k <= rankAfter; k++) {
      if (await grantMilestone(`pogorank:${k}`)) lines.push(`POGO RANK: ${POGO_RANKS[k].name.toUpperCase()} · +1 TECH POINT`);
    }
    await saveMeta((m) => { m.dash[c.id] = rec; });
    this.host.notify(`🏁 ${c.name.toUpperCase()} CLEAR`, lines.join('\n'));
    this.host.save();
  }

  private draw(): void {
    const g = this.gfx.clear();
    const r = this.run;
    for (const c of this.courses) {
      const active = r?.course === c;
      c.gates.forEach((gate, i) => {
        if (active && i < r!.next) return;
        const next = active && i === r!.next;
        const alpha = active ? (next ? 0.95 : 0.55) : 0.18;
        g.lineStyle(next ? 4 : 2, next ? 0xfacc15 : c.night ? 0x818cf8 : 0xfef08a, alpha).strokeEllipse(gate.x, gate.y, 26, 58);
      });
      if (!active) continue;
      c.stars.forEach((s, i) => {
        if (r!.stars.has(i)) return;
        g.fillStyle(0xfde047, 0.95).fillCircle(s.x, s.y, 6);
        g.fillStyle(0xffffff, 0.9).fillCircle(s.x - 2, s.y - 2, 2);
      });
    }
  }

  updateInput(pressed: PadButtons, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    this.panel.updateInput(pressed, keys);
  }
}
