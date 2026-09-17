import { LEVEL_WIDTH_PX, PLATFORMER_GROUND_Y } from './platformerConfig';

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
  type: 'patroller';
  x: number;
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
  rivalStart: { x: number; y: number };
  rivalWaypoints: RivalWaypoint[];
  goalX: number;
  goalY: number;
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

function enemySpawn(x: number, y: number, rangeX: number): EnemySpawnDef {
  return { type: 'patroller', x, y, rangeX };
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
  enemies: [enemySpawn(400, GY, 140), enemySpawn(1900, GY, 160)],
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

export const LEVELS: LevelDef[] = [LEVEL_1];
