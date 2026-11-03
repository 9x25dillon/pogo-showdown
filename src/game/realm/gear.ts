import type { HeroStats } from './hero';
import type { ItemId } from './items';

/**
 * Item builds, in the League of Legends mould: raw materials make components,
 * components combine into finished items, and nothing is ever lost. A finished
 * item dismantles back into its components and they salvage back into their
 * materials, so a resource spent on one build can always become another.
 * Pure rules only: RealmScene supplies the inventory, RealmHeroMenu the screen.
 */
export const GEAR_SLOTS = 4;

export type ComponentId = 'whetstone' | 'ironheart' | 'swiftboots' | 'lens' | 'wardplate' | 'charm' | 'satchel' | 'metronome';
export type GearId =
  | 'diadem' | 'tempoBand' | 'warlordPlate' | 'bulwark' | 'duelistEdge' | 'razorFocus' | 'swiftGreaves'
  | 'inertiaCoil' | 'gyroscope' | 'fieldManual' | 'musesBrush' | 'lifebloom' | 'gildedSatchel' | 'inventorsKit';

type Mats = Partial<Record<ItemId, number>>;

export const COMPONENTS: Record<ComponentId, { name: string; icon: string; cost: Mats; effect: string; apply: (s: HeroStats) => void }> = {
  whetstone: { name: 'Whetstone', icon: '🗡', cost: { stone: 6, copper: 2 }, effect: '+6% damage', apply: (s) => { s.damageMult += 0.06; } },
  ironheart: { name: 'Iron Heart', icon: '🫀', cost: { iron: 2, bone: 2 }, effect: '+12 HP', apply: (s) => { s.maxHpBonus += 12; } },
  swiftboots: { name: 'Swift Boots', icon: '👟', cost: { wood: 6, gel: 2 }, effect: '+5% move', apply: (s) => { s.moveMult += 0.05; } },
  lens: { name: 'Keen Lens', icon: '🔎', cost: { copper: 3, gel: 2 }, effect: '+4% crit', apply: (s) => { s.critChance += 0.04; } },
  wardplate: { name: 'Ward Plate', icon: '🛡', cost: { iron: 3, stone: 4 }, effect: '-10% guard recharge', apply: (s) => { s.guardRechargeMs *= 0.9; } },
  charm: { name: 'Bloom Charm', icon: '🌸', cost: { herb: 3, gel: 1 }, effect: '+20% regen', apply: (s) => { s.regenMult += 0.2; } },
  satchel: { name: 'Lucky Satchel', icon: '🎒', cost: { wood: 4, bone: 2 }, effect: '+6% loot', apply: (s) => { s.lootLuck += 0.06; } },
  metronome: { name: 'Metronome', icon: '🎵', cost: { copper: 3, wood: 2 }, effect: '+5% combo cap', apply: (s) => { s.comboCap += 0.05; } },
};

export interface GearDef {
  id: GearId;
  name: string;
  icon: string;
  /** owned components are used first; anything missing is made from materials */
  components: ComponentId[];
  /** the extra material that binds them; returned when dismantled */
  catalyst: Mats;
  effect: string;
  apply: (s: HeroStats) => void;
}

const gear = (id: GearId, name: string, icon: string, components: ComponentId[], catalyst: Mats, effect: string, apply: (s: HeroStats) => void): GearDef =>
  ({ id, name, icon, components, catalyst, effect, apply });

