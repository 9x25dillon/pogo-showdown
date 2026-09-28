import Phaser from 'phaser';
import { INPUT_GLYPH, type TrickDef, type TrickInput } from '../data/tricks';
import type { RealmHero } from './RealmHero';
import { CHAIN_CAP, CHAIN_MS, CHAIN_STEP, STRINGS, STRING_REGEN_MS, TANGLE_MS, TRICK_EFFECTS, YOYOS, matchTrick, trickWindow, tricksFor, type TrickEffect } from './yoyo';

export interface YoyoTarget {
  sprite: Phaser.Physics.Arcade.Sprite;
  timer: number;
}

interface YoyoHost {
  player: () => Phaser.Physics.Arcade.Sprite;
  facing: () => 1 | -1;
  aimPoint: () => { x: number; y: number } | null;
  hero: () => RealmHero;
  maxHp: () => number;
  enemies: () => YoyoTarget[];
  hurtEnemy: (e: YoyoTarget, damage: number, dir: number, crit: boolean) => void;
  boss: () => Phaser.Physics.Arcade.Sprite | undefined;
  damageBoss: (damage: number, crit: boolean) => number;
  solidAt: (x: number, y: number) => boolean;
  invuln: (ms: number) => void;
  heal: (hp: number) => void;
  launch: (vy: number) => void;
  bounceStomp: (vy: number, damage: number) => void;
  dash: (dx: number) => void;
  float: (x: number, y: number, text: string, color: string) => void;
  shake: (ms: number, intensity: number) => void;
}

/** one yoyo in flight; returns false when done */
type Behavior = { pos: { x: number; y: number }; tick: (dt: number) => boolean };

