import { LEVELS } from '../data/levels';
import { isSolid, T } from './tiles';
import type { World } from './worldGen';

/**
 * Pog Quest, in the world: every level is a rift torn in the overworld.
 * Solo rifts spiral outwards from spawn, alternating east and west, so the
 * quest pulls you across the map; the co-op rifts sit together past the
 * Schoolyard. Rifts open in the old level order (see questRepository's
 * isLevelUnlocked) and the next open one is always on your minimap.
 *
 * Inside, a rift is its Pog Quest level, unchanged. Clearing one banks XP
 * immediately (no unbanked risk), sends copper to your pack, and the first
 * clear pays a Tech Point and that level's pog.
 */
export interface RiftSpot {
  tx: number;
  ty: number;
  seen: boolean;
}

/**
 * Clear ground for each rift, kept at least 6 columns from anything
 * already standing there (`reserved`) and from each other.
 */
export function placeRifts(world: World, reserved: number[]): RiftSpot[] {
  const taken = [...reserved];
  const tile = (x: number, y: number) => (x < 0 || y < 0 || x >= world.w || y >= world.h ? T.BEDROCK : world.tiles[y * world.w + x]);
  const sx = world.spawn.tx;
  let solo = 0;
  let coop = 0;
  /** a 3-wide, 4-tall pocket of air over solid ground near the surface, or null */
  const clearGround = (tx: number): number | null => {
    for (let ty = Math.max(4, world.surface[tx] - 8); ty < Math.min(world.h - 4, world.surface[tx] + 8); ty++) {
      let clear = true;
      for (let dx = 0; dx < 3 && clear; dx++) {
        if (!isSolid(tile(tx + dx, ty + 1))) clear = false;
        for (let dy = 0; dy < 4; dy++) if (tile(tx + dx, ty - dy) !== T.AIR) clear = false;
      }
      if (clear) return ty;
    }
    return null;
  };
  return LEVELS.map((level) => {
    let preferred: number;
    if (level.coop) preferred = sx - 54 - 8 * coop++;
    else {
      const k = solo++;
      preferred = sx + (k % 2 === 0 ? 1 : -1) * (70 + k * 18);
    }
    preferred = Math.max(6, Math.min(world.w - 8, preferred));
    // first keep clear of everything; if the terrain nearby is too crowded, settle for any clear ground
    for (const spaced of [true, false]) {
      for (let offset = 0; offset < 200; offset++) {
        for (const tx of [preferred + offset, preferred - offset]) {
          if (tx < 6 || tx > world.w - 8 || (spaced && taken.some((t) => Math.abs(t - tx) < 6))) continue;
          const ty = clearGround(tx);
          if (ty !== null) { taken.push(tx); return { tx, ty, seen: false }; }
        }
      }
    }
    taken.push(preferred);
    return { tx: preferred, ty: world.surface[preferred] - 1, seen: false };
  });
}

export const RIFT_COLOR = { sealed: 0x57534e, open: 0xa855f7, cleared: 0xfacc15 };
