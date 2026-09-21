import { LEVEL_WIDTH_PX, PLATFORMER_GROUND_Y } from './platformerConfig';
import type { PlatformerEnemyType } from './platformerEnemies';

export interface GroundSegment {
  x: number;
  width: number;
}

export interface PlatformDef {
  x: number;
  y: number;
  width: number;
}

export interface MovingPlatformDef extends PlatformDef {
  /** how far right of x the platform travels before reversing */
  rangeX: number;
  speed: number;
}

export interface EnemySpawnDef {
  type: PlatformerEnemyType;
  x: number;
  /** ground contact point for a patroller; hover center height for a flyer */
  y: number;
  rangeX: number;
}

export interface CoinDef {
  x: number;
  y: number;
}

/** a rival AI target: hold toward x, and press jump on arrival if `jump` is set */
export interface RivalWaypoint {
  x: number;
  jump: boolean;
}

export interface LevelDef {
  id: string;
  name: string;
  widthPx: number;
  groundY: number;
  /** solid ground rectangles - gaps between them are pits */
  ground: GroundSegment[];
  platforms: PlatformDef[];
  movingPlatforms: MovingPlatformDef[];
  enemies: EnemySpawnDef[];
  coins: CoinDef[];
  playerStart: { x: number; y: number };
  /**
   * A boss level has no rival to race and no goal flag: the win
   * condition is defeating the boss enemy (an EnemySpawnDef of type
   * 'boss' in `enemies`) instead.
   */
  bossLevel?: boolean;
  /**
   * Co-op: a second human-controlled player joins at this spawn point
   * (arrow keys), sharing the lives pool with player one (WASD). Not
   * an AI rival - no stomp-combat between them, no race. Implies
   * `coop: true`; `paceMultiplier` (default 1) scales enemy/boss speed
   * down for the slower, more forgiving two-player pace.
   */
  player2Start?: { x: number; y: number };
  coop?: boolean;
  paceMultiplier?: number;
  rivalStart?: { x: number; y: number };
  rivalWaypoints?: RivalWaypoint[];
  goalX?: number;
  goalY?: number;
}

function ground(x: number, width: number): GroundSegment {
  return { x, width };
}

function platform(x: number, y: number, width: number): PlatformDef {
  return { x, y, width };
}

function movingPlatform(x: number, y: number, width: number, rangeX: number, speed: number): MovingPlatformDef {
  return { x, y, width, rangeX, speed };
}

function enemySpawn(type: PlatformerEnemyType, x: number, y: number, rangeX: number): EnemySpawnDef {
  return { type, x, y, rangeX };
}

function coinRow(startX: number, y: number, count: number, gap: number): CoinDef[] {
  return Array.from({ length: count }, (_, i) => ({ x: startX + i * gap, y }));
}

const GY = PLATFORMER_GROUND_Y;

export const LEVEL_1: LevelDef = {
  id: 'level1',
  name: 'Footpeg Flats',
  widthPx: LEVEL_WIDTH_PX,
  groundY: GY,
  ground: [
    ground(0, 700), // start area
    ground(830, 570), // 700-830 is gap 1 (130px)
    ground(1560, 640), // 1400-1560 is gap 2 (160px), spanned by a stepping-stone platform
    ground(2400, 800), // 2200-2400 is a raised-ledge section, not a pit
  ],
  platforms: [
    platform(1480, GY - 110, 90), // stepping stone across gap 2
    platform(2220, GY - 130, 160), // raised ledge over ground C -> D transition
  ],
  movingPlatforms: [movingPlatform(1000, GY - 90, 90, 220, 60)],
  enemies: [
    enemySpawn('patroller', 400, GY, 140),
    enemySpawn('patroller', 1900, GY, 160),
    enemySpawn('flyer', 2550, GY - 160, 200),
  ],
  coins: [
    ...coinRow(120, GY - 80, 5, 50),
    ...coinRow(870, GY - 80, 3, 50),
    ...coinRow(1620, GY - 80, 4, 50),
    ...coinRow(2450, GY - 200, 3, 50),
    ...coinRow(2900, GY - 80, 4, 50),
  ],
  playerStart: { x: 60, y: GY },
  rivalStart: { x: 20, y: GY },
  rivalWaypoints: [
    { x: 700, jump: true }, // clear gap 1
    { x: 900, jump: false },
    { x: 1400, jump: true }, // hop the stepping stone across gap 2
    { x: 1560, jump: true },
    { x: 1900, jump: false },
    { x: 2200, jump: true }, // up onto the raised ledge
    { x: 2400, jump: false },
    { x: 3100, jump: false },
  ],
  goalX: 3100,
  goalY: GY,
};

