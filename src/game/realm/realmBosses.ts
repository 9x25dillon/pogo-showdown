import Phaser from 'phaser';
import type { RealmEnemyId } from './realmEnemies';
import type { BossId } from './realms';
import { TILE } from './worldGen';

/**
 * The four realm bosses. Each is a small state machine driven through a
 * narrow context (where the player is, how to spawn hazards and minions,
 * the arena bounds) so RealmScene only owns the plumbing.
 *
 *   Cinder Tyrant  walk -> crouch -> leap -> slam (flame waves) -> recover
 *   Leviathan      circle (spits bubbles) -> windup -> lunge -> tired
 *   Harpy Queen    hover (feather fans) -> windup -> dive -> climb
 *   Hollow King    stalk (guards his front) -> windup -> dash -> reel (open to hits);
 *                  raises two knights at 2/3 and 1/3 health
 */
export interface BossDef {
  id: BossId;
  name: string;
  texture: string;
  hp: number;
  contactDamage: number;
  flies: boolean;
}

export const BOSSES: Record<BossId, BossDef> = {
  tyrant: { id: 'tyrant', name: 'Cinder Tyrant', texture: 'boss_tyrant', hp: 300, contactDamage: 20, flies: false },
  leviathan: { id: 'leviathan', name: 'Leviathan', texture: 'boss_leviathan', hp: 260, contactDamage: 18, flies: true },
  harpy: { id: 'harpy', name: 'Harpy Queen', texture: 'boss_harpy', hp: 240, contactDamage: 16, flies: true },
  king: { id: 'king', name: 'Hollow King', texture: 'boss_king', hp: 320, contactDamage: 22, flies: false },
};

export interface HazardSpec {
  x: number;
  y: number;
  texture: string;
  vx: number;
  vy: number;
  damage: number;
  lifespanMs: number;
  gravity?: number;
  /** vanish on hitting rock */
  solidStops?: boolean;
}

export interface BossCtx {
  player: Phaser.Physics.Arcade.Sprite;
  /** arena in world px */
  arena: { x0: number; x1: number; floorY: number; waterTopY?: number };
  hazard(spec: HazardSpec): void;
  summon(id: RealmEnemyId, x: number, y: number): void;
  shake(ms: number, intensity: number): void;
  float(x: number, y: number, text: string, color: string): void;
}

export interface BossState {
  def: BossDef;
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  phase: string;
  timer: number;
  /** per-boss scratch: dive targets, summon thresholds passed, etc. */
  data: Record<string, number>;
}

export function createBoss(def: BossDef, sprite: Phaser.Physics.Arcade.Sprite): BossState {
  const first: Record<BossId, string> = { tyrant: 'walk', leviathan: 'circle', harpy: 'hover', king: 'stalk' };
  return { def, sprite, hp: def.hp, phase: first[def.id], timer: 2000, data: { summons: 0, fire: 900 } };
}

export const enraged = (b: BossState) => b.hp <= b.def.hp / 2;

function body(b: BossState): Phaser.Physics.Arcade.Body {
  return b.sprite.body as Phaser.Physics.Arcade.Body;
}

/** fly toward a point at up to `speed`; true once there */
function flyTo(b: BossState, x: number, y: number, speed: number): boolean {
  const dx = x - b.sprite.x;
  const dy = y - b.sprite.y;
  const d = Math.hypot(dx, dy);
  if (d < 8) {
    body(b).setVelocity(0, 0);
    return true;
  }
  const v = Math.min(speed, d * 5);
  body(b).setVelocity((dx / d) * v, (dy / d) * v);
  return false;
}

