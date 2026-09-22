import type { PocketWorld } from './pocketGen';
import { T } from './tiles';

export interface FoundryTrap { tx: number; ty: number; kind: 'steam' | 'press'; offset: number }
export interface FoundryStation { tx: number; ty: number; gate: number; name: string }
export interface FoundryCache { tx: number; ty: number; name: string }
export interface FoundryWorld extends PocketWorld {
  stations: FoundryStation[];
  traps: FoundryTrap[];
  caches: FoundryCache[];
  guards: { tx: number; ty: number }[];
}

export const FOUNDRY_FLOOR = 50;
export const FOUNDRY_ROOMS = [
  { x0: 22, x1: 112, name: 'THE INTAKE', detail: 'Steam hisses amber before it erupts. Cross while the vents are dark.' },
  { x0: 113, x1: 203, name: 'THE STAMPING HALL', detail: 'Watch the press warning. The upper galleries hide the old supply caches.' },
  { x0: 204, x1: 294, name: 'THE BOILER WORKS', detail: 'Restore the final regulator. Every regulator is a checkpoint.' },
  { x0: 295, x1: 374, name: 'THE HEART ENGINE', detail: 'The Warden guards its core. Dodge the charge, jump the gears, strike when it vents.' },
] as const;

/** Authored branch geometry; the seed changes trap rhythms and cache approaches. */
export function generateFoundry(seed: number): FoundryWorld {
  const w = 378, h = 72, floor = FOUNDRY_FLOOR;
  const tiles = new Uint8Array(w * h);
  const surface = new Int16Array(w).fill(floor);
  const set = (x: number, y: number, id: number) => { if (x >= 0 && x < w && y >= 0 && y < h) tiles[y * w + x] = id; };
  const rect = (x: number, y: number, width: number, height: number, id: number) => {
    for (let dx = 0; dx < width; dx++) for (let dy = 0; dy < height; dy++) set(x + dx, y + dy, id);
  };
  rect(0, 0, w, 29, T.FOUNDRY_WALL);
  rect(0, floor, w, h - floor, T.FOUNDRY_WALL);
  rect(0, 0, 2, h, T.FOUNDRY_WALL); rect(w - 2, 0, 2, h, T.FOUNDRY_WALL);
  const stations: FoundryStation[] = [], traps: FoundryTrap[] = [], caches: FoundryCache[] = [], guards: { tx: number; ty: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const start = 22 + i * 91, gate = start + 90;
    stations.push({ tx: gate - 7, ty: floor - 1, gate, name: ['Intake', 'Stamping', 'Boiler'][i] });
    rect(gate, 29, 1, floor - 29, T.FOUNDRY_GATE);
    // Upper supply gallery branches off the floor path: three jumps up, then a drop back down.
    const shift = ((seed >>> (i * 3)) & 1) * 2;
    const branch = start + 8 + shift;
    for (let step = 0; step < 4; step++) rect(branch + step * 6, floor - 3 * (step + 1), 4, 1, T.FOUNDRY_WALL);
    rect(branch + 24, floor - 12, 14, 1, T.FOUNDRY_WALL);
    caches.push({ tx: branch + 33, ty: floor - 13, name: ['Surveyor’s Locker', 'Artificer’s Strongbox', 'Foreman’s Reserve'][i] });
    // Main route has a shorter, safe cache-free passage beneath the gallery.
    for (let n = 0; n < 3; n++) traps.push({ tx: start + 49 + n * 9, ty: floor - 1, kind: i === 1 ? 'press' : 'steam', offset: (seed + i * 1103 + n * 1450) % 6000 });
    guards.push({ tx: start + 43, ty: floor - 1 }, { tx: start + 76, ty: floor - 1 });
    for (let x = start; x < gate - 3; x += 18) set(x, 30, T.TORCH);
  }
  rect(4, floor - 3, 2, 3, T.PORTAL);
  // Low platforms in the boss chamber offer jump landmarks, with plenty of charge room.
  rect(322, floor - 4, 5, 1, T.FOUNDRY_WALL);
  rect(354, floor - 4, 5, 1, T.FOUNDRY_WALL);
  const entrance = { tx: 8, ty: floor - 1 };
  return { seed, w, h, tiles, surface, spawn: entrance, entrance, pocket: 'foundry', arena: { x0: 309, x1: w - 2, floorY: floor }, stations, traps, caches, guards };
}
