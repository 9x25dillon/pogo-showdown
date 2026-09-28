import { CIRCUIT_ROSTER, type CircuitPro } from '../data/circuitRoster';
import type { ItemId } from './items';
import type { PocketWorld } from './pocketGen';
import type { RealmEnemyId } from './realmEnemies';
import { isSolid, T } from './tiles';
import type { World } from './worldGen';

/**
 * The Circuit, in the world: a colosseum east of the shrine where the
 * eleven pros each run a sixty-second bout of their own design. Waves pour
 * in from both gates; every kill scores the creature's toughness times
 * your style combo. Beat the pro's mark before the clock runs out.
 *
 * The ladder goes weakest to strongest; each win opens the next pro.
 * Bouts are real fights: dying loses the bout and costs the usual half of
 * your unbanked XP. Winning banks it.
 *
 * Showboat (risk/reward): the pro's mark is 30% higher, but a win pays
 * double XP and materials.
 * Rewards: first win over each pro pays a Tech Point and more XP; beating
 * Bruce L. makes you Circuit Champion.
 */
export const BOUT_MS = 60_000;
export const COUNTDOWN_MS = 3000;
export const SHOWBOAT_TARGET = 1.3;

export interface ProRule {
  title: string;
  blurb: string;
  enemies: RealmEnemyId[];
  spawnMs: number;
  hpMult: number;
  damageMult: number;
  speedMult: number;
  /** lightning from the rafters every n ms */
  bolts?: number;
  /** the arena lights go down */
  dark?: boolean;
  /** guard pips are disabled for the bout */
  noGuard?: boolean;
  /** kills drop double materials */
  plunder?: boolean;
}

export const PRO_RULES: Record<string, ProRule> = {
  elizabeth: { title: 'Royal Guard', blurb: 'slow, armored knights', enemies: ['knight'], spawnMs: 3400, hpMult: 1, damageMult: 1, speedMult: 0.9 },
  earhart: { title: 'Open Skies', blurb: 'harpies and wraiths from above', enemies: ['harpy', 'wraith'], spawnMs: 2400, hpMult: 1, damageMult: 1, speedMult: 1 },
  napoleon: { title: 'Grande Armée', blurb: 'crawlers, in columns', enemies: ['crawler'], spawnMs: 1500, hpMult: 0.9, damageMult: 1, speedMult: 1.1 },
  tesla: { title: 'Alternating Current', blurb: 'slimes, and lightning from the rafters', enemies: ['slime', 'slime', 'crawler'], spawnMs: 1800, hpMult: 1.1, damageMult: 1, speedMult: 1, bolts: 1600 },
  curie: { title: 'The Glow', blurb: 'wraiths in the dark', enemies: ['wraith'], spawnMs: 1900, hpMult: 1.2, damageMult: 1.1, speedMult: 1, dark: true },
  nefertiti: { title: 'Gilded Court', blurb: 'everything, gilded: +60% health', enemies: ['crawler', 'imp', 'knight'], spawnMs: 2300, hpMult: 1.6, damageMult: 1, speedMult: 1 },
  hannibal: { title: 'Over the Alps', blurb: 'knights and crawlers that hit 30% harder', enemies: ['knight', 'crawler', 'crawler'], spawnMs: 2000, hpMult: 1.2, damageMult: 1.3, speedMult: 1 },
  tubman: { title: 'Underground Railroad', blurb: 'fast imps, faster than you think', enemies: ['imp', 'imp', 'slime'], spawnMs: 1600, hpMult: 1.2, damageMult: 1.1, speedMult: 1.4 },
  chingshih: { title: 'Plunder', blurb: 'imps and harpies, double loot', enemies: ['imp', 'harpy'], spawnMs: 1500, hpMult: 1.3, damageMult: 1.2, speedMult: 1.15, plunder: true },
  musashi: { title: 'Two Swords', blurb: 'knights, and no guard pips', enemies: ['knight', 'knight', 'wraith'], spawnMs: 1800, hpMult: 1.4, damageMult: 1.3, speedMult: 1.1, noGuard: true },
  brucelee: { title: 'The Storm', blurb: 'everything, all at once, lightning included', enemies: ['knight', 'imp', 'harpy', 'crawler', 'wraith'], spawnMs: 1100, hpMult: 1.5, damageMult: 1.4, speedMult: 1.2, bolts: 1400 },
};

