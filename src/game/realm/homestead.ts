import { ITEM_NAME, type ItemId } from './items';
import { isSolid, T } from './tiles';

export type FurnitureKind = 'bed' | 'chest' | 'campfire' | 'wardenCore';
export type Stock = Partial<Record<ItemId, number>>;
export interface Furniture {
  id: number;
  kind: FurnitureKind;
  /** Left edge and bottom occupied tile. Furniture is passable. */
  tx: number;
  ty: number;
  stock: Stock;
}
export interface HomesteadSave {
  furniture: Furniture[];
  homeId?: number;
}
export const FURNITURE: Record<FurnitureKind, { width: number; clearance: number; cost: Stock; description: string; earnedOnly?: boolean }> = {
  bed: { width: 3, clearance: 3, cost: { wood: 12, gel: 4 }, description: 'Claim a home. Rest under a roof to heal and skip the night.' },
  chest: { width: 2, clearance: 1, cost: { wood: 8, copper: 2 }, description: 'Store 12 item types. Your supplies stay here across expeditions.' },
  campfire: { width: 2, clearance: 1, cost: { stone: 8, wood: 4 }, description: 'A permanent light. Recover faster nearby when enemies are away.' },
  wardenCore: { width: 2, clearance: 2, cost: {}, earnedOnly: true, description: 'A glowing trophy for your home. Earned from the Clockwork Warden.' },
};
export const FURNITURE_KINDS = Object.keys(FURNITURE) as FurnitureKind[];
export const CHEST_SLOTS = 12;
export type TileReader = (x: number, y: number) => number;

export function occupies(f: Furniture, tx: number, ty: number, includeSupport = false): boolean {
  const d = FURNITURE[f.kind];
  return tx >= f.tx && tx < f.tx + d.width && ty >= f.ty - d.clearance + 1 && ty <= f.ty + (includeSupport ? 1 : 0);
}

export function placementProblem(kind: FurnitureKind, tx: number, ty: number, tile: TileReader, furniture: Furniture[]): string | undefined {
  const d = FURNITURE[kind];
  for (let x = tx; x < tx + d.width; x++) {
    if (!isSolid(tile(x, ty + 1))) return 'Needs a flat, solid floor across its full width.';
    for (let y = ty - d.clearance + 1; y <= ty; y++) {
      if (tile(x, y) !== T.AIR) return 'Clear the space first (beds need three tiles of headroom).';
      if (furniture.some(f => occupies(f, x, y))) return 'Another furnishing is in the way.';
    }
  }
}

export function sheltered(bed: Furniture, tile: TileReader): boolean {
  for (let x = bed.tx; x < bed.tx + FURNITURE.bed.width; x++) {
    let roof = false;
    for (let y = bed.ty - 3; y >= bed.ty - 7; y--) if (isSolid(tile(x, y))) { roof = true; break; }
    if (!roof) return false;
  }
  return true;
}

/** Atomic, bounded transfer: full chests still accept more of an existing stack. */
export function transferStock(from: Stock, to: Stock, item: ItemId, amount: number, slots = Infinity): number {
  const available = from[item] ?? 0;
  if (!Number.isFinite(available) || available <= 0 || !(amount > 0)) return 0;
  if (!((to[item] ?? 0) > 0) && Object.values(to).filter(n => n > 0).length >= slots) return 0;
  const moved = Math.min(available, Math.floor(amount));
  from[item] = available - moved;
  if (!from[item]) delete from[item];
  to[item] = (to[item] ?? 0) + moved;
  return moved;
}

/** Reject malformed objects instead of letting them lock an old world's terrain. */
export function restoreHomestead(save: HomesteadSave | undefined, tile: TileReader): HomesteadSave {
  const furniture: Furniture[] = [];
  for (const f of save?.furniture ?? []) {
    if (!f || !FURNITURE_KINDS.includes(f.kind) || !Number.isSafeInteger(f.id) || f.id < 1
      || !Number.isInteger(f.tx) || !Number.isInteger(f.ty) || furniture.some(o => o.id === f.id)
      || placementProblem(f.kind, f.tx, f.ty, tile, furniture)) continue;
    const stock: Stock = {};
    if (f.kind === 'chest') for (const [key, count] of Object.entries(f.stock ?? {})) {
      if (Object.hasOwn(ITEM_NAME, key) && Number.isSafeInteger(count) && count > 0) stock[key as ItemId] = count;
    }
    furniture.push({ id: f.id, kind: f.kind, tx: f.tx, ty: f.ty, stock });
  }
  return { furniture, homeId: furniture.some(f => f.id === save?.homeId && f.kind === 'bed') ? save?.homeId : undefined };
}
