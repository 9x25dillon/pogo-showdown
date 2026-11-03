import type { ItemId } from './items';

/**
 * Each hero's ultimate weapon, earned through their own three-part quest:
 * beat your nemesis (it drops the Nemesis Sigil), gather what the weapon is
 * made of, then forge it. The passive is what makes it theirs; RealmScene
 * applies it in swing().
 */
export type WeaponPassive = 'comboBurst' | 'everyFourthQuake' | 'critFlame' | 'lightBolt' | 'thirdCrit' | 'fullGuardBonus' | 'lifeSteal' | 'doubleLoot';

export interface UltimateWeapon {
  heroId: string;
  name: string;
  damage: number;
  passive: WeaponPassive;
  /** what it does, in a sentence */
  power: string;
  /** step two of the quest: why these materials, and how many */
  gatherText: string;
  materials: Partial<Record<ItemId, number>>;
}

export const ULTIMATE_DAMAGE = 72;

export const WEAPONS: Record<string, UltimateWeapon> = {
  cleo: { heroId: 'cleo', name: 'The Asp Sceptre', damage: ULTIMATE_DAMAGE, passive: 'comboBurst', power: 'At combo 5 and up, every hit also sends out a venom shockwave.', gatherText: 'Copper to gild the sceptre', materials: { ember: 6, pearl: 4, soulstone: 6, copper: 14 } },
  khan: { heroId: 'khan', name: 'Horde Breaker', damage: ULTIMATE_DAMAGE, passive: 'everyFourthQuake', power: 'Every fourth swing shakes the ground around you.', gatherText: 'Iron for the head, bone for the haft', materials: { iron: 16, bone: 10, ember: 4 } },
  joan: { heroId: 'joan', name: 'The Oriflamme', damage: ULTIMATE_DAMAGE, passive: 'critFlame', power: 'Critical hits launch a blade of flame.', gatherText: 'Iron for the blade', materials: { ember: 8, feather: 6, iron: 8 } },
  einstein: { heroId: 'einstein', name: 'The Prism Blade', damage: ULTIMATE_DAMAGE, passive: 'lightBolt', power: 'Every swing fires a bolt of split light.', gatherText: 'Iron to hold the prism', materials: { pearl: 6, soulstone: 8, feather: 3, iron: 8 } },
  ada: { heroId: 'ada', name: 'The Analytical Edge', damage: ULTIMATE_DAMAGE, passive: 'thirdCrit', power: 'Every third hit is calculated to be critical.', gatherText: 'Copper for the circuits', materials: { copper: 24, soulstone: 6, ecto: 3 } },
  suntzu: { heroId: 'suntzu', name: 'The Art of Edge', damage: ULTIMATE_DAMAGE, passive: 'fullGuardBonus', power: 'While your guard is full, you hit 30% harder.', gatherText: 'Iron to act on the plan, bone for the grip', materials: { dust: 6, iron: 14, bone: 6 } },
  frida: { heroId: 'frida', name: 'The Crimson Brush', damage: ULTIMATE_DAMAGE, passive: 'lifeSteal', power: 'Every hit that lands paints 3 HP back onto you.', gatherText: 'Nightbloom for the pigment', materials: { herb: 10, pearl: 6, ember: 4 } },
  leo: { heroId: 'leo', name: 'The Vitruvian Engine', damage: ULTIMATE_DAMAGE, passive: 'doubleLoot', power: 'Everything you defeat drops twice as much.', gatherText: 'Copper, iron and wood, as an inventor would insist', materials: { copper: 10, iron: 10, wood: 12, feather: 3 } },
};

/** what the nemesis drops the first time it falls: the part of the recipe the overworld can't give you */
const RARE: readonly ItemId[] = ['ember', 'pearl', 'feather', 'dust', 'ecto', 'soulstone'];
export function nemesisSpoils(heroId: string): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {};
  for (const [m, n] of Object.entries(WEAPONS[heroId]?.materials ?? {})) if (RARE.includes(m as ItemId)) out[m as ItemId] = n;
  return out;
}

export type WeaponStage = 'nemesis' | 'gather' | 'forge' | 'done';

export function weaponStage(heroId: string, sigils: readonly string[], forged: readonly string[], inventory: Partial<Record<ItemId, number>>): WeaponStage {
  if (forged.includes(heroId)) return 'done';
  if (!sigils.includes(heroId)) return 'nemesis';
  const need = WEAPONS[heroId]?.materials ?? {};
  return Object.entries(need).every(([m, n]) => (inventory[m as ItemId] ?? 0) >= (n ?? 0)) ? 'forge' : 'gather';
}
