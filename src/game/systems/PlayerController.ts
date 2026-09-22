import Phaser from 'phaser';
import { PHYS } from '../data/platformerConfig';

/**
 * Shared movement/physics controller used for both the human player and
 * the AI rival in the platformer mode, so tuning never duplicates and the
 * co-op second player plugs into the same function.
 */
export interface ControllerInput {
  left: boolean;
  right: boolean;
  /** true only on the frame jump was first pressed (edge-triggered) */
  jumpPressed: boolean;
  /** true for as long as jump is held (level-triggered) */
  jumpHeld: boolean;
}

export interface ControllerState {
  coyoteMs: number;
  jumpBufferMs: number;
  jumpCutApplied: boolean;
}

export function createControllerState(): ControllerState {
  return { coyoteMs: 0, jumpBufferMs: 0, jumpCutApplied: true };
}

export interface ControllerOptions {
  moveSpeed: number;
  moveAccel: number;
}

export function updateController(
  body: Phaser.Physics.Arcade.Body,
  input: ControllerInput,
  state: ControllerState,
  opts: ControllerOptions,
  dtMs: number,
): void {
  const grounded = body.blocked.down || body.touching.down;

  state.coyoteMs = grounded ? PHYS.coyoteMs : Math.max(0, state.coyoteMs - dtMs);
  state.jumpBufferMs = input.jumpPressed ? PHYS.jumpBufferMs : Math.max(0, state.jumpBufferMs - dtMs);

  const target = input.left && !input.right ? -opts.moveSpeed : input.right && !input.left ? opts.moveSpeed : 0;
  const vx = body.velocity.x;
  const diff = target - vx;
  const maxDelta = opts.moveAccel * (dtMs / 1000);
  body.setVelocityX(Math.abs(diff) <= maxDelta ? target : vx + Math.sign(diff) * maxDelta);

  if (state.jumpBufferMs > 0 && state.coyoteMs > 0) {
    body.setVelocityY(PHYS.jumpVelocity);
    state.jumpBufferMs = 0;
    state.coyoteMs = 0;
    state.jumpCutApplied = false;
  } else if (!input.jumpHeld && body.velocity.y < 0 && !state.jumpCutApplied) {
    body.setVelocityY(body.velocity.y * PHYS.jumpCutMultiplier);
    state.jumpCutApplied = true;
  }

  if (body.velocity.y > PHYS.maxFallSpeed) body.setVelocityY(PHYS.maxFallSpeed);
}

/** heroes (player, P2, rival) fall faster than they rise when fallGravityMultiplier > 1 */
export function applyHeroGravity(body: Phaser.Physics.Arcade.Body): void {
  body.setGravityY(body.velocity.y > 0 ? PHYS.gravityY * PHYS.fallGravityMultiplier : PHYS.gravityY);
}
