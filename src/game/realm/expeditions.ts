import type { World } from './worldGen';
import { isSolid, T } from './tiles';
import type { Stock } from './homestead';

export interface ExpeditionProgress {
  discovered: boolean;
  entrance?: { tx: number; ty: number };
  attempts: number;
  clears: number;
  cachesOpened: number;
  bestMs?: number;
  lantern: boolean;
  lanternEnabled: boolean;
}
export function expeditionProgress(save?: Partial<ExpeditionProgress>): ExpeditionProgress {
  return { discovered: false, attempts: 0, clears: 0, cachesOpened: 0, lantern: false, lanternEnabled: true, ...save };
}

/** A world object, not a tile edit: upgrading never bulldozes an existing home. */
export function findFoundryEntrance(world: World, occupied: (x: number, y: number) => boolean): { tx: number; ty: number } {
  const tile = (x: number, y: number) => world.tiles[y * world.w + x];
  const preferred = world.spawn.tx - 72 - ((world.seed >>> 3) % 25);
  for (let offset = 0; offset < 80; offset++) {
    const tx = preferred - offset;
    if (tx < 4) break;
    for (let floor = Math.max(5, world.surface[tx] - 8); floor < Math.min(world.h - 4, world.surface[tx] + 12); floor++) {
      let clear = true;
      for (let dx = 0; dx < 3; dx++) {
        if (!isSolid(tile(tx + dx, floor))) clear = false;
        for (let dy = 1; dy <= 4; dy++) if (tile(tx + dx, floor - dy) !== T.AIR || occupied(tx + dx, floor - dy)) clear = false;
      }
      if (clear) return { tx, ty: floor - 1 };
    }
  }
  return { tx: Math.max(4, preferred), ty: world.surface[Math.max(4, preferred)] - 1 };
}

export function trapPhase(clock: number, offset: number): 'idle' | 'warning' | 'active' {
  const phase = ((clock + offset) % 6000 + 6000) % 6000;
  return phase < 3600 ? 'idle' : phase < 4800 ? 'warning' : 'active';
}

export const CACHE_LOOT: Stock[] = [
  { copper: 10, potion: 2, torch: 4 },
  { iron: 8, potion: 2, tonic: 1 },
  { soulstone: 4, potion: 3, wood: 12 },
];