export const GEAR: Record<GearId, GearDef> = {
  diadem: gear('diadem', 'Imperial Diadem', '👑', ['metronome', 'lens'], { ember: 2 }, '+25% combo cap, +6% crit', (s) => { s.comboCap += 0.25; s.critChance += 0.06; }),
  tempoBand: gear('tempoBand', 'Tempo Band', '🎼', ['metronome', 'swiftboots'], { feather: 2 }, 'combos last 40% longer, +10% combo cap', (s) => { s.comboDecayMs *= 1.4; s.comboCap += 0.1; }),
  warlordPlate: gear('warlordPlate', 'Warlord Plate', '🦾', ['ironheart', 'wardplate'], { ember: 2 }, '+40 HP, +1 guard', (s) => { s.maxHpBonus += 40; s.guardPips += 1; }),
  bulwark: gear('bulwark', 'Bulwark Standard', '🚩', ['wardplate', 'ironheart'], { pearl: 2 }, '+1 guard, guard recharges 25% faster', (s) => { s.guardPips += 1; s.guardRechargeMs *= 0.75; }),
  duelistEdge: gear('duelistEdge', "Duelist's Edge", '🤺', ['whetstone', 'lens'], { bone: 3 }, '+15% crit, +8% damage', (s) => { s.critChance += 0.15; s.damageMult += 0.08; }),
  razorFocus: gear('razorFocus', 'Razor Focus', '🎯', ['lens', 'lens'], { ecto: 2 }, '+12% crit, crits hit 25% harder', (s) => { s.critChance += 0.12; s.critMult += 0.25; }),
  swiftGreaves: gear('swiftGreaves', 'Swift Greaves', '🥾', ['swiftboots', 'swiftboots'], { feather: 2 }, '+15% move, +6% jump', (s) => { s.moveMult += 0.15; s.jumpMult += 0.06; }),
  inertiaCoil: gear('inertiaCoil', 'Inertia Coil', '🌀', ['swiftboots', 'whetstone'], { ember: 2 }, '+10% move, +10% damage', (s) => { s.moveMult += 0.1; s.damageMult += 0.1; }),
  gyroscope: gear('gyroscope', 'Precision Gyroscope', '🧭', ['swiftboots', 'lens'], { pearl: 2 }, '+12% jump, longer dodge window, looser tricks', (s) => { s.jumpMult += 0.12; s.invulnMult += 0.3; s.trickWindowMult += 0.2; }),
  fieldManual: gear('fieldManual', 'Field Manual', '📘', ['wardplate', 'metronome'], { dust: 2 }, '+1 guard, -20% recharge, guard keeps combo', (s) => { s.guardPips += 1; s.guardRechargeMs *= 0.8; s.guardKeepsCombo = true; }),
  musesBrush: gear('musesBrush', "Muse's Brush", '🖌', ['charm', 'metronome'], { pearl: 2 }, '+100% regen, combos last 30% longer', (s) => { s.regenMult += 1; s.comboDecayMs *= 1.3; }),
  lifebloom: gear('lifebloom', 'Lifebloom', '🌺', ['charm', 'ironheart'], { herb: 4 }, '+60% regen, +25 HP', (s) => { s.regenMult += 0.6; s.maxHpBonus += 25; }),
  gildedSatchel: gear('gildedSatchel', 'Gilded Satchel', '💰', ['satchel', 'satchel'], { soulstone: 2 }, '+35% loot', (s) => { s.lootLuck += 0.35; }),
  inventorsKit: gear('inventorsKit', "Inventor's Kit", '🧰', ['satchel', 'whetstone'], { iron: 3 }, '+20% loot, +8% damage, +6% move', (s) => { s.lootLuck += 0.2; s.damageMult += 0.08; s.moveMult += 0.06; }),
};

/** the build that takes each hero's own strength as far as it goes, and what completing it adds */
export const ULTIMATE_BUILDS: Record<string, { title: string; items: [GearId, GearId, GearId, GearId]; bonus: string; apply: (s: HeroStats) => void }> = {
  cleo: { title: 'The Unbroken Chain', items: ['diadem', 'tempoBand', 'duelistEdge', 'lifebloom'], bonus: 'Set: +40% combo cap', apply: (s) => { s.comboCap += 0.4; } },
  khan: { title: 'The Steppe Wall', items: ['warlordPlate', 'bulwark', 'inertiaCoil', 'lifebloom'], bonus: 'Set: +60 HP, +1 guard', apply: (s) => { s.maxHpBonus += 60; s.guardPips += 1; } },
  joan: { title: 'The Clean Cut', items: ['duelistEdge', 'razorFocus', 'tempoBand', 'swiftGreaves'], bonus: 'Set: +10% crit, crits hit 25% harder', apply: (s) => { s.critChance += 0.1; s.critMult += 0.25; } },
  einstein: { title: 'Laws of Motion', items: ['swiftGreaves', 'inertiaCoil', 'gyroscope', 'tempoBand'], bonus: 'Set: +20% move, +10% damage', apply: (s) => { s.moveMult += 0.2; s.damageMult += 0.1; } },
  ada: { title: 'Perfect Program', items: ['gyroscope', 'razorFocus', 'swiftGreaves', 'fieldManual'], bonus: 'Set: +10% jump, longest dodge and trick windows', apply: (s) => { s.jumpMult += 0.1; s.invulnMult += 0.4; s.trickWindowMult += 0.3; } },
  suntzu: { title: 'The Unassailable Plan', items: ['fieldManual', 'bulwark', 'warlordPlate', 'diadem'], bonus: 'Set: +1 guard, guard recharges 30% faster', apply: (s) => { s.guardPips += 1; s.guardRechargeMs *= 0.7; } },
  frida: { title: 'Living Colour', items: ['musesBrush', 'lifebloom', 'tempoBand', 'diadem'], bonus: 'Set: +100% regen, combos last 30% longer', apply: (s) => { s.regenMult += 1; s.comboDecayMs *= 1.3; } },
  leo: { title: 'The Workshop', items: ['gildedSatchel', 'inventorsKit', 'inertiaCoil', 'duelistEdge'], bonus: 'Set: +40% loot, +10% damage', apply: (s) => { s.lootLuck += 0.4; s.damageMult += 0.1; } },
};

