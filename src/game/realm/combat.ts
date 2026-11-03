import type { RealmEnemyId } from './realmEnemies';

/**
 * The combat rhythm, in one file so tuning happens here. Everything costs
 * stamina, everything telegraphs, and every opening is earned:
 *
 *   light chain   tap: three swings, the last a heavy finisher; early presses are held
 *   charged blow  keep holding: breaks poise. Costs the most
 *   dodge         double-tap a direction: i-frames, and it cancels a swing's recovery.
 *                 Rolling through a blow is a perfect dodge: slow time and a stronger next hit
 *   guard         hold: blocks in front for stamina. Run out and the guard breaks
 *   parry         the first moment of a guard: no damage, the attacker reels, shots go back
 *   poise         enemies shrug off hits until it breaks, then stagger and take more damage
 *   riposte       hit a parried enemy while it reels: a critical blow
 */
export const STAMINA_MAX = 100;
export const STAMINA_REGEN_PER_S = 36;
export const STAMINA_DELAY_MS = 450;
/** guarding keeps your arms up: stamina comes back at this rate */
export const GUARD_REGEN_SCALE = 0.4;

export const LIGHT_COST = 12;
export const HEAVY_COST = 26;
export const DODGE_COST = 20;
export const PARRY_COST = 5;
/** stamina lost per point of damage blocked */
export const GUARD_COST_PER_DAMAGE = 2.2;
/** what still gets through a guard */
export const GUARD_CHIP = 0.15;
/** what a broken guard lets through, and how long it leaves you open */
export const GUARD_BREAK_DAMAGE = 0.6;
export const GUARD_BREAK_STUN_MS = 750;
export const GUARD_MOVE_SCALE = 0.45;

export interface SwingDef {
  /** ms before the next swing can start */
  lock: number;
  damage: number;
  /** reach in px, in front of the hero, measured the same either way they face */
  range: number;
  /** blade arc, degrees (mirrored when facing left) */
  from: number;
  to: number;
  /** a step under the blow, px/s, ground only */
  lunge: number;
  /** poise it takes */
  poise: number;
  /** ms the world holds still when it lands */
  stop: number;
}

export const SWINGS: SwingDef[] = [
  { lock: 300, damage: 1, range: 62, from: -100, to: 70, lunge: 130, poise: 12, stop: 30 },
  { lock: 300, damage: 1.1, range: 66, from: 95, to: -60, lunge: 140, poise: 14, stop: 35 },
  { lock: 470, damage: 1.6, range: 76, from: -130, to: 95, lunge: 210, poise: 30, stop: 65 },
];

export const HEAVY: SwingDef = { lock: 560, damage: 2.4, range: 84, from: -150, to: 100, lunge: 260, poise: 60, stop: 95 };

/** the chain drops if you wait this long after a swing's lock ends */
export const CHAIN_WINDOW_MS = 420;
/** a press this long before a swing can start still lands */
export const ATTACK_BUFFER_MS = 170;
/** holding attack this long after a swing starts the charge */
export const CHARGE_COMMIT_MS = 220;
/** this much charge is a heavy blow; let go sooner and nothing happens */
export const CHARGE_READY_MS = 380;
/** with no stamina you can still swing, slowly */
export const EXHAUSTED_LOCK_SCALE = 1.45;

export const DOUBLE_TAP_MS = 320;
export const DODGE_MS = 210;
export const DODGE_SPEED = 430;
export const DODGE_IFRAME_MS = 270;
export const DODGE_COOLDOWN_MS = 180;
export const PERFECT_DODGE_STAMINA = 18;
export const PERFECT_BONUS_MS = 1400;
export const PERFECT_BONUS = 1.5;

export const PARRY_WINDOW_MS = 210;
export const PARRY_COOLDOWN_MS = 420;
export const PARRY_STAMINA_BACK = 14;
export const PARRY_STAGGER_MS = 1500;
/** a boss won't reel from one parry: it takes this share of their poise */
export const PARRY_BOSS_POISE = 0.5;
export const RIPOSTE_DAMAGE = 2.5;
export const STAGGER_DAMAGE = 1.3;
export const BACKSTAB_DAMAGE = 1.3;
export const STAGGER_MS = 950;
export const BOSS_STAGGER_MS = 1500;
/** poise comes back after this long unhit */
export const POISE_REGEN_DELAY_MS = 3500;
/** a boss's poise, from its health */
export const BOSS_POISE_PER_HP = 0.28;

/** how monsters fight: they close, warn, then strike. Only the strike hurts. */
export const WINDUP_MS = 480;
export const STRIKE_MS = 220;
export const RECOVER_MS = 620;
export const ATTACK_COOLDOWN_MS = 350;
export const STRIKE_SPEED = 3.2;
export const STRIKE_RANGE_PX = 66;

/** bosses' blows and shots are this share of their listed numbers */
export const BOSS_DAMAGE_SCALE = 0.75;

export const POISE: Record<RealmEnemyId, number> = { slime: 14, crawler: 28, wraith: 20, imp: 24, eel: 24, harpy: 28, knight: 60 };

