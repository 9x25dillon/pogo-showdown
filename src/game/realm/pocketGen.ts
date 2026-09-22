import { T } from './tiles';
import type { World } from './worldGen';
import { FOREVER_SEGMENTS, type PocketId } from './realms';

/**
 * Portal-realm generation: a left-to-right expedition that ends in a
 * boss arena. Every pocket has an entrance (with its return portal) on
 * the left and an arena on the right; what's between is the realm's
 * own hazard. Gaps are sized to the realm jump (~7 tiles of reach).
 */
export const POCKET_W = 220;
export const POCKET_H = 70;
const ARENA_W = 44;

export interface PocketWorld extends World {
  pocket: PocketId;
  entrance: { tx: number; ty: number };
  /** arena columns [x0, x1) and the arena floor row */
  arena: { x0: number; x1: number; floorY: number };
  /** tide: rows at or below this are underwater */
  waterTop?: number;
}

function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5) >>> 0) / 4294967296;
}

export function generatePocket(pocket: PocketId, seed: number): PocketWorld {
  if (pocket === 'forever') return generateForever(seed);
  const w = POCKET_W;
  const h = POCKET_H;
  const tiles = new Uint8Array(w * h);
  const surface = new Int16Array(w);
  const rand = rng(seed + pocket.length * 7919);
  const set = (x: number, y: number, id: number) => { if (x >= 0 && x < w && y >= 0 && y < h) tiles[y * w + x] = id; };
  const fillCol = (x: number, y0: number, y1: number, id: number) => { for (let y = y0; y < y1; y++) set(x, y, id); };
  const arenaX0 = w - ARENA_W - 2;
  let arenaFloor = 48;
  let waterTop: number | undefined;

  if (pocket === 'ember' || pocket === 'tide' || pocket === 'grave') {
    const top = pocket === 'ember' ? ['ASH', 'BASALT'] : pocket === 'tide' ? ['SAND', 'SAND'] : ['BONE_BRICK', 'BONE_BRICK'];
    const surf = T[top[0] as keyof typeof T];
    const fill = pocket === 'ember' ? T.BASALT : pocket === 'tide' ? T.CORAL : T.BONE_BRICK;
    let y = pocket === 'tide' ? 52 : 46;
    for (let x = 0; x < w; x++) {
      if (x > 8 && x < arenaX0 - 4 && rand() < 0.18) y += rand() < 0.5 ? -1 : 1;
      y = Math.max(pocket === 'tide' ? 48 : 40, Math.min(pocket === 'tide' ? 56 : 52, y));
      const floor = x >= arenaX0 ? arenaFloor : y;
      if (x === arenaX0) arenaFloor = y;
      surface[x] = x >= arenaX0 ? arenaFloor : floor;
      set(x, surface[x], surf);
      fillCol(x, surface[x] + 1, h, fill);
    }
    for (let x = arenaX0; x < w; x++) { surface[x] = arenaFloor; fillCol(x, 0, h, T.AIR); set(x, arenaFloor, surf); fillCol(x, arenaFloor + 1, h, fill); }
    // a ceiling for the cave realms, with a clear run height of 9+ tiles above the floor
    for (let x = 0; x < w; x++) {
      let ceil = x >= arenaX0 ? arenaFloor - 16 : Math.max(2, surface[x] - 10 - Math.floor(rand() * 4));
      if (pocket === 'tide') ceil = Math.min(ceil, 36); // headroom above the waterline and its knolls
      fillCol(x, 0, ceil, pocket === 'ember' ? T.BASALT : pocket === 'tide' ? T.CORAL : T.BONE_BRICK);
    }
    if (pocket === 'ember') {
      // lava pools in the floor: 3-5 wide, with solid ground between
      for (let x = 20; x < arenaX0 - 10; x += 16 + Math.floor(rand() * 10)) {
        const width = 3 + Math.floor(rand() * 3);
        for (let i = 0; i < width; i++) { set(x + i, surface[x + i], T.LAVA); set(x + i, surface[x + i] + 1, T.LAVA); }
      }
    }
    if (pocket === 'tide') {
      // drowned: water fills everything below the waterline, with breathing knolls rising above it
      waterTop = 44;
      // a dry landing at the entrance: nobody should arrive already holding their breath
      for (let x = 2; x <= 12; x++) { surface[x] = waterTop - 2; fillCol(x, 0, waterTop - 2, T.AIR); fillCol(x, waterTop - 2, h, T.SAND); }
      for (let x = 2; x <= 12; x++) fillCol(x, 0, 32, T.CORAL);
      for (let x = 20; x < arenaX0 - 8; x += 22 + Math.floor(rand() * 8)) {
        for (let i = 0; i < 6; i++) { surface[x + i] = waterTop - 2; fillCol(x + i, waterTop - 2, h, T.SAND); }
      }
      for (let x = 2; x < w - 2; x++) for (let y = waterTop; y < h; y++) if (tiles[y * w + x] === T.AIR) set(x, y, T.WATER);
    }
    if (pocket === 'grave') {
      for (let x = 14; x < arenaX0 - 6; x += 9 + Math.floor(rand() * 9)) set(x, surface[x] - 1, T.TOMB);
    }
  } else {
    // gale: sky islands over a void - no floor at all
    let x = 0;
    let y = 40;
    let first = true;
    while (x < arenaX0 - 6) {
      const width = first ? 14 : 7 + Math.floor(rand() * 8);
      for (let i = 0; i < width && x + i < arenaX0; i++) {
        surface[x + i] = y;
        set(x + i, y, T.CLOUD);
        fillCol(x + i, y + 1, y + 4, T.MARBLE);
      }
      x += width;
      const gap = 3 + Math.floor(rand() * 3); // 3-5 tiles: always a single jump
      for (let i = 0; i < gap; i++) surface[x + i] = h;
      x += gap;
      y = Math.max(30, Math.min(48, y + Math.floor(rand() * 7) - 3)); // at most 3 tiles up
      first = false;
    }
    arenaFloor = Math.max(30, Math.min(48, y));
    for (let gx = x; gx < arenaX0; gx++) { surface[gx] = arenaFloor; set(gx, arenaFloor, T.CLOUD); fillCol(gx, arenaFloor + 1, arenaFloor + 4, T.MARBLE); }
    for (let ax = arenaX0; ax < w; ax++) { surface[ax] = arenaFloor; set(ax, arenaFloor, T.CLOUD); fillCol(ax, arenaFloor + 1, arenaFloor + 5, T.MARBLE); }
  }

  // walls at both ends; the arena gets its own right wall
  for (const wx of [0, 1, w - 2, w - 1]) fillCol(wx, 0, h, T.SHRINE);
  // return portal at the entrance
  const entrance = { tx: 5, ty: surface[5] - 1 };
  for (let dx = 0; dx < 2; dx++) for (let dy = 1; dy <= 3; dy++) set(3 + dx, surface[5] - dy, T.PORTAL);
  for (let dx = 3; dx <= 6; dx++) { surface[dx] = surface[5]; set(dx, surface[5], T.SHRINE); }

  return { seed, w, h, tiles, surface, spawn: entrance, pocket, entrance, arena: { x0: arenaX0, x1: w - 2, floorY: arenaFloor }, waterTop };
}