/** The equipped yoyo: throws, the trick buffer, strings, chains and every trick's effect. */
export class RealmYoyo {
  tier: number;
  strings = STRINGS;
  tangle = 0;
  chain = 0;
  buffer: TrickInput[] = [];
  /** seconds left to enter the next input; 0 = no trick window open */
  window = 0;
  private chainTimer = 0;
  private regen = 0;
  private cooldown = 0;
  private flights: Behavior[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private host: YoyoHost;

  constructor(scene: Phaser.Scene, host: YoyoHost, tier: number) {
    this.scene = scene;
    this.host = host;
    this.tier = tier;
    this.gfx = scene.add.graphics().setDepth(11);
  }

  get def() { return YOYOS[this.tier]; }
  get known(): TrickDef[] { return tricksFor(this.tier); }
  get chainBonus(): number { return Math.min(CHAIN_CAP, this.chain * CHAIN_STEP); }

  /** the use button: throw, or ● inside an open trick window */
  use(): void {
    if (this.tier === 0) return;
    if (this.window > 0) { this.input('tap'); return; }
    if (this.tangle > 0 || this.cooldown > 0) return;
    this.cooldown = 380;
    this.throwAt(this.target(this.def.reach), 1);
    this.buffer = [];
    this.window = trickWindow(this.chain, this.host.hero().stats.trickWindowMult);
  }

  input(dir: TrickInput): void {
    if (this.window <= 0 || this.tangle > 0) return;
    this.buffer.push(dir);
    const m = matchTrick(this.buffer, this.known);
    if (m.status === 'fumble') this.fumble();
    else if (m.status === 'ready' && m.final) this.fire(m.trick);
    else this.window = trickWindow(this.chain, this.host.hero().stats.trickWindowMult);
  }

  /** HUD line: strings, chain, and the live buffer with what it could become */
  status(): string {
    if (this.tier === 0) return '';
    const strings = `🪀 ${'│'.repeat(this.strings)}${'·'.repeat(STRINGS - this.strings)}`;
    if (this.tangle > 0) return `${strings}  TANGLED ${Math.ceil(this.tangle / 1000)}s`;
    const chain = this.chain > 0 ? `  chain ×${this.chain} +${Math.round(this.chainBonus * 100)}%` : '';
    if (this.window <= 0) return strings + chain;
    const typed = this.buffer.map((i) => INPUT_GLYPH[i]).join('');
    const next = this.known.filter((t) => this.buffer.every((b, i) => t.sequence[i] === b)).slice(0, 4)
      .map((t) => `${t.name} ${t.sequence.map((i) => INPUT_GLYPH[i]).join('')}`).join(' · ');
    return `${strings}${chain}  ▸ ${typed || '…'}  ${next}`;
  }

  private target(reach: number): { x: number; y: number } {
    const p = this.host.player();
    const from = { x: p.x, y: p.y - 24 };
    const aim = this.host.aimPoint();
    const angle = aim && Math.hypot(aim.x - from.x, aim.y - from.y) > 20 ? Math.atan2(aim.y - from.y, aim.x - from.x) : (this.host.facing() > 0 ? 0 : Math.PI);
    return { x: from.x + Math.cos(angle) * reach, y: from.y + Math.sin(angle) * reach };
  }

  private fumble(): void {
    this.window = 0;
    this.buffer = [];
    this.chain = 0;
    this.snap();
  }

  private snap(): void {
    this.strings--;
    this.regen = 0;
    const p = this.host.player();
    this.host.float(p.x, p.y - 64, this.strings > 0 ? 'STRING SNAPPED' : 'TANGLED!', '#fb7185');
    if (this.strings <= 0) { this.tangle = TANGLE_MS; this.strings = 0; }
  }

  private fire(trick: TrickDef): void {
    this.window = 0;
    this.buffer = [];
    const hero = this.host.hero();
    const len = trick.sequence.length;
    const entry = TRICK_EFFECTS[trick.name];
    const p = this.host.player();
    this.host.float(p.x, p.y - 70, `${trick.name.toUpperCase()}${this.chain > 0 ? ` ×${this.chain + 1}` : ''}`, '#5eead4');
    if (entry) this.apply(entry.effect);
    this.chain++;
    this.chainTimer = CHAIN_MS;
    for (let i = 0; i < len; i++) hero.hitLanded();
    hero.gainXp(len * 2);
  }

  /** one blow from the yoyo: tier damage × effect × chain bonus, then hero crit/combo/level */
  private strike(mult: number): { damage: number; crit: boolean } {
    return this.host.hero().strike(this.def.damage * mult * (1 + this.chainBonus));
  }

  /** hit everything within `r` of a point once; returns how many */
  private hitAround(x: number, y: number, r: number, mult: number, knock = 0, skip?: Set<unknown>): number {
    let n = 0;
    const within = (s: Phaser.Physics.Arcade.Sprite) => {
      const b = s.body as Phaser.Physics.Arcade.Body;
      return Math.hypot(b.center.x - x, b.center.y - y) <= r + Math.max(b.width, b.height) / 2;
    };
    for (const e of [...this.host.enemies()]) {
      if (skip?.has(e) || !within(e.sprite)) continue;
      skip?.add(e);
      const { damage, crit } = this.strike(mult);
      const dir = e.sprite.x < this.host.player().x ? -1 : 1;
      this.host.hurtEnemy(e, damage, dir, crit);
      if (knock && e.sprite.active) (e.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(dir * knock, -knock * 0.6);
      n++;
    }
    const boss = this.host.boss();
    if (boss && !skip?.has(boss) && within(boss)) {
      skip?.add(boss);
      const { damage, crit } = this.strike(mult);
      if (this.host.damageBoss(damage, crit) > 0) n++;
    }
    return n;
  }

  private throwAt(to: { x: number; y: number }, mult: number): void {
    const p = this.host.player();
    const from = { x: p.x, y: p.y - 24 };
    const hit = new Set<unknown>();
    let t = 0;
    const pos = { ...from };
    this.flights.push({ pos, tick: (dt) => {
      t += dt;
      const out = t < 180 ? t / 180 : Math.max(0, 1 - (t - 180) / 180);
      const hand = { x: this.host.player().x, y: this.host.player().y - 24 };
      pos.x = hand.x + (to.x - from.x) * out;
      pos.y = hand.y + (to.y - from.y) * out;
      this.hitAround(pos.x, pos.y, 14, mult, 0, hit);
      return t < 360;
    } });
  }

  private shot(angle: number, mult: number, pierce: number, range: number): void {
    const p = this.host.player();
    const pos = { x: p.x, y: p.y - 24 };
    const hit = new Set<unknown>();
    let travelled = 0;
    let left = pierce;
    this.flights.push({ pos, tick: (dt) => {
      const d = (dt / 1000) * 720;
      travelled += d;
      pos.x += Math.cos(angle) * d;
      pos.y += Math.sin(angle) * d;
      left -= this.hitAround(pos.x, pos.y, 16, mult, 160, hit);
      return travelled < range && left > 0 && !this.host.solidAt(pos.x, pos.y);
    } });
  }

  private apply(e: TrickEffect): void {
    const p = this.host.player();
    const facing = this.host.facing();
    const aimAngle = (() => { const t = this.target(1); return Math.atan2(t.y - (p.y - 24), t.x - p.x); })();
    switch (e.kind) {
      case 'spin': {
        const at = this.target(this.def.reach * 0.8);
        let t = 0;
        let next = 0;
        this.flights.push({ pos: at, tick: (dt) => {
          t += dt; next -= dt;
          if (next <= 0) { next = 330; this.hitAround(at.x, at.y, 28, e.mult); }
          return t < e.ms;
        } });
        break;
      }
      case 'shot': this.shot(aimAngle, e.mult, e.pierce, e.range); break;
      case 'star': for (let i = 0; i < 4; i++) this.shot((i * Math.PI) / 2, e.mult, 3, e.range); break;
      case 'pull':
        for (const t of this.host.enemies()) {
          const dx = p.x - t.sprite.x;
          const dy = p.y - 20 - t.sprite.y;
          const d = Math.hypot(dx, dy);
          if (d > e.radius || d < 1) continue;
          (t.sprite.body as Phaser.Physics.Arcade.Body).setVelocity((dx / d) * 420, (dy / d) * 420 - 60);
          t.timer = Math.max(t.timer, e.stunMs);
        }
        break;
      case 'sweep': this.hitAround(p.x, p.y - 20, e.radius, e.mult, 420); this.host.shake(90, 0.004); break;
      case 'roll': {
        const pos = { x: p.x, y: p.y - 8 };
        const hit = new Set<unknown>();
        let travelled = 0;
        this.flights.push({ pos, tick: (dt) => {
          const d = (dt / 1000) * 460;
          travelled += d;
          pos.x += facing * d;
          this.hitAround(pos.x, pos.y, 20, e.mult, 200, hit);
          return travelled < e.range && !this.host.solidAt(pos.x, pos.y - 4);
        } });
        break;
      }
      case 'orbit':
      case 'kwyjibo': {
        const ms = e.ms;
        const radius = e.kind === 'orbit' ? e.radius : 80;
        // each target at most once per 400ms as the yoyo sweeps past
        const hit = new Set<unknown>();
        let reset = 0;
        let t = 0;
        const pos = { x: p.x, y: p.y };
        this.flights.push({ pos, tick: (dt) => {
          t += dt;
          reset -= dt;
          if (reset <= 0) { reset = 400; hit.clear(); }
          const pl = this.host.player();
          pos.x = pl.x + Math.cos(t / 140) * radius;
          pos.y = pl.y - 24 + Math.sin(t / 140) * radius * 0.7;
          this.hitAround(pos.x, pos.y, 22, e.mult, 0, hit);
          return t < ms;
        } });
        if (e.kind === 'kwyjibo') {
          this.host.heal(this.host.maxHp() * 0.1);
          for (let i = 0; i < 5; i++) this.host.hero().hitLanded();
        }
        break;
      }
      case 'shield': this.host.invuln(e.ms); break;
      case 'lift': this.host.launch(e.scale); break;
      case 'multi': {
        const at = this.target(this.def.reach * 0.8);
        for (let i = 0; i < e.hits; i++) this.scene.time.delayedCall(i * 120, () => this.hitAround(at.x, at.y, 30, e.mult));
        this.throwAt(at, 0);
        break;
      }
      case 'stun':
        for (const t of this.host.enemies()) {
          if (Math.hypot(t.sprite.x - p.x, t.sprite.y - p.y) > e.radius) continue;
          t.timer = Math.max(t.timer, e.ms);
          (t.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
          t.sprite.setTint(0xc4b5fd);
          this.scene.time.delayedCall(e.ms, () => { if (t.sprite.active) t.sprite.clearTint(); });
        }
        break;
      case 'gamble': {
        const at = this.target(this.def.reach * 0.7);
        if (Math.random() < 0.5) {
          this.hitAround(at.x, at.y, 60, e.mult, 300);
          this.host.float(at.x, at.y - 20, 'DOUBLE!', '#fde047');
          this.host.shake(160, 0.008);
        } else {
          this.hitAround(at.x, at.y, 40, 1);
          this.host.float(at.x, at.y - 20, 'NOTHING', '#fb7185');
          this.snap();
        }
        this.throwAt(at, 0);
        break;
      }
      case 'dash': {
        const x0 = p.x;
        this.host.invuln(450);
        this.host.dash(facing * e.distance);
        const lo = Math.min(x0, x0 + facing * e.distance);
        const hi = Math.max(x0, x0 + facing * e.distance);
        for (const t of [...this.host.enemies()]) {
          if (t.sprite.x < lo - 10 || t.sprite.x > hi + 10 || Math.abs(t.sprite.y - p.y) > 50) continue;
          const { damage, crit } = this.strike(e.mult);
          this.host.hurtEnemy(t, damage, facing, crit);
        }
        break;
      }
      case 'mend': {
        const hero = this.host.hero();
        this.host.heal(this.host.maxHp() * e.healPct);
        if (hero.guard < hero.stats.guardPips) hero.guard++;
        break;
      }
      case 'bounce': this.host.bounceStomp(1.7, this.def.damage * e.mult * (1 + this.chainBonus)); break;
      case 'blast': {
        const at = e.radius >= 200 ? { x: p.x, y: p.y - 20 } : this.target(this.def.reach * 0.8);
        this.hitAround(at.x, at.y, e.radius, e.mult, 360);
        const ring = this.scene.add.circle(at.x, at.y, 10, 0x5eead4, 0.5).setDepth(12);
        this.scene.tweens.add({ targets: ring, scale: e.radius / 10, alpha: 0, duration: 360, onComplete: () => ring.destroy() });
        this.host.shake(220, 0.01);
        break;
      }
      case 'stillness':
        this.host.hero().timers.freeze = Math.max(this.host.hero().timers.freeze, e.ms);
        this.hitAround(p.x, p.y - 20, e.radius, e.mult);
        break;
    }
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.tangle > 0) {
      this.tangle -= dt;
      if (this.tangle <= 0) { this.tangle = 0; this.strings = STRINGS; }
    } else if (this.strings < STRINGS) {
      this.regen += dt;
      if (this.regen >= STRING_REGEN_MS) { this.regen = 0; this.strings++; }
    }
    if (this.chain > 0 && this.window <= 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chain = 0;
    }
    if (this.window > 0) {
      this.window -= dt / 1000;
      if (this.window <= 0) {
        this.window = 0;
        const m = this.buffer.length ? matchTrick(this.buffer, this.known) : undefined;
        if (m?.status === 'ready') this.fire(m.trick);
        else if (m) this.fumble();
        this.buffer = [];
      }
    }
    this.flights = this.flights.filter((f) => f.tick(dt));
    this.draw();
  }

  private draw(): void {
    const g = this.gfx.clear();
    if (this.flights.length === 0) return;
    const p = this.host.player();
    const hand = { x: p.x + this.host.facing() * 6, y: p.y - 24 };
    const color = [0, 0x92400e, 0xa855f7, 0x22d3ee, 0xf9d64b][this.tier] ?? 0xffffff;
    for (const f of this.flights) {
      g.lineStyle(1, 0xf5f5f4, 0.8).lineBetween(hand.x, hand.y, f.pos.x, f.pos.y);
      g.fillStyle(color, 1).fillCircle(f.pos.x, f.pos.y, 6);
      g.fillStyle(0xffffff, 0.8).fillCircle(f.pos.x - 2, f.pos.y - 2, 2);
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
