import type { ItemId } from './items';

/**
 * Forever Realm tile ids. 0 is air. Ids are stored in saves, so never
 * renumber - only append.
 */
export const T = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4, // placed planks
  COPPER: 5,
  IRON: 6,
  SOULSTONE: 7,
  BEDROCK: 8,
  TRUNK: 9,
  LEAVES: 10,
  TORCH: 11,
  HERB: 12,
} as const;
export type TileId = (typeof T)[keyof typeof T];

export interface TileInfo {
  name: string;
  /** blocks movement */
  solid: boolean;
  /** ms to mine with the starting pickaxe; Infinity = unbreakable */
  hardness: number;
  /** pickaxe tier needed to mine it at all */
  minPick: number;
  drop?: ItemId;
  /** light radius in px (torches) */
  light?: number;
  /** tileset colors: base, highlight */
  color: [number, number];
}

export const TILE_INFO: Record<number, TileInfo> = {
  [T.GRASS]: { name: 'Grass', solid: true, hardness: 260, minPick: 0, drop: 'dirt', color: [0x4a3424, 0x4ade80] },
  [T.DIRT]: { name: 'Dirt', solid: true, hardness: 240, minPick: 0, drop: 'dirt', color: [0x5b3f2a, 0x6f4e35] },
  [T.STONE]: { name: 'Stone', solid: true, hardness: 620, minPick: 0, drop: 'stone', color: [0x4b4f5c, 0x6b7080] },
  [T.WOOD]: { name: 'Wood', solid: true, hardness: 320, minPick: 0, drop: 'wood', color: [0x7c5230, 0xa0703f] },
  [T.COPPER]: { name: 'Copper Ore', solid: true, hardness: 850, minPick: 0, drop: 'copper', color: [0x4b4f5c, 0xd97745] },
  [T.IRON]: { name: 'Iron Ore', solid: true, hardness: 1150, minPick: 1, drop: 'iron', color: [0x4b4f5c, 0xc8ced8] },
  [T.SOULSTONE]: { name: 'Soulstone', solid: true, hardness: 1600, minPick: 2, drop: 'soulstone', color: [0x2a1030, 0xe11d48] },
  [T.BEDROCK]: { name: 'Bedrock', solid: true, hardness: Infinity, minPick: 99, color: [0x111018, 0x23202e] },
  [T.TRUNK]: { name: 'Tree', solid: false, hardness: 380, minPick: 0, drop: 'wood', color: [0x5a3a1e, 0x7a5230] },
  [T.LEAVES]: { name: 'Leaves', solid: false, hardness: 60, minPick: 0, color: [0x14532d, 0x22804a] },
  [T.TORCH]: { name: 'Torch', solid: false, hardness: 40, minPick: 0, drop: 'torch', light: 130, color: [0x000000, 0xfbbf24] },
  [T.HERB]: { name: 'Nightbloom', solid: false, hardness: 40, minPick: 0, drop: 'herb', color: [0x000000, 0xa78bfa] },
};

export const SOLID_TILES = Object.entries(TILE_INFO).filter(([, t]) => t.solid).map(([id]) => Number(id));

export function isSolid(id: number): boolean {
  return !!TILE_INFO[id]?.solid;
}
