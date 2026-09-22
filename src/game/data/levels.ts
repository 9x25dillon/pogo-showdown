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
  /** pog granted on the first clear (see questRepository.recordQuestRun) */
  rewardPogId?: string;
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
    ground(2400, 800), // 2200-2400 is a pit, spanned by a low stepping stone
  ],
  platforms: [
    platform(1480, GY - 110, 90), // stepping stone across gap 2
    // Stepping stone across the C -> D pit. Set 50px past the ledge and only
    // 60px up so a jump from the edge clears its corner - a higher stone
    // flush with the ledge sits right above a standing player's head and
    // bonks every jump.
    platform(2250, GY - 60, 110),
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
    { x: 2200, jump: true }, // across the pit via the stepping stone
    { x: 2400, jump: false },
    { x: 3100, jump: false },
  ],
  goalX: 3100,
  goalY: GY,
  rewardPogId: 'flagpole',
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
  rewardPogId: 'sprinter',
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
  rewardPogId: 'champbelt',
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
  rewardPogId: 'highfive',
};

/**
 * Third race level: introduces hoppers, a spiker you can't stomp (go
 * over it via the platform, or blast it with an item), and pellet
 * turrets. Id is `level5` because ids are save keys - it was authored
 * after the boss and co-op levels but plays before them.
 */
export const LEVEL_5: LevelDef = {
  id: 'level5',
  name: 'Tech Park Tangle',
  widthPx: 3800,
  groundY: GY,
  ground: [
    ground(0, 600), // start area
    ground(720, 520), // 600-720 is gap 1 (120px)
    ground(1360, 700), // 1240-1360 is gap 2 (120px)
    ground(2190, 800), // 2060-2190 is gap 3 (130px)
    ground(3110, 690), // 2990-3110 is gap 4 (120px)
  ],
  platforms: [
    platform(960, GY - 130, 140), // route over the spiker
    platform(1560, GY - 120, 100),
    platform(1720, GY - 220, 100), // coin perch above the turret lane
  ],
  movingPlatforms: [movingPlatform(2440, GY - 150, 90, 180, 55)],
  enemies: [
    enemySpawn('hopper', 380, GY, 160),
    enemySpawn('spiker', 900, GY, 220),
    enemySpawn('hopper', 1450, GY, 220),
    enemySpawn('turret', 1950, GY, 0),
    enemySpawn('flyer', 2400, GY - 170, 220),
    enemySpawn('spiker', 2600, GY, 160),
    enemySpawn('hopper', 2800, GY, 150),
    enemySpawn('turret', 3420, GY, 0),
  ],
  coins: [
    ...coinRow(120, GY - 80, 4, 50),
    ...coinRow(620, GY - 170, 3, 40), // arc over gap 1
    ...coinRow(990, GY - 180, 3, 40), // on the spiker route
    ...coinRow(1735, GY - 270, 2, 40),
    ...coinRow(2460, GY - 200, 3, 40), // ride the moving platform
    ...coinRow(3160, GY - 80, 4, 50),
  ],
  playerStart: { x: 60, y: GY },
  rivalStart: { x: 20, y: GY },
  rivalWaypoints: [
    { x: 600, jump: true }, // clear gap 1
    { x: 800, jump: false },
    { x: 1240, jump: true }, // clear gap 2
    { x: 1400, jump: false },
    { x: 2060, jump: true }, // clear gap 3
    { x: 2250, jump: false },
    { x: 2990, jump: true }, // clear gap 4
    { x: 3150, jump: false },
    { x: 3700, jump: false },
  ],
  goalX: 3700,
  goalY: GY,
  rewardPogId: 'gearwheel',
};

/** play order; ids (not indexes) are what saves key off */
export const LEVELS: LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_5, LEVEL_3, LEVEL_4];

/**
 * Widest pit between ground segments that no reachable platform spans -
 * these must stay within jumpReach() or the level is unwinnable. A
 * platform only counts as a bridge if its top is low enough to land on
 * from the ground (`maxClimbPx`, i.e. a bit under the jump's peak).
 */
export function largestUnbridgedGap(level: LevelDef, maxClimbPx = Infinity): number {
  const segs = [...level.ground].sort((a, b) => a.x - b.x);
  const bridges = [...level.platforms, ...level.movingPlatforms.map((m) => ({ ...m, width: m.width + m.rangeX }))]
    .filter((b) => level.groundY - b.y <= maxClimbPx);
  let widest = 0;
  for (let i = 0; i + 1 < segs.length; i++) {
    const left = segs[i].x + segs[i].width;
    const right = segs[i + 1].x;
    const bridged = bridges.some((b) => b.x < right && b.x + b.width > left);
    if (!bridged) widest = Math.max(widest, right - left);
  }
  return widest;
}

/** solo players never get routed into a co-op level */
export function nextSoloLevelIndex(fromIndex: number): number | undefined {
  for (let i = fromIndex + 1; i < LEVELS.length; i++) {
    if (!LEVELS[i].coop) return i;
  }
  return undefined;
}