export const LEVEL_2: LevelDef = {
  id: 'level2',
  name: 'Signature Sprint',
  widthPx: 3500,
  groundY: GY,
  ground: [
    ground(0, 500), // start area
    ground(650, 450), // 500-650 is gap 1 (150px)
    ground(1280, 500), // 1100-1280 is gap 2 (180px), spanned by a stepping-stone platform
    ground(1900, 400), // 1780-1900 is gap 3 (120px)
    ground(2480, 900), // 2300-2480 is gap 4 (180px), spanned by a moving platform
  ],
  platforms: [
    platform(1170, GY - 110, 80), // stepping stone across gap 2
  ],
  movingPlatforms: [movingPlatform(2320, GY - 90, 90, 140, 75)],
  enemies: [
    enemySpawn('patroller', 300, GY, 120),
    enemySpawn('flyer', 900, GY - 170, 220),
    enemySpawn('patroller', 2020, GY, 160),
    enemySpawn('flyer', 2700, GY - 150, 220),
  ],
  coins: [
    ...coinRow(120, GY - 80, 4, 50),
    ...coinRow(700, GY - 80, 3, 50),
    ...coinRow(1320, GY - 80, 4, 50),
    ...coinRow(1950, GY - 200, 3, 50),
    ...coinRow(2550, GY - 80, 3, 50),
    ...coinRow(3050, GY - 80, 4, 50),
  ],
  playerStart: { x: 60, y: GY },
  rivalStart: { x: 20, y: GY },
  rivalWaypoints: [
    { x: 500, jump: true }, // clear gap 1
    { x: 700, jump: false },
    { x: 1100, jump: true }, // hop the stepping stone across gap 2
    { x: 1280, jump: true },
    { x: 1780, jump: true }, // clear gap 3
    { x: 1900, jump: false },
    { x: 2300, jump: true }, // clear gap 4 (moving platform lands them close enough)
    { x: 2480, jump: false },
    { x: 3300, jump: false },
  ],
  goalX: 3300,
  goalY: GY,
};

export const LEVEL_3: LevelDef = {
  id: 'level3',
  name: 'Circuit Showdown',
  widthPx: 2400,
  groundY: GY,
  bossLevel: true,
  ground: [
    ground(0, 500), // intro
    ground(620, 1600), // 500-620 is a warm-up gap; 620-2220 is the flat boss arena
  ],
  platforms: [],
  movingPlatforms: [],
  enemies: [
    enemySpawn('patroller', 250, GY, 120),
    enemySpawn('boss', 1000, GY, 800), // patrols 1000-1800 inside the arena
  ],
  coins: [
    ...coinRow(120, GY - 80, 4, 50),
    ...coinRow(700, GY - 80, 3, 50),
  ],
  playerStart: { x: 60, y: GY },
};

export const LEVEL_4: LevelDef = {
  id: 'level4',
  name: 'Co-op Circuit',
  widthPx: 2400,
  groundY: GY,
  bossLevel: true,
  coop: true,
  paceMultiplier: 0.65,
  ground: [
    ground(0, 500),
    ground(620, 1600),
  ],
  platforms: [],
  movingPlatforms: [],
  enemies: [
    enemySpawn('patroller', 300, GY, 140),
    enemySpawn('boss', 1000, GY, 800),
  ],
  coins: [
    ...coinRow(120, GY - 80, 4, 50),
    ...coinRow(700, GY - 80, 3, 50),
  ],
  playerStart: { x: 60, y: GY },
  player2Start: { x: 150, y: GY },
};

export const LEVELS: LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];
