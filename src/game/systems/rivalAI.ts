import type { RivalWaypoint } from '../data/levels';
import type { ControllerInput } from './PlayerController';

/**
 * Computes the rival's ControllerInput each frame from a level's authored
 * waypoints (hold toward the next waypoint x; take a full, held jump at a
 * waypoint marked `jump`). Fed into the same PlayerController the human
 * player uses. The rival ignores enemies - only platforms/gaps/the player
 * matter to it, an explicit simplification to avoid full obstacle-avoidance
 * AI.
 *
 * A `jump` waypoint's x is the ledge edge: the rival takes off within
 * JUMP_TRIGGER_RANGE_PX before it, and holds jump long enough
 * to reach the top of the arc - a cut-short hop can't clear a real pit.
 */
const WAYPOINT_ARRIVE_PX = 24;
const JUMP_TRIGGER_RANGE_PX = 14;
/** half the 60px body: still standing on the ledge this far past its edge */
const LEDGE_OVERHANG_PX = 28;
const JUMP_HOLD_MS = 420;

export interface RivalAIState {
  waypointIndex: number;
  triggeredJump: boolean;
  jumpHoldMs: number;
}

export function createRivalAIState(): RivalAIState {
  return { waypointIndex: 0, triggeredJump: false, jumpHoldMs: 0 };
}

/**
 * After a respawn, point the AI back at the first waypoint it hasn't
 * really passed - otherwise a missed jump leaves the index beyond the
 * jump waypoint and the rival runs into the same pit forever.
 */
export function resyncRivalAI(state: RivalAIState, waypoints: RivalWaypoint[], rivalX: number): void {
  const i = waypoints.findIndex((wp) => wp.x >= rivalX - (wp.jump ? LEDGE_OVERHANG_PX : 0));
  state.waypointIndex = i >= 0 ? i : Math.max(0, waypoints.length - 1);
  state.triggeredJump = false;
  state.jumpHoldMs = 0;
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
    // no lower bound: after a long frame the rival may already be past the
    // window - a late press still fires within coyote time, and if it
    // doesn't, the respawn resync gives it another go
    if (wp.jump && !state.triggeredJump && dist <= JUMP_TRIGGER_RANGE_PX) {
      jumpPressed = true;
      state.triggeredJump = true;
      state.jumpHoldMs = JUMP_HOLD_MS;
    }
    // a jump waypoint is only passed once its jump has fired
    const arrived = rivalX >= wp.x - WAYPOINT_ARRIVE_PX && (!wp.jump || state.triggeredJump);
    if (arrived && state.waypointIndex < waypoints.length - 1) {
      state.waypointIndex += 1;
      state.triggeredJump = false;
    }
  }

  return { left: false, right: true, jumpPressed, jumpHeld: state.jumpHoldMs > 0 };
}