export interface GearState {
  components: Partial<Record<ComponentId, number>>;
  items: Partial<Record<GearId, number>>;
  /** per hero: a finished item can be worn by any hero who has it in their build */
  equipped: Record<string, GearId[]>;
}

export const emptyGear = (): GearState => ({ components: {}, items: {}, equipped: {} });
export const GEAR_IDS = Object.keys(GEAR) as GearId[];

/** what building this would still take from the pack, after using components you own */
export function buildCost(id: GearId, state: GearState): Mats {
  const def = GEAR[id];
  const have = { ...state.components };
  const cost: Mats = { ...def.catalyst };
  for (const c of def.components) {
    if ((have[c] ?? 0) > 0) { have[c]! -= 1; continue; }
    for (const [m, n] of Object.entries(COMPONENTS[c].cost)) cost[m as ItemId] = (cost[m as ItemId] ?? 0) + (n ?? 0);
  }
  return cost;
}

export function affordable(cost: Mats, inventory: Mats): boolean {
  return Object.entries(cost).every(([m, n]) => (inventory[m as ItemId] ?? 0) >= (n ?? 0));
}

function take(inventory: Mats, cost: Mats): void {
  for (const [m, n] of Object.entries(cost)) inventory[m as ItemId] = (inventory[m as ItemId] ?? 0) - (n ?? 0);
}

function give(inventory: Mats, gain: Mats): void {
  for (const [m, n] of Object.entries(gain)) inventory[m as ItemId] = (inventory[m as ItemId] ?? 0) + (n ?? 0);
}

export function craftComponent(id: ComponentId, state: GearState, inventory: Mats): boolean {
  if (!affordable(COMPONENTS[id].cost, inventory)) return false;
  take(inventory, COMPONENTS[id].cost);
  state.components[id] = (state.components[id] ?? 0) + 1;
  return true;
}

export function buildItem(id: GearId, state: GearState, inventory: Mats): boolean {
  const cost = buildCost(id, state);
  if (!affordable(cost, inventory)) return false;
  take(inventory, cost);
  for (const c of GEAR[id].components) if ((state.components[c] ?? 0) > 0) state.components[c]! -= 1;
  // components that were just made from materials pass straight into the item
  state.items[id] = (state.items[id] ?? 0) + 1;
  return true;
}

/** a finished item goes back to its components and catalyst: nothing is lost */
export function dismantleItem(id: GearId, state: GearState, inventory: Mats): boolean {
  if ((state.items[id] ?? 0) <= 0) return false;
  state.items[id]! -= 1;
  for (const c of GEAR[id].components) state.components[c] = (state.components[c] ?? 0) + 1;
  give(inventory, GEAR[id].catalyst);
  if ((state.items[id] ?? 0) === 0) for (const hero of Object.keys(state.equipped)) state.equipped[hero] = state.equipped[hero].filter((g) => g !== id);
  return true;
}

/** a component goes back to the materials it was made from */
export function salvageComponent(id: ComponentId, state: GearState, inventory: Mats): boolean {
  if ((state.components[id] ?? 0) <= 0) return false;
  state.components[id]! -= 1;
  give(inventory, COMPONENTS[id].cost);
  return true;
}

export function equippedFor(state: GearState | undefined, heroId: string): GearId[] {
  return state?.equipped[heroId] ?? [];
}

/** wear or take off; false if there's no free slot or you don't own one */
export function toggleEquip(id: GearId, state: GearState, heroId: string): boolean {
  const worn = state.equipped[heroId] ?? [];
  if (worn.includes(id)) { state.equipped[heroId] = worn.filter((g) => g !== id); return true; }
  if ((state.items[id] ?? 0) <= 0 || worn.length >= GEAR_SLOTS) return false;
  state.equipped[heroId] = [...worn, id];
  return true;
}

export function setComplete(heroId: string, worn: readonly GearId[]): boolean {
  const build = ULTIMATE_BUILDS[heroId];
  return !!build && build.items.every((g) => worn.includes(g));
}

export function applyGear(st: HeroStats, heroId: string, worn: readonly GearId[]): void {
  for (const g of worn) GEAR[g]?.apply(st);
  if (setComplete(heroId, worn)) ULTIMATE_BUILDS[heroId].apply(st);
}

export function costText(cost: Mats, icon: (m: ItemId) => string, inventory: Mats): string {
  return Object.entries(cost).map(([m, n]) => `${icon(m as ItemId)} ${inventory[m as ItemId] ?? 0}/${n}`).join('  ') || 'ready';
}
