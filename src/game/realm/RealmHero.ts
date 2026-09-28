import type { Character } from '../data/characters';
import { MASTERY_TIERS } from '../data/loadoutData';
import type { PogActiveEffect, PogDef } from '../data/pogs';
import { characterById, comboBonus, computeHeroStats, CRIT_MULT, DEATH_XP_LOSS, GUARD_QUIET_MS, levelForXp, masteryTierForLevel, type HeroStats } from './hero';
import { bankXp, type HeroSnapshot } from './progression';

/** hero state that must survive a portal trip (the scene restarts on travel) */
export interface HeroSave {
  unbanked: number;
  revivesUsed: number;
  /** active-pog charges left, by pog instance id; missing = full */
  charges: Record<string, number>;
}

export interface HeroHost {
  swordDamage: () => number;
  projectile: (damage: number) => void;
  groundPound: (damage: number) => void;
  shield: (ms: number) => void;
  healFull: () => void;
  float: (text: string, color: string) => void;
  notify: (title: string, sub: string) => void;
  /** max HP or anything derived from stats changed */
  statsChanged: () => void;
}

export type EffectTimer = 'speed' | 'freeze' | 'plunder' | 'airJump';

/** what each Pog Quest item does in the open world */
export function realmActiveText(e: PogActiveEffect): string {
  const secs = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)}s`;
  switch (e.kind) {
    case 'shieldBurst': return `invulnerable ${secs(e.invulnMs)}`;
    case 'speedBurst': return `+60% speed ${secs(e.boostMs)}`;
    case 'extraLife': return 'heal to full';
    case 'projectile': return 'hurl a slammer: 2× sword damage, pierces 3';
    case 'freeze': return `freeze every creature and boss ${secs(e.freezeMs)}`;
    case 'magnet': return `plunder: double drops ${secs(e.magnetMs)}`;
    case 'doubleJump': return `an extra air jump for ${secs(e.windowMs)}`;
    case 'groundPound': return 'slam down: 2.5× sword damage shockwave';
  }
}

/**
 * The hero's live combat state: stats from character + level + pogs, the
 * style combo, guard pips, revives, unbanked XP and active-pog charges.
 */
export class RealmHero {
  snap: HeroSnapshot;
  stats!: HeroStats;
  level = 1;
  combo = 0;
  guard = 0;
  revivesLeft = 0;
  unbanked = 0;
  readonly timers: Record<EffectTimer, number> = { speed: 0, freeze: 0, plunder: 0, airJump: 0 };
  private comboTimer = 0;
  private guardTimer = 0;
  private quiet = 0;
  private charges = new Map<string, number>();
  private host: HeroHost;

  constructor(host: HeroHost, snap: HeroSnapshot, save?: HeroSave) {
    this.host = host;
    this.snap = snap;
    this.recompute();
    this.guard = this.stats.guardPips;
    this.unbanked = save?.unbanked ?? 0;
    this.revivesLeft = Math.max(0, this.stats.revives - (save?.revivesUsed ?? 0));
    for (const [id, n] of Object.entries(save?.charges ?? {})) this.charges.set(id, n);
  }

  get character(): Character { return characterById(this.snap.characterId); }
  get masteryName(): string { return MASTERY_TIERS[masteryTierForLevel(this.level)].name; }
  get comboMult(): number { return 1 + comboBonus(this.combo, this.stats.comboCap); }
  get frozen(): boolean { return this.timers.freeze > 0; }

  recompute(): void {
    this.level = levelForXp(this.snap.xp).level;
    this.stats = computeHeroStats(this.snap.characterId, this.level, this.snap.perks);
    this.guard = Math.min(this.guard, this.stats.guardPips);
  }

  /** after an equip change: keep spent charges, grow/shrink pips and revives */
  refresh(snap: HeroSnapshot): void {
    const oldRevives = this.stats.revives;
    this.snap = snap;
    this.recompute();
    this.revivesLeft = Math.max(0, Math.min(this.stats.revives, this.revivesLeft + this.stats.revives - oldRevives));
    this.host.statsChanged();
  }

  xpProgress(): { level: number; into: number; need: number } {
    return levelForXp(this.snap.xp);
  }

  // ---------------- active pogs ----------------

  activeRows(): { id: string; def: PogDef; effect: PogActiveEffect }[] {
    return this.snap.pogs.filter((r) => r.instance.equipped && r.def.activeEffect)
      .map((r) => ({ id: r.instance.id, def: r.def, effect: r.def.activeEffect! }));
  }

  chargesLeft(id: string): number {
    const row = this.activeRows().find((r) => r.id === id);
    if (!row) return 0;
    return this.charges.get(id) ?? row.effect.charges;
  }

  useActive(id: string): boolean {
    const row = this.activeRows().find((r) => r.id === id);
    if (!row || this.chargesLeft(id) <= 0) return false;
    const e = row.effect;
    switch (e.kind) {
      case 'shieldBurst': this.host.shield(e.invulnMs); break;
      case 'speedBurst': this.timers.speed = e.boostMs; break;
      case 'extraLife': this.host.healFull(); break;
      case 'projectile': this.host.projectile(Math.round(this.host.swordDamage() * 2)); break;
      case 'freeze': this.timers.freeze = e.freezeMs; break;
      case 'magnet': this.timers.plunder = e.magnetMs; break;
      case 'doubleJump': this.timers.airJump = e.windowMs; break;
      case 'groundPound': this.host.groundPound(Math.round(this.host.swordDamage() * 2.5)); break;
    }
    this.charges.set(id, this.chargesLeft(id) - 1);
    this.host.float(`${row.def.emoji} ${row.def.name}`, '#fde68a');
    return true;
  }

  // ---------------- combat ----------------

  tick(dt: number): void {
    for (const k of Object.keys(this.timers) as EffectTimer[]) this.timers[k] = Math.max(0, this.timers[k] - dt);
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.quiet += dt;
    if (this.guard < this.stats.guardPips && this.quiet > GUARD_QUIET_MS) {
      this.guardTimer += dt;
      if (this.guardTimer >= this.stats.guardRechargeMs) {
        this.guardTimer = 0;
        this.guard++;
      }
    } else if (this.guard >= this.stats.guardPips) this.guardTimer = 0;
  }

  /** final damage for one blow: level/character multiplier, style combo, maybe a crit */
  strike(base: number): { damage: number; crit: boolean } {
    const crit = Math.random() < this.stats.critChance;
    const damage = Math.round(base * this.stats.damageMult * this.comboMult * (crit ? CRIT_MULT : 1));
    return { damage, crit };
  }

  hitLanded(): void {
    this.combo++;
    this.comboTimer = this.stats.comboDecayMs;
  }

  /** a guard pip eats the whole hit; returns true if it did */
  absorb(): boolean {
    this.quiet = 0;
    if (this.guard <= 0) return false;
    this.guard--;
    this.guardTimer = 0;
    if (!this.stats.guardKeepsCombo) this.combo = 0;
    this.host.float('GUARD', '#93c5fd');
    return true;
  }

  hurt(): void {
    this.quiet = 0;
    this.combo = 0;
  }

  // ---------------- XP, death, rest ----------------

  /** raw XP (a kill pays its combo multiplier too); banked only by resting or a realm victory */
  gainXp(amount: number, withCombo = false): number {
    const n = Math.max(0, Math.round(amount * (withCombo ? this.comboMult : 1)));
    this.unbanked += n;
    return n;
  }

  /** extra copies from loot luck and plunder */
  lootRoll(count: number): number {
    const luck = this.stats.lootLuck;
    let n = count + Math.floor(luck) + (Math.random() < luck % 1 ? 1 : 0);
    if (this.timers.plunder > 0) n *= 2;
    return n;
  }

  tryRevive(): boolean {
    if (this.revivesLeft <= 0) return false;
    this.revivesLeft--;
    this.combo = 0;
    return true;
  }

  /** a real death: the combo and half the unbanked XP are gone */
  onDeath(): number {
    const lost = Math.floor(this.unbanked * DEATH_XP_LOSS);
    this.unbanked -= lost;
    this.combo = 0;
    for (const k of Object.keys(this.timers) as EffectTimer[]) this.timers[k] = 0;
    return lost;
  }

  /** sleeping: every charge, revive and guard pip comes back */
  restore(): void {
    this.charges.clear();
    this.revivesLeft = this.stats.revives;
    this.guard = this.stats.guardPips;
  }

  /** refill active pogs only (a fresh portal trip) */
  refillCharges(): void {
    this.charges.clear();
  }

  async bank(): Promise<void> {
    if (this.unbanked <= 0) return;
    const amount = this.unbanked;
    this.unbanked = 0;
    const { before, after, xp } = await bankXp(this.snap.characterId, amount);
    this.snap.xp = xp;
    this.recompute();
    this.host.statsChanged();
    if (after > before) {
      const tier = masteryTierForLevel(after) > masteryTierForLevel(before) ? ` · ${this.masteryName}` : '';
      this.host.notify(`LEVEL ${after}`, `${this.character.name} · +${(after - before) * 3} max HP · +${((after - before) * 1.5).toFixed(1)}% damage${tier}`);
    } else this.host.float(`+${amount} XP banked`, '#c4b5fd');
  }

  save(): HeroSave {
    return { unbanked: this.unbanked, revivesUsed: Math.max(0, this.stats.revives - this.revivesLeft), charges: Object.fromEntries(this.charges) };
  }
}
