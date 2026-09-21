import type { RivalWaypoint } from '../data/levels';
import type { ControllerInput } from './PlayerController';

/**
 * Computes the rival's ControllerInput each frame from a level's authored
 * waypoints (hold toward the next waypoint x; press+hold jump on approach
 * to a waypoint marked `jump`). Fed into the same PlayerController the
 * human player uses. The rival ignores environmental patrol enemies in
 * Phase 1 - only platforms/gaps/the player matter to it, an explicit
 * simplification to avoid full obstacle-avoidance AI.
 */
const WAYPOINT_ARRIVE_PX = 24;
const JUMP_TRIGGER_RANGE_PX = 60;
const JUMP_HOLD_MS = 220;

export interface RivalAIState {
  waypointIndex: number;
  triggeredJump: boolean;
  jumpHoldMs: number;
}

export function createRivalAIState(): RivalAIState {
  return { waypointIndex: 0, triggeredJump: false, jumpHoldMs: 0 };
}

export function computeRivalInput(
  rivalX: number,
  waypoints: RivalWaypoint[],
  state: RivalAIState,
  stunned: boolean,
  dtMs: number,
): ControllerInput {
  if (stunned) {
    state.jumpHoldMs = 0;
    return { left: false, right: false, jumpPressed: false, jumpHeld: false };
  }

  state.jumpHoldMs = Math.max(0, state.jumpHoldMs - dtMs);
  let jumpPressed = false;

  const wp = waypoints[state.waypointIndex];
  if (wp) {
    const dist = wp.x - rivalX;
    if (wp.jump && !state.triggeredJump && dist > 0 && dist <= JUMP_TRIGGER_RANGE_PX) {
      jumpPressed = true;
      state.triggeredJump = true;
      state.jumpHoldMs = JUMP_HOLD_MS;
    }
    if (rivalX >= wp.x - WAYPOINT_ARRIVE_PX && state.waypointIndex < waypoints.length - 1) {
      state.waypointIndex += 1;
      state.triggeredJump = false;
    }
  }

  return { left: false, right: true, jumpPressed, jumpHeld: state.jumpHoldMs > 0 };
}
