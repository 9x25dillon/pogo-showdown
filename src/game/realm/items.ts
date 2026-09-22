import { T, type TileId } from './tiles';

/** Everything that stacks in the inventory. Saved by name, so ids are stable strings. */
export type ItemId =
  | 'dirt' | 'stone' | 'wood' | 'copper' | 'iron' | 'soulstone'
  | 'gel' | 'bone' | 'ecto' | 'herb' | 'torch' | 'potion'
  // Phase 2: realm materials and alchemy brews
  | 'ember' | 'pearl' | 'feather' | 'dust'
  | 'fireward' | 'gills' | 'gale' | 'tonic'
  | 'bed' | 'chest' | 'campfire';

export const ITEM_NAME: Record<ItemId, string> = {
  dirt: 'Dirt', stone: 'Stone', wood: 'Wood', copper: 'Copper Ore', iron: 'Iron Ore', soulstone: 'Soulstone',
  gel: 'Gloom Gel', bone: 'Bone', ecto: 'Ectoplasm', herb: 'Nightbloom', torch: 'Torch', potion: 'Healing Draught',
  ember: 'Ember Shard', pearl: 'Sea Pearl', feather: 'Storm Feather', dust: 'Grave Dust',
  fireward: 'Fire Ward', gills: 'Gillweed Draught', gale: 'Gale Draught', tonic: 'Strength Tonic',
  bed: 'Wayfarer Bed', chest: 'Storage Chest', campfire: 'Campfire',
};

export const ITEM_ICON: Record<ItemId, string> = {
  dirt: '🟫', stone: '🪨', wood: '🪵', copper: '🟠', iron: '⚪', soulstone: '🔴',
  gel: '🫧', bone: '🦴', ecto: '👻', herb: '🌸', torch: '🔥', potion: '🧪',
  ember: '🔸', pearl: '🦪', feather: '🪶', dust: '⚱️',
  fireward: '🧯', gills: '🫁', gale: '🌬️', tonic: '💪',
  bed: '🛏', chest: '📦', campfire: '🔥',
};

/** what placing an item puts into the world */
export const PLACES: Partial<Record<ItemId, TileId>> = { dirt: T.DIRT, stone: T.STONE, wood: T.WOOD, torch: T.TORCH };

/** Chakan's blade, by tier. Always on the attack button, whatever the hotbar holds. */
export const SWORDS = [
  { name: 'Rusted Blade', damage: 10 },
  { name: 'Copper Falchion', damage: 16 },
  { name: 'Iron Claymore', damage: 24 },
  { name: 'Soul Reaver', damage: 40 },
  { name: 'Eternity', damage: 60 }, // taken from the Eternal Reaper; can't be crafted
] as const;

/** mining speed multiplier by tier; tier also gates ore (TileInfo.minPick) */
export const PICKAXES = [
  { name: 'Worn Pickaxe', speed: 1 },
  { name: 'Copper Pickaxe', speed: 1.7 },
  { name: 'Iron Pickaxe', speed: 2.6 },
] as const;

/** the hotbar: fixed slots, keys 1-9 and 0 / LB-RB / mouse wheel */
export type HotbarSlot = 'pickaxe' | 'dirt' | 'stone' | 'wood' | 'torch' | 'potion' | BrewId;
export const HOTBAR: HotbarSlot[] = ['pickaxe', 'dirt', 'stone', 'wood', 'torch', 'potion', 'fireward', 'gills', 'gale', 'tonic'];

/** Chakan's alchemy: timed brews for surviving the portal realms. Using the slot drinks one. */
export type BrewId = 'fireward' | 'gills' | 'gale' | 'tonic';
export const BREWS: Record<BrewId, { ms: number; effect: string }> = {
  fireward: { ms: 90_000, effect: 'no heat drain, half lava damage' },
  gills: { ms: 120_000, effect: 'breathe underwater' },
  gale: { ms: 90_000, effect: 'hold jump to float down' },
  tonic: { ms: 60_000, effect: '+50% sword damage' },
};
export const BREW_IDS = Object.keys(BREWS) as BrewId[];

export const POTION_HEAL = 50;

export interface Recipe {
  id: string;
  name: string;
  cost: Partial<Record<ItemId, number>>;
  gives: { item: ItemId; count: number } | { sword: number } | { pickaxe: number };
}

/** alchemy (Chakan) and smithing (Terraria) on one bench */
export const RECIPES: Recipe[] = [
  { id: 'torch', name: 'Torches ×4', cost: { wood: 1, gel: 1 }, gives: { item: 'torch', count: 4 } },
  { id: 'potion', name: 'Healing Draught', cost: { herb: 2, gel: 1 }, gives: { item: 'potion', count: 1 } },
  { id: 'copperPick', name: 'Copper Pickaxe', cost: { copper: 10, wood: 3 }, gives: { pickaxe: 1 } },
  { id: 'copperSword', name: 'Copper Falchion', cost: { copper: 8, wood: 2 }, gives: { sword: 1 } },
  { id: 'ironPick', name: 'Iron Pickaxe', cost: { iron: 12, wood: 3 }, gives: { pickaxe: 2 } },
  { id: 'ironSword', name: 'Iron Claymore', cost: { iron: 10, wood: 2 }, gives: { sword: 2 } },
  { id: 'soulReaver', name: 'Soul Reaver', cost: { soulstone: 12, bone: 6, ecto: 3 }, gives: { sword: 3 } },
  { id: 'fireward', name: 'Fire Ward ×2', cost: { herb: 1, gel: 2, copper: 1 }, gives: { item: 'fireward', count: 2 } },
  { id: 'gills', name: 'Gillweed Draught ×2', cost: { herb: 2, gel: 1 }, gives: { item: 'gills', count: 2 } },
  { id: 'gale', name: 'Gale Draught ×2', cost: { herb: 1, ecto: 1, wood: 1 }, gives: { item: 'gale', count: 2 } },
  { id: 'tonic', name: 'Strength Tonic', cost: { herb: 2, bone: 2 }, gives: { item: 'tonic', count: 1 } },
];