export const FOREVER_W = 260;

/**
 * The Eternal Hall: the four realms back to back (see FOREVER_SEGMENTS),
 * then the throne room. Built for someone holding all four relics: lava
 * you're immune to, water you can breathe, gaps sized for a double jump.
 */
function generateForever(seed: number): PocketWorld {
  const w = FOREVER_W;
  const h = POCKET_H;
  const tiles = new Uint8Array(w * h);
  const surface = new Int16Array(w);
  const rand = rng(seed + 424242);
  const set = (x: number, y: number, id: number) => { if (x >= 0 && x < w && y >= 0 && y < h) tiles[y * w + x] = id; };
  const fillCol = (x: number, y0: number, y1: number, id: number) => { for (let y = y0; y < y1; y++) set(x, y, id); };
  const [ember, tide, gale, grave] = FOREVER_SEGMENTS;
  const arenaX0 = grave.x1 + 2;
  const arenaFloor = 48;
  const waterTop = 44;

  // ember: ash over basalt under a low ceiling, lava pools
  for (let x = ember.x0; x < ember.x1; x++) {
    surface[x] = 46;
    set(x, 46, T.ASH); fillCol(x, 47, h, T.BASALT); fillCol(x, 0, 34 + Math.floor(rand() * 3), T.BASALT);
  }
  for (let x = 14; x < ember.x1 - 6; x += 12) for (let i = 0; i < 4; i++) { set(x + i, 46, T.LAVA); set(x + i, 47, T.LAVA); }
  // tide: a drop into flooded reef, and a sand step up and out at the far end
  for (let x = tide.x0; x < tide.x1; x++) {
    const step = x >= tide.x1 - 5;
    surface[x] = step ? waterTop - 2 : 52;
    fillCol(x, 0, 32, T.CORAL);
    set(x, surface[x], T.SAND); fillCol(x, surface[x] + 1, h, T.CORAL);
    for (let y = waterTop; y < surface[x]; y++) set(x, y, T.WATER);
  }
  // gale: islands over nothing, gaps up to 6 (you have the Gale Plume by now)
  let x = gale.x0;
  let y = 40;
  // islands stop short of the crypt so the last hop always lands on the strip below its door
  while (x < gale.x1 - 14) {
    const width = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < width && x + i < gale.x1; i++) { surface[x + i] = y; set(x + i, y, T.CLOUD); fillCol(x + i, y + 1, y + 4, T.MARBLE); }
    x += width;
    const gap = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < gap && x + i < gale.x1; i++) surface[x + i] = h;
    x += gap;
    y = Math.max(34, Math.min(44, y + Math.floor(rand() * 7) - 3));
  }
  // a landing strip at the crypt door's height, open above so nothing blocks the way in
  for (let gx = Math.min(x, gale.x1 - 6); gx < gale.x1; gx++) {
    surface[gx] = 46;
    fillCol(gx, 0, 46, T.AIR);
    set(gx, 46, T.CLOUD); fillCol(gx, 47, 50, T.MARBLE);
  }
  // grave: a bone-brick corridor with tombs
  for (let gx = grave.x0; gx < arenaX0; gx++) {
    surface[gx] = 46;
    set(gx, 46, T.BONE_BRICK); fillCol(gx, 47, h, T.BONE_BRICK); fillCol(gx, 0, 36, T.BONE_BRICK);
    if (gx > grave.x0 + 6 && gx < grave.x1 - 4 && (gx - grave.x0) % 11 === 0) set(gx, 45, T.TOMB);
  }
  // the throne room: a tall obsidian hall
  for (let ax = arenaX0; ax < w; ax++) {
    surface[ax] = arenaFloor;
    fillCol(ax, 0, 24, T.OBSIDIAN); set(ax, arenaFloor, T.OBSIDIAN); fillCol(ax, arenaFloor + 1, h, T.OBSIDIAN);
  }
  // the arena floor is two rows lower than the crypt: a step down, not a wall
  for (let ax = arenaX0; ax < arenaX0 + 2; ax++) { set(ax, 46, T.AIR); set(ax, 47, T.AIR); }

  for (const wx of [0, 1, w - 2, w - 1]) fillCol(wx, 0, h, T.SHRINE);
  const entrance = { tx: 5, ty: surface[5] - 1 };
  for (let dx = 0; dx < 2; dx++) for (let dy = 1; dy <= 3; dy++) set(3 + dx, surface[5] - dy, T.PORTAL);
  for (let dx = 3; dx <= 6; dx++) set(dx, surface[5], T.SHRINE);
  // no lava under the entrance
  for (let dx = 2; dx <= 12; dx++) { set(dx, 46, T.ASH); set(dx, 47, T.BASALT); }

  return { seed, w, h, tiles, surface, spawn: entrance, pocket: 'forever', entrance, arena: { x0: arenaX0, x1: w - 2, floorY: arenaFloor }, waterTop };
}
