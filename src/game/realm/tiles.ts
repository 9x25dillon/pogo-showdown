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
  // Phase 2: portal realms
  BASALT: 13,
  ASH: 14,
  LAVA: 15, // not solid: burns on contact
  SAND: 16,
  CORAL: 17,
  WATER: 18, // not solid: swim, and hold your breath
  CLOUD: 19,
  MARBLE: 20,
  BONE_BRICK: 21,
  TOMB: 22,
  PORTAL: 23, // not solid: stand in it and press down
  SHRINE: 24, // unbreakable shrine and realm-wall stone
  // Phase 3: the Forever Gate
  GATE: 25, // sealed: solid until all four relics are held
  ETERNAL: 26, // the opened gate / the Hall's portals: stand in it and press down
  OBSIDIAN: 27, // the Eternal Hall's throne-room stone
  FOUNDRY_WALL: 28,
  FOUNDRY_GATE: 29,
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
  [T.FOUNDRY_WALL]: { name: 'Foundry masonry', solid: true, hardness: Infinity, minPick: 99, color: [0x263b46, 0x536b70] },
  [T.FOUNDRY_GATE]: { name: 'Pressure seal', solid: true, hardness: Infinity, minPick: 99, color: [0x59432d, 0xe5b55c] },
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
  [T.BASALT]: { name: 'Basalt', solid: true, hardness: 700, minPick: 0, drop: 'stone', color: [0x2b2226, 0x4a3a3f] },
  [T.ASH]: { name: 'Ash', solid: true, hardness: 260, minPick: 0, drop: 'dirt', color: [0x3f3a3a, 0x6b5f5c] },
  [T.LAVA]: { name: 'Lava', solid: false, hardness: Infinity, minPick: 99, light: 70, color: [0xc2410c, 0xfbbf24] },
  [T.SAND]: { name: 'Sand', solid: true, hardness: 220, minPick: 0, drop: 'dirt', color: [0xa8905c, 0xd6c08a] },
  [T.CORAL]: { name: 'Reef Rock', solid: true, hardness: 500, minPick: 0, drop: 'stone', color: [0x2a1a2e, 0x6b2f4a] },
  [T.WATER]: { name: 'Water', solid: false, hardness: Infinity, minPick: 99, color: [0x1e40af, 0x3b82f6] },
  [T.CLOUD]: { name: 'Cloudstone', solid: true, hardness: 300, minPick: 0, color: [0xcbd5e1, 0xf8fafc] },
  [T.MARBLE]: { name: 'Marble', solid: true, hardness: 800, minPick: 0, drop: 'stone', color: [0x94a3b8, 0xe2e8f0] },
  [T.BONE_BRICK]: { name: 'Bone Brick', solid: true, hardness: 900, minPick: 0, drop: 'bone', color: [0x3a3530, 0x78716c] },
  [T.TOMB]: { name: 'Tomb', solid: true, hardness: 1200, minPick: 1, drop: 'dust', color: [0x292524, 0x57534e] },
  [T.PORTAL]: { name: 'Portal', solid: false, hardness: Infinity, minPick: 99, light: 110, color: [0x4c1d95, 0xe879f9] },
  [T.SHRINE]: { name: 'Shrine Stone', solid: true, hardness: Infinity, minPick: 99, color: [0x1f1a2e, 0x3f3560] },
  [T.GATE]: { name: 'The Forever Gate', solid: true, hardness: Infinity, minPick: 99, color: [0x0f0a18, 0xfacc15] },
  [T.ETERNAL]: { name: 'Eternal Gateway', solid: false, hardness: Infinity, minPick: 99, light: 150, color: [0x111827, 0xfde68a] },
  [T.OBSIDIAN]: { name: 'Obsidian', solid: true, hardness: Infinity, minPick: 99, color: [0x0c0a14, 0x2e1065] },
};

/** tiles you're *in* rather than standing on */
export const LIQUIDS: number[] = [T.LAVA, T.WATER];

export const SOLID_TILES = Object.entries(TILE_INFO).filter(([, t]) => t.solid).map(([id]) => Number(id));

export function isSolid(id: number): boolean {
  return !!TILE_INFO[id]?.solid;
}
