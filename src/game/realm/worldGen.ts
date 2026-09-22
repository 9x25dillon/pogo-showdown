import { T } from './tiles';
import { POCKET_ORDER, type PocketId } from './realms';

/**
 * Forever Realm world generation. Pure and seeded: the same seed always
 * produces the same world, so a save only needs the seed plus the tiles
 * the player changed (see realmSave.ts), not the whole map.
 *
 * Layout, top to bottom: sky, a rolling grass surface with trees and
 * Nightbloom herbs, a dirt band, stone riddled with caverns and winding
 * tunnels, ore banded by depth (copper shallow, iron mid, soulstone
 * deep), and a bedrock floor.
 */
export const TILE = 16;
export const WORLD_W = 640;
export const WORLD_H = 200;

export interface World {
  seed: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  /** y of the grass surface for each column, as generated (before edits) */
  surface: Int16Array;
  spawn: { tx: number; ty: number };
  /** overworld: the shrine's four realm portals (top-left tile, 2x3) */
  portals?: { pocket: PocketId; tx: number; ty: number }[];
}

/** the shrine sits a short walk right of spawn on flattened ground */
export const SHRINE_OFFSET = 14;
export const SHRINE_W = 28;

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** fractal value noise in [0, 1) */
function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(x, y, seed + o * 101) * amp;
    norm += amp;
    x *= 2;
    y *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

export function tileIndex(w: number, tx: number, ty: number): number {
  return ty * w + tx;
}

export function generateWorld(seed: number, w = WORLD_W, h = WORLD_H): World {
  const tiles = new Uint8Array(w * h);
  const surface = new Int16Array(w);
  const set = (x: number, y: number, id: number) => {
    if (x >= 0 && x < w && y >= 0 && y < h) tiles[y * w + x] = id;
  };
  const get = (x: number, y: number) => (x >= 0 && x < w && y >= 0 && y < h ? tiles[y * w + x] : T.BEDROCK);

  // surface: broad hills plus small bumps, flattened from spawn across the shrine
  const spawnX = Math.floor(w / 2);
  const flatX0 = spawnX - 4;
  const flatX1 = spawnX + SHRINE_OFFSET + SHRINE_W + 2;
  const inFlat = (x: number) => x >= flatX0 && x <= flatX1;
  for (let x = 0; x < w; x++) {
    const broad = fbm(x / 70, 0.5, seed, 3) * 30;
    const bumps = fbm(x / 14, 3.5, seed + 9, 2) * 6;
    let s = Math.round(48 + broad + bumps);
    const toFlat = x < flatX0 ? flatX0 - x : x > flatX1 ? x - flatX1 : 0;
    const flatten = Math.max(0, 1 - toFlat / 10);
    s = Math.round(s * (1 - flatten) + 60 * flatten);
    surface[x] = Math.max(34, Math.min(92, s));
  }

  for (let x = 0; x < w; x++) {
    const s = surface[x];
    const dirtDepth = 5 + Math.floor(fbm(x / 20, 7.7, seed + 3, 2) * 6);
    for (let y = s; y < h; y++) {
      if (y >= h - 3) set(x, y, T.BEDROCK);
      else if (y === s) set(x, y, T.GRASS);
      else if (y < s + dirtDepth) set(x, y, T.DIRT);
      else set(x, y, T.STONE);
    }
  }

  // caves: open caverns deep down, winding tunnels everywhere below the dirt
  for (let x = 0; x < w; x++) {
    const s = surface[x];
    for (let y = s + 4; y < h - 4; y++) {
      const depth = y - s;
      const cavern = fbm(x / 26, y / 16, seed + 21) > 0.63 - Math.min(0.06, depth / 1500);
      const tunnel = Math.abs(fbm(x / 38, y / 30, seed + 37, 3) - 0.5) < 0.026;
      const nearSpawn = inFlat(x) && depth < 14; // don't open a pit under the player or the shrine
      if ((cavern && depth > 12) || (tunnel && !nearSpawn)) set(x, y, T.AIR);
    }
  }

  // ores, banded by depth (only replace stone)
  for (let x = 0; x < w; x++) {
    const s = surface[x];
    for (let y = s + 8; y < h - 3; y++) {
      if (get(x, y) !== T.STONE) continue;
      const depth = y - s;
      if (depth > 70 && fbm(x / 5, y / 5, seed + 71, 2) > 0.8) set(x, y, T.SOULSTONE);
      else if (depth > 32 && fbm(x / 5, y / 5, seed + 53, 2) > 0.77) set(x, y, T.IRON);
      else if (fbm(x / 5, y / 5, seed + 41, 2) > 0.75) set(x, y, T.COPPER);
    }
  }

  // trees and herbs on grass, never crowding spawn
  let x = 4;
  while (x < w - 4) {
    const s = surface[x];
    const r = hash(x, 1, seed + 91);
    const flat = Math.abs(surface[x - 1] - s) <= 1 && Math.abs(surface[x + 1] - s) <= 1;
    if (!inFlat(x - 3) && !inFlat(x + 3) && flat && get(x, s) === T.GRASS && get(x, s - 1) === T.AIR) {
      const height = 5 + Math.floor(r * 5);
      for (let i = 1; i <= height; i++) set(x, s - i, T.TRUNK);
      const top = s - height;
      for (let dy = -2; dy <= 1; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 3 || (dx === 0 && dy >= 0)) continue;
          if (get(x + dx, top + dy) === T.AIR) set(x + dx, top + dy, T.LEAVES);
        }
      }
      x += 7 + Math.floor(hash(x, 2, seed) * 8);
    } else {
      if (r < 0.14 && get(x, s) === T.GRASS && get(x, s - 1) === T.AIR && !inFlat(x)) set(x, s - 1, T.HERB);
      x += 1;
    }
  }

  // the shrine: a stone plaza with four realm portals
  const shrineX = spawnX + SHRINE_OFFSET;
  const floorY = surface[shrineX];
  const portals: NonNullable<World['portals']> = [];
  for (let x = shrineX; x < shrineX + SHRINE_W; x++) {
    for (let y = floorY - 6; y < floorY; y++) set(x, y, T.AIR);
    set(x, floorY, T.SHRINE);
  }
  POCKET_ORDER.forEach((pocket, i) => {
    const px = shrineX + 3 + i * 7;
    for (let dx = 0; dx < 2; dx++) for (let dy = 1; dy <= 3; dy++) set(px + dx, floorY - dy, T.PORTAL);
    portals.push({ pocket, tx: px, ty: floorY - 3 });
  });

  return { seed, w, h, tiles, surface, spawn: { tx: spawnX, ty: surface[spawnX] - 1 }, portals };
}