export function ladder(): CircuitPro[] {
  return [...CIRCUIT_ROSTER].sort((a, b) => a.skill - b.skill);
}

/** the pro's mark: kill points they'd put up in sixty seconds */
export function proTarget(skill: number, showboat: boolean): number {
  return Math.round((500 + (skill - 85) * 110) * (showboat ? SHOWBOAT_TARGET : 1));
}

/** one kill: the creature's (boosted) toughness, times your style combo */
export function killPoints(hp: number, comboMult: number): number {
  return Math.round(hp * comboMult);
}

export function boutRewards(skill: number, first: boolean, showboat: boolean): { xp: number; items: Partial<Record<ItemId, number>> } {
  const m = showboat ? 2 : 1;
  const tier = skill - 85;
  return {
    xp: Math.round((first ? 120 + tier * 25 : 40 + tier * 5) * m),
    items: tier >= 8 ? { soulstone: (first ? 6 : 2) * m, potion: 2 * m } : tier >= 4 ? { iron: (first ? 8 : 3) * m, potion: m } : { copper: (first ? 10 : 4) * m, potion: m },
  };
}

export const ARENA_W = 90;
export const ARENA_H = 44;
export const ARENA_FLOOR = 34;

/** The colosseum: a walled floor, three platforms, a return portal by the entrance. */
export function generateArena(seed: number): PocketWorld {
  const w = ARENA_W, h = ARENA_H, floor = ARENA_FLOOR;
  const tiles = new Uint8Array(w * h);
  const surface = new Int16Array(w).fill(floor);
  const set = (x: number, y: number, id: number) => { if (x >= 0 && x < w && y >= 0 && y < h) tiles[y * w + x] = id; };
  for (let x = 0; x < w; x++) {
    for (let y = floor; y < h; y++) set(x, y, y >= h - 2 ? T.BEDROCK : T.SHRINE);
    for (let y = 0; y < 4; y++) set(x, y, T.SHRINE);
  }
  for (let y = 0; y < floor; y++) { set(0, y, T.SHRINE); set(1, y, T.SHRINE); set(w - 1, y, T.SHRINE); set(w - 2, y, T.SHRINE); }
  // the players' tunnel: a low wall separates the entrance from the sand
  for (let y = floor - 12; y < floor - 5; y++) set(12, y, T.SHRINE);
  for (let dx = 0; dx < 2; dx++) for (let dy = 1; dy <= 3; dy++) set(4 + dx, floor - dy, T.PORTAL);
  const platform = (x0: number, x1: number, y: number) => { for (let x = x0; x < x1; x++) set(x, y, T.MARBLE); };
  platform(26, 36, floor - 6);
  platform(62, 72, floor - 6);
  platform(43, 55, floor - 11);
  return { seed, w, h, tiles, surface, spawn: { tx: 8, ty: floor - 1 }, pocket: 'arena', entrance: { tx: 8, ty: floor - 1 }, arena: { x0: 14, x1: w - 3, floorY: floor } };
}

/** where the colosseum gate stands in the overworld: clear ground east of the shrine */
export function findArenaGate(world: World, occupied: (x: number, y: number) => boolean): { tx: number; ty: number } {
  const tile = (x: number, y: number) => world.tiles[y * world.w + x];
  const preferred = world.spawn.tx + 56;
  for (let offset = 0; offset < 40; offset++) {
    for (const tx of [preferred + offset, preferred - offset]) {
      if (tx < 4 || tx > world.w - 8) continue;
      for (let floor = Math.max(5, world.surface[tx] - 6); floor < Math.min(world.h - 4, world.surface[tx] + 8); floor++) {
        let clear = true;
        for (let dx = 0; dx < 4; dx++) {
          if (!isSolid(tile(tx + dx, floor))) clear = false;
          for (let dy = 1; dy <= 5; dy++) if (tile(tx + dx, floor - dy) !== T.AIR || occupied(tx + dx, floor - dy)) clear = false;
        }
        if (clear) return { tx, ty: floor - 1 };
      }
    }
  }
  return { tx: preferred, ty: world.surface[preferred] - 1 };
}