function aimAt(b: BossState, ctx: BossCtx, speed: number, spread = 0): { vx: number; vy: number } {
  const a = Math.atan2(ctx.player.y - 20 - b.sprite.y, ctx.player.x - b.sprite.x) + spread;
  return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

export function updateBoss(b: BossState, ctx: BossCtx, dt: number): void {
  b.timer -= dt;
  const { player, arena } = ctx;
  const toward = player.x < b.sprite.x ? -1 : 1;
  const bd = body(b);
  const grounded = bd.blocked.down || bd.touching.down;
  const clampX = (x: number) => Phaser.Math.Clamp(x, arena.x0 + 3 * TILE, arena.x1 - 3 * TILE);

  switch (b.def.id) {
    case 'tyrant': {
      if (b.phase === 'walk') {
        bd.setVelocityX(toward * (enraged(b) ? 105 : 70));
        b.sprite.setFlipX(toward < 0);
        if (b.timer <= 0 && grounded) { b.phase = 'crouch'; b.timer = 500; bd.setVelocityX(0); b.sprite.setTint(0xffd6a5); }
      } else if (b.phase === 'crouch') {
        if (b.timer <= 0) {
          b.phase = 'leap';
          b.timer = 0;
          b.sprite.clearTint();
          bd.setVelocity(Phaser.Math.Clamp((player.x - b.sprite.x) / 0.9, -320, 320), -720);
        }
      } else if (b.phase === 'leap') {
        b.timer += 2 * dt; // elapsed airtime
        if (grounded && b.timer > 200) {
          b.phase = 'recover';
          b.timer = 900;
          bd.setVelocityX(0);
          ctx.shake(200, 0.012);
          const waves = enraged(b) ? 3 : 2;
          for (const dir of [-1, 1]) for (let i = 0; i < waves; i++) {
            ctx.hazard({ x: b.sprite.x + dir * (30 + i * 26), y: b.sprite.y - 12, texture: 'fx_flame', vx: dir * (190 + i * 40), vy: 0, damage: 16, lifespanMs: 1800 });
          }
        }
      } else if (b.phase === 'recover') {
        bd.setVelocityX(0);
        if (b.timer <= 0) { b.phase = 'walk'; b.timer = enraged(b) ? 1800 : 2600; }
      }
      if (enraged(b) && b.data.summons < 1) {
        b.data.summons = 1;
        ctx.summon('imp', b.sprite.x - 80, b.sprite.y - 120);
        ctx.summon('imp', b.sprite.x + 80, b.sprite.y - 120);
      }
      break;
    }
    case 'leviathan': {
      const top = (arena.waterTopY ?? arena.floorY - 160) + 30;
      const bottom = arena.floorY - 30;
      if (b.phase === 'circle') {
        b.data.t = (b.data.t ?? 0) + dt / 1000;
        const cx = (arena.x0 + arena.x1) / 2 + Math.sin(b.data.t * 0.9) * ((arena.x1 - arena.x0) / 2 - 80);
        const cy = (top + bottom) / 2 + Math.sin(b.data.t * 2.1) * ((bottom - top) / 2 - 10);
        flyTo(b, cx, cy, 170);
        b.sprite.setFlipX(bd.velocity.x < 0);
        b.data.fire -= dt;
        if (b.data.fire <= 0) {
          b.data.fire = enraged(b) ? 700 : 1100;
          const v = aimAt(b, ctx, 130);
          ctx.hazard({ x: b.sprite.x, y: b.sprite.y, texture: 'fx_bubble', vx: v.vx, vy: v.vy, damage: 10, lifespanMs: 3200 });
        }
        if (b.timer <= 0) { b.phase = 'windup'; b.timer = 600; bd.setVelocity(0, 0); b.sprite.setTint(0xbfdbfe); }
      } else if (b.phase === 'windup') {
        if (b.timer <= 0) {
          b.phase = 'lunge';
          b.timer = 1100;
          b.sprite.clearTint();
          const v = aimAt(b, ctx, enraged(b) ? 520 : 430);
          bd.setVelocity(v.vx, v.vy);
          b.sprite.setFlipX(v.vx < 0);
        }
      } else if (b.phase === 'lunge') {
        const out = b.sprite.x < arena.x0 + 40 || b.sprite.x > arena.x1 - 40 || b.sprite.y < top - 90 || b.sprite.y > bottom;
        if (b.timer <= 0 || out) { b.phase = 'tired'; b.timer = 1300; }
      } else if (b.phase === 'tired') {
        flyTo(b, clampX(b.sprite.x), Phaser.Math.Clamp(b.sprite.y, top, bottom), 60);
        if (b.timer <= 0) { b.phase = 'circle'; b.timer = enraged(b) ? 2400 : 3400; }
      }
      break;
    }
    case 'harpy': {
      // low enough to stay on screen and to be struck with a jumping swing between dives
      const hoverY = arena.floorY - 150;
      if (b.phase === 'hover') {
        b.data.t = (b.data.t ?? 0) + dt / 1000;
        flyTo(b, clampX(player.x + Math.sin(b.data.t * 1.3) * 160), hoverY, 190);
        b.sprite.setFlipX(toward < 0);
        b.data.fire -= dt;
        if (b.data.fire <= 0) {
          b.data.fire = 1400;
          const fan = enraged(b) ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.3, 0, 0.3];
          for (const s of fan) {
            const v = aimAt(b, ctx, 230, s);
            ctx.hazard({ x: b.sprite.x, y: b.sprite.y + 20, texture: 'fx_feather', vx: v.vx, vy: v.vy, damage: 12, lifespanMs: 2600, solidStops: true });
          }
        }
        if (b.timer <= 0) { b.phase = 'windup'; b.timer = 500; bd.setVelocity(0, 0); b.sprite.setTint(0xffffff); }
      } else if (b.phase === 'windup') {
        if (b.timer <= 0) {
          b.phase = 'dive';
          b.timer = 900;
          b.sprite.clearTint();
          b.data.tx = player.x;
          b.data.ty = player.y - 16;
        }
      } else if (b.phase === 'dive') {
        const there = flyTo(b, b.data.tx, b.data.ty, enraged(b) ? 560 : 470);
        if (there || b.timer <= 0) { b.phase = 'climb'; b.timer = 900; }
      } else if (b.phase === 'climb') {
        if (flyTo(b, clampX(b.sprite.x), hoverY, 240) || b.timer <= 0) { b.phase = 'hover'; b.timer = enraged(b) ? 3600 : 5000; }
      }
      break;
    }
    case 'king': {
      if (b.phase === 'stalk') {
        bd.setVelocityX(toward * 60);
        b.sprite.setFlipX(toward < 0);
        const near = Math.abs(player.x - b.sprite.x) < 240;
        if (b.timer <= 0 || (near && b.timer < 1500)) { b.phase = 'windup'; b.timer = 600; bd.setVelocityX(0); b.sprite.setTint(0xfca5a5); }
      } else if (b.phase === 'windup') {
        if (b.timer <= 0) {
          b.phase = 'dash';
          b.timer = 450;
          b.data.dir = toward;
          b.sprite.clearTint();
        }
      } else if (b.phase === 'dash') {
        bd.setVelocityX(b.data.dir * (enraged(b) ? 600 : 520));
        if (b.timer <= 0 || bd.blocked.left || bd.blocked.right) { b.phase = 'reel'; b.timer = 1300; bd.setVelocityX(0); }
      } else if (b.phase === 'reel') {
        bd.setVelocityX(0);
        b.sprite.setAngle(Math.sin(b.timer / 70) * 6);
        if (b.timer <= 0) { b.phase = 'stalk'; b.timer = 3000; b.sprite.setAngle(0); }
      } else if (b.phase === 'raise') {
        bd.setVelocityX(0);
        if (b.timer <= 0) {
          ctx.summon('knight', clampX(b.sprite.x - 140), arena.floorY);
          ctx.summon('knight', clampX(b.sprite.x + 140), arena.floorY);
          b.phase = 'stalk';
          b.timer = 2500;
        }
      }
      // raise the dead at 2/3 and 1/3 health, once each
      const threshold = b.data.summons === 0 ? (b.def.hp * 2) / 3 : b.data.summons === 1 ? b.def.hp / 3 : -1;
      if (b.hp <= threshold && b.phase !== 'dash') {
        b.data.summons += 1;
        b.phase = 'raise';
        b.timer = 1000;
        b.sprite.setAngle(0);
        ctx.float(b.sprite.x, b.sprite.y - 90, 'RISE.', '#c4b5fd');
      }
      break;
    }
  }
}

/**
 * Apply a sword hit; returns the damage actually dealt. The Hollow King
 * turns aside blows to his front unless he's reeling from a dash.
 */
export function hitBoss(b: BossState, damage: number, fromX: number): number {
  if (b.def.id === 'king') {
    const facing = b.sprite.flipX ? -1 : 1;
    const fromFront = Math.sign(fromX - b.sprite.x) === facing;
    if (b.phase === 'reel') damage = Math.round(damage * 1.5);
    else if (fromFront && b.phase !== 'raise') return 0;
  }
  b.hp = Math.max(0, b.hp - damage);
  return damage;
}
