import { CONDUCTOR_HOVER_Y, LEVEL_WIDTH_PX, PLATFORMER_GROUND_Y } from './platformerConfig';
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

/** a spring pad resting on a surface whose top is at y */
export interface SpringDef {
  x: number;
  y: number;
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
  /** spring pads (see SPRING_VELOCITY) - one right at a pit's edge launches you across it */
  springs?: SpringDef[];
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

function spring(x: number, y = PLATFORMER_GROUND_Y): SpringDef {
  return { x, y };
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

/**
 * Introduces spring pads: one at each wide pit's edge launches you over
 * it (a normal jump can't clear 190px), and a mid-level one bounces you
 * up to a high coin row.
 */
export const LEVEL_6: LevelDef = {
  id: 'level6',
  name: 'Rooftop Relay',
  widthPx: 4000,
  groundY: GY,
  ground: [
    ground(0, 650), // start area
    ground(770, 500), // 650-770 is gap 1 (120px)
    ground(1460, 610), // 1270-1460 is gap 2 (190px) - spring launch only
    ground(2190, 700), // 2070-2190 is gap 3 (120px)
    ground(3010, 990), // 2890-3010 is gap 4 (120px)
  ],
  platforms: [
    platform(1650, GY - 105, 140), // coin perch
  ],
  movingPlatforms: [],
  springs: [spring(1248), spring(2560)],
  enemies: [
    enemySpawn('patroller', 380, GY, 180),
    enemySpawn('flyer', 1000, GY - 170, 180),
    enemySpawn('hopper', 1800, GY, 200),
    enemySpawn('spiker', 2300, GY, 140),
    enemySpawn('flyer', 2700, GY - 230, 150),
    enemySpawn('turret', 3300, GY, 0),
    enemySpawn('patroller', 3500, GY, 200),
  ],
  coins: [
    ...coinRow(120, GY - 80, 4, 50),
    ...coinRow(1290, GY - 330, 4, 45), // top of the spring arc over gap 2
    ...coinRow(1665, GY - 160, 3, 45),
    ...coinRow(2600, GY - 340, 4, 45), // bounce-only perch
    ...coinRow(3100, GY - 80, 4, 50),
  ],
  playerStart: { x: 60, y: GY },
  rivalStart: { x: 20, y: GY },
  rivalWaypoints: [
    { x: 650, jump: true }, // clear gap 1
    { x: 800, jump: false },
    { x: 1500, jump: false }, // the spring at 1248 carries it over gap 2
    { x: 2070, jump: true }, // clear gap 3
    { x: 2250, jump: false },
    { x: 2890, jump: true }, // clear gap 4
    { x: 3050, jump: false },
    { x: 3880, jump: false },
  ],
  goalX: 3880,
  goalY: GY,
  rewardPogId: 'skyline',
};

/** A long gauntlet: every enemy type, two spring-only pits, three jump pits. */
export const LEVEL_7: LevelDef = {
  id: 'level7',
  name: 'Night Circuit',
  widthPx: 4400,
  groundY: GY,
  ground: [
    ground(0, 600), // start area
    ground(720, 560), // 600-720 is gap 1 (120px)
    ground(1460, 700), // 1280-1460 is gap 2 (180px) - spring launch only
    ground(2290, 600), // 2160-2290 is gap 3 (130px)
    ground(3080, 700), // 2890-3080 is gap 4 (190px) - spring launch only
    ground(3900, 500), // 3780-3900 is gap 5 (120px)
  ],
  platforms: [
    platform(1750, GY - 105, 120), // coin perch above the spiker lane
  ],
  movingPlatforms: [movingPlatform(3300, GY - 105, 90, 200, 60)],
  springs: [spring(1258), spring(2868)],
  enemies: [
    enemySpawn('hopper', 850, GY, 200),
    enemySpawn('turret', 1000, GY, 0),
    enemySpawn('spiker', 1600, GY, 200),
    enemySpawn('flyer', 1950, GY - 170, 200),
    enemySpawn('patroller', 2400, GY, 180),
    enemySpawn('hopper', 2650, GY, 150),
    enemySpawn('flyer', 3000, GY - 260, 120),
    enemySpawn('turret', 3450, GY, 0),
    enemySpawn('spiker', 3550, GY, 180),
    enemySpawn('hopper', 4050, GY, 150),
  ],
  coins: [
    ...coinRow(120, GY - 80, 4, 50),
    ...coinRow(1300, GY - 330, 3, 45),
    ...coinRow(1765, GY - 160, 3, 40),
    ...coinRow(2350, GY - 80, 4, 50),
    ...coinRow(2910, GY - 330, 3, 45),
    ...coinRow(3320, GY - 160, 3, 40), // ride the moving platform
    ...coinRow(4000, GY - 80, 4, 50),
  ],
  playerStart: { x: 60, y: GY },
  rivalStart: { x: 20, y: GY },
  rivalWaypoints: [
    { x: 600, jump: true }, // clear gap 1
    { x: 760, jump: false },
    { x: 1500, jump: false }, // spring at 1258 over gap 2
    { x: 2160, jump: true }, // clear gap 3
    { x: 2330, jump: false },
    { x: 3120, jump: false }, // spring at 2868 over gap 4
    { x: 3780, jump: true }, // clear gap 5
    { x: 3940, jump: false },
    { x: 4280, jump: false },
  ],
  goalX: 4280,
  goalY: GY,
  rewardPogId: 'nightowl',
};

/** Second boss arena: two low ledges to hop onto while shockwaves pass under. */
export const LEVEL_8: LevelDef = {
  id: 'level8',
  name: 'Summit Slam',
  widthPx: 2600,
  groundY: GY,
  bossLevel: true,
  ground: [
    ground(0, 500), // intro
    ground(620, 1900), // 500-620 is a warm-up gap; 620-2520 is the arena
  ],
  platforms: [
    platform(900, GY - 105, 120),
    platform(1760, GY - 105, 120),
  ],
  movingPlatforms: [],
  enemies: [
    enemySpawn('hopper', 250, GY, 150),
    enemySpawn('slammer', 1100, GY, 1300), // leaps anywhere in 1100-2400
  ],
  coins: [
    ...coinRow(120, GY - 80, 4, 50),
    ...coinRow(915, GY - 160, 3, 40),
    ...coinRow(1775, GY - 160, 3, 40),
  ],
  playerStart: { x: 60, y: GY },
  rewardPogId: 'summitcrown',
};

export const LEVEL_9: LevelDef = {
  ...LEVEL_8,
  id: 'level9',
  name: 'Co-op Summit',
  coop: true,
  paceMultiplier: 0.7,
  player2Start: { x: 150, y: GY },
  rewardPogId: 'ropeteam',
};

/** Haunted race: chasers guard the flats, ghosts fade in and out, droppers bomb the lanes. */
export const LEVEL_10: LevelDef = {
  id: 'level10',
  name: 'Midnight Mansion',
  widthPx: 4200,
  groundY: GY,
  ground: [
    ground(0, 600), // start area
    ground(720, 700), // 600-720 is gap 1 (120px)
    ground(1550, 650), // 1420-1550 is gap 2 (130px)
    ground(2390, 800), // 2200-2390 is gap 3 (190px) - spring launch only
    ground(3310, 890), // 3190-3310 is gap 4 (120px)
  ],
  platforms: [
    platform(1620, GY - 105, 110), // hop-over spot for the ghost hall
    platform(2600, GY - 105, 120),
  ],
  movingPlatforms: [],
  springs: [spring(2178)],
  enemies: [
    enemySpawn('chaser', 850, GY, 400),
    enemySpawn('dropper', 1050, GY - 170, 300),
    enemySpawn('ghost', 1700, GY - 90, 350),
    enemySpawn('chaser', 1800, GY, 300),
    enemySpawn('dropper', 2500, GY - 170, 350),
    enemySpawn('ghost', 2900, GY - 90, 220),
    enemySpawn('chaser', 3400, GY, 450),
    enemySpawn('hopper', 3900, GY, 150),
  ],
  coins: [
    ...coinRow(120, GY - 80, 4, 50),
    ...coinRow(900, GY - 80, 4, 60), // chaser bait
    ...coinRow(1635, GY - 160, 3, 40),
    ...coinRow(2200, GY - 330, 4, 45), // spring arc
    ...coinRow(2615, GY - 160, 3, 40),
    ...coinRow(3500, GY - 80, 5, 60),
  ],
  playerStart: { x: 60, y: GY },
  rivalStart: { x: 20, y: GY },
  rivalWaypoints: [
    { x: 600, jump: true }, // clear gap 1
    { x: 760, jump: false },
    { x: 1420, jump: true }, // clear gap 2
    { x: 1590, jump: false },
    { x: 2430, jump: false }, // spring at 2178 over gap 3
    { x: 3190, jump: true }, // clear gap 4
    { x: 3350, jump: false },
    { x: 4080, jump: false },
  ],
  goalX: 4080,
  goalY: GY,
  rewardPogId: 'candle',
};

/**
 * Third boss arena. The Storm Conductor hovers out of jump reach, so the
 * two springs are there on purpose: a launch can stomp it mid-air.
 */
export const LEVEL_11: LevelDef = {
  id: 'level11',
  name: 'Thunder Peak',
  widthPx: 2600,
  groundY: GY,
  bossLevel: true,
  ground: [
    ground(0, 500), // intro
    ground(620, 1900), // 500-620 is a warm-up gap; 620-2520 is the arena
  ],
  platforms: [
    platform(1560, GY - 105, 120), // cover from bolts, sort of
  ],
  movingPlatforms: [],
  springs: [spring(1150), spring(2050)],
  enemies: [
    enemySpawn('chaser', 200, GY, 250),
    enemySpawn('conductor', 1000, CONDUCTOR_HOVER_Y, 1300), // tracks you anywhere in 1000-2300
  ],
  coins: [
    ...coinRow(120, GY - 80, 4, 50),
    ...coinRow(1110, GY - 330, 3, 40),
    ...coinRow(2010, GY - 330, 3, 40),
  ],
  playerStart: { x: 60, y: GY },
  rewardPogId: 'stormcell',
};

export const LEVEL_12: LevelDef = {
  ...LEVEL_11,
  id: 'level12',
  name: 'Co-op Storm',
  coop: true,
  paceMultiplier: 0.7,
  player2Start: { x: 150, y: GY },
  rewardPogId: 'lightningrod',
};

/**
 * Play order; ids (not indexes) are what saves key off. Solo levels run
 * contiguously and co-op levels sit at the end, so NEXT never has to
 * skip over one.
 */
export const LEVELS: LevelDef[] = [
  LEVEL_1, LEVEL_2, LEVEL_5, LEVEL_3, LEVEL_6, LEVEL_7, LEVEL_8, LEVEL_10, LEVEL_11,
  LEVEL_4, LEVEL_9, LEVEL_12,
];

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
  const springs = level.springs ?? [];
  let widest = 0;
  for (let i = 0; i + 1 < segs.length; i++) {
    const left = segs[i].x + segs[i].width;
    const right = segs[i + 1].x;
    // a spring pad right at the edge launches you across (proven by the rival race test, not by formula)
    const bridged = bridges.some((b) => b.x < right && b.x + b.width > left) || springs.some((s) => s.x <= left && s.x >= left - 40);
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