/** the hero's side of a fight: pure state, so it can be read and tested without a scene */
export class RealmCombat {
  stamina = STAMINA_MAX;
  private staminaDelay = 0;
  chain = 0;
  private chainTimer = 0;
  buffer = 0;
  guarding = false;
  parryTimer = 0;
  private parryCooldown = 0;
  /** guard broken: no actions until it runs out */
  stun = 0;
  /** ms attack has been held since the last swing */
  held = 0;
  charge = 0;
  dodgeCooldown = 0;
  airDodged = false;
  /** still inside a dodge's invulnerability */
  dodgeIframes = 0;
  private perfectCounted = false;
  perfectBonus = 0;
  private lastTap = { dir: 0, at: -1e9 };

  get exhausted(): boolean { return this.stamina <= 0; }
  get charged(): boolean { return this.charge >= CHARGE_READY_MS; }
  get ready(): boolean { return this.stun <= 0; }

  tick(dt: number): void {
    this.chainTimer -= dt;
    if (this.chainTimer <= 0) this.chain = 0;
    this.buffer = Math.max(0, this.buffer - dt);
    this.parryTimer = Math.max(0, this.parryTimer - dt);
    this.parryCooldown = Math.max(0, this.parryCooldown - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.dodgeIframes = Math.max(0, this.dodgeIframes - dt);
    this.perfectBonus = Math.max(0, this.perfectBonus - dt);
    this.staminaDelay = Math.max(0, this.staminaDelay - dt);
    if (this.staminaDelay <= 0 && this.stamina < STAMINA_MAX) {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + (STAMINA_REGEN_PER_S * (this.guarding ? GUARD_REGEN_SCALE : 1) * dt) / 1000);
    }
  }

  spend(n: number): void {
    this.stamina = Math.max(0, this.stamina - n);
    this.staminaDelay = STAMINA_DELAY_MS;
  }

  gain(n: number): void {
    this.stamina = Math.min(STAMINA_MAX, this.stamina + n);
  }

  /** which swing comes next, and move the chain on */
  nextSwing(): SwingDef {
    const def = SWINGS[this.chain];
    this.chain = (this.chain + 1) % SWINGS.length;
    this.chainTimer = def.lock + CHAIN_WINDOW_MS;
    return def;
  }

  resetChain(): void {
    this.chain = 0;
    this.chainTimer = 0;
  }

  /** a direction went down: true if it's the second tap of a double-tap */
  tapped(dir: 1 | -1, now: number): boolean {
    const double = this.lastTap.dir === dir && now - this.lastTap.at <= DOUBLE_TAP_MS;
    this.lastTap = double ? { dir: 0, at: -1e9 } : { dir, at: now };
    return double;
  }

  canDodge(grounded: boolean): boolean {
    return this.ready && this.dodgeCooldown <= 0 && this.stamina > 0 && (grounded || !this.airDodged);
  }

  dodged(grounded: boolean): void {
    this.spend(DODGE_COST);
    this.dodgeCooldown = DODGE_MS + DODGE_COOLDOWN_MS;
    this.dodgeIframes = DODGE_IFRAME_MS;
    this.perfectCounted = false;
    if (!grounded) this.airDodged = true;
    this.guarding = false;
    this.parryTimer = 0;
    this.charge = 0;
    this.held = 0;
    this.buffer = 0;
  }

  /** a blow passed through a dodge: true the first time, once per dodge */
  perfectDodge(): boolean {
    if (this.dodgeIframes <= 0 || this.perfectCounted) return false;
    this.perfectCounted = true;
    this.gain(PERFECT_DODGE_STAMINA);
    this.perfectBonus = PERFECT_BONUS_MS;
    return true;
  }

  /** guard pressed: the opening moment is a parry */
  raiseGuard(): void {
    this.guarding = true;
    this.charge = 0;
    this.held = 0;
    if (this.parryCooldown <= 0) {
      this.parryTimer = PARRY_WINDOW_MS;
      this.parryCooldown = PARRY_COOLDOWN_MS;
      this.spend(PARRY_COST);
    }
  }

  lowerGuard(): void {
    this.guarding = false;
    this.parryTimer = 0;
  }

  /** a blow against the guard: what gets through, and whether it broke */
  blocked(damage: number): { taken: number; broke: boolean } {
    this.spend(damage * GUARD_COST_PER_DAMAGE);
    if (this.stamina > 0) return { taken: damage * GUARD_CHIP, broke: false };
    this.guarding = false;
    this.parryTimer = 0;
    this.stun = GUARD_BREAK_STUN_MS;
    return { taken: damage * GUARD_BREAK_DAMAGE, broke: true };
  }

  parried(): void {
    this.parryTimer = 0;
    this.parryCooldown = 0; // a good parry can be followed by another
    this.gain(PARRY_STAMINA_BACK);
  }

  interrupted(): void {
    this.charge = 0;
    this.held = 0;
    this.buffer = 0;
    this.resetChain();
  }
}
