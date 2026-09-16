/**
 * Collectible pogs. Each is a discrete item the player owns (possibly
 * several copies), equips onto the pogo stick's footpeg, and can wager
 * in Pog Battles. Equipped pogs change how Pogo Dash plays.
 *
 * Balance rules (the whole table, so tuning happens here, not in scenes):
 *   rarity weight      common 1 · rare 2 · epic 3 · legendary 4
 *   footpeg capacity   4 + Locker Pog Stack tier  (4..8)
 *   one copy of a given pog can be equipped at a time
 *   perk ceilings at max capacity are meant to land near the Circuit's
 *   +30% Advantage cap in score terms, not above it:
 *     extra lives     ≤ +2      (each ≈ +10-15s survival late-run)
 *     flair           ≤ +0.45   (combo multiplier slope)
 *     speed scale     0.85..1.15 (slower = safer, but passive score is speed × rate)
 *     star / trick    small flat bonuses on top of base 40 / 18
 */
export type PogRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PogPerks {
  extraLives?: number;
  shieldHits?: number;
  flair?: number;
  starBonus?: number;
  trickBonus?: number;
  speedScale?: number;
  secondWind?: boolean;
}

export interface PogDef {
  id: string;
  name: string;
  emoji: string;
  rarity: PogRarity;
  color: number;
  /** highschooler or circuit pro id whose battles drop this pog */
  droppedBy: string;
  blurb: string;
  perks: PogPerks;
}

export const RARITY_WEIGHT: Record<PogRarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4 };
export const RARITY_COLOR: Record<PogRarity, number> = {
  common: 0x9ca3af,
  rare: 0x38bdf8,
  epic: 0xa855f7,
  legendary: 0xf9d64b,
};
export const RARITY_LABEL: Record<PogRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const BASE_FOOTPEG_CAPACITY = 4;

export const POG_CATALOG: PogDef[] = [
  // ---- starter (granted on first Binder open) ----
  { id: 'cafeteria', name: 'Cafeteria Cap', emoji: '\u{1F37D}\u{FE0F}', rarity: 'common', color: 0x9ca3af, droppedBy: 'starter',
    blurb: 'Milk-carton lid. Everyone starts somewhere.', perks: { trickBonus: 2 } },

  // ---- highschooler signatures (practice battles) ----
  { id: 'crown', name: 'Tin Crown', emoji: '\u{1F451}', rarity: 'rare', color: 0xf4c430, droppedBy: 'cleo',
    blurb: 'Cleo’s. Combos climb faster.', perks: { flair: 0.12 } },
  { id: 'bicep', name: 'Bicep Badge', emoji: '\u{1F4AA}', rarity: 'rare', color: 0xd9432f, droppedBy: 'khan',
    blurb: 'Genghis’s. Absorbs one hit without breaking your combo.', perks: { shieldHits: 1 } },
  { id: 'foil', name: 'Foil Tip', emoji: '⚔️', rarity: 'common', color: 0xc0c0c8, droppedBy: 'joan',
    blurb: 'Jo’s. Cleaner dodges pay more.', perks: { trickBonus: 4 } },
  { id: 'chalk', name: 'Chalk Disc', emoji: '\u{1F9E0}', rarity: 'common', color: 0x3b82f6, droppedBy: 'einstein',
    blurb: 'Albert’s. Speed ramps a touch faster. More score, more danger.', perks: { speedScale: 1.06 } },
  { id: 'punchcard', name: 'Punch Card', emoji: '\u{1F916}', rarity: 'common', color: 0x22d3ee, droppedBy: 'ada',
    blurb: 'Ada’s. Stars are worth a little more.', perks: { starBonus: 6 } },
  { id: 'scroll', name: 'Scroll Seal', emoji: '\u{1F4D6}', rarity: 'common', color: 0x22c55e, droppedBy: 'suntzu',
    blurb: 'Sun Tzu’s. Speed ramps slower. Safer, lower passive score.', perks: { speedScale: 0.94 } },
  { id: 'palette', name: 'Paint Chip', emoji: '\u{1F3A8}', rarity: 'common', color: 0xec4899, droppedBy: 'frida',
    blurb: 'Frida’s. Style points.', perks: { flair: 0.06 } },
  { id: 'bulb', name: 'Filament Pog', emoji: '\u{1F4A1}', rarity: 'rare', color: 0xf97316, droppedBy: 'leo',
    blurb: 'Leo’s. Stars shine brighter.', perks: { starBonus: 12 } },

  // ---- circuit pro signatures (ranked battles, wager required) ----
  { id: 'bicorne', name: 'Bicorne Slammer', emoji: '\u{1F3A9}', rarity: 'epic', color: 0x1d4ed8, droppedBy: 'napoleon',
    blurb: 'Napoleon’s. One extra life.', perks: { extraLives: 1 } },
  { id: 'sunstone', name: 'Sunstone', emoji: '☀️', rarity: 'epic', color: 0xeab308, droppedBy: 'nefertiti',
    blurb: 'Nefertiti’s. Combos climb much faster.', perks: { flair: 0.2 } },
  { id: 'propeller', name: 'Propeller Cap', emoji: '✈️', rarity: 'epic', color: 0x0ea5e9, droppedBy: 'earhart',
    blurb: 'Amelia’s. Faster ramp, and a shield for when it bites.', perks: { speedScale: 1.1, shieldHits: 1 } },
  { id: 'lantern', name: 'Lantern Pog', emoji: '\u{1F31F}', rarity: 'legendary', color: 0x78350f, droppedBy: 'tubman',
    blurb: 'Harriet’s. Second wind: come back once from zero.', perks: { secondWind: true, starBonus: 8 } },
  { id: 'radium', name: 'Radium Disc', emoji: '☢️', rarity: 'epic', color: 0x22d3ee, droppedBy: 'curie',
    blurb: 'Marie’s. Everything glows a bit brighter.', perks: { starBonus: 10, trickBonus: 4 } },
  { id: 'coil', name: 'Tesla Coil', emoji: '⚡', rarity: 'epic', color: 0x7c3aed, droppedBy: 'tesla',
    blurb: 'Nikola’s. Fastest ramp on the circuit. Not for the timid.', perks: { speedScale: 1.15 } },
  { id: 'dragon', name: 'Dragon Slammer', emoji: '\u{1F409}', rarity: 'legendary', color: 0xdc2626, droppedBy: 'brucelee',
    blurb: 'Bruce’s. Two shield hits and serious style.', perks: { shieldHits: 2, flair: 0.15 } },
  { id: 'pearl', name: 'Virgin Pearl', emoji: '\u{1F48E}', rarity: 'epic', color: 0xa855f7, droppedBy: 'elizabeth',
    blurb: 'Elizabeth’s. Slower ramp, one extra life. The long game.', perks: { speedScale: 0.9, extraLives: 1 } },
  { id: 'tusk', name: 'Tusk Cap', emoji: '\u{1F418}', rarity: 'epic', color: 0x92400e, droppedBy: 'hannibal',
    blurb: 'Hannibal’s. Built to take a hit.', perks: { shieldHits: 1, extraLives: 1 } },
  { id: 'jolly', name: 'Jolly Roger', emoji: '☠️', rarity: 'legendary', color: 0x0f766e, droppedBy: 'chingshih',
    blurb: 'Ching Shih’s. Plunder: stars and tricks both pay out big.', perks: { starBonus: 16, trickBonus: 8, flair: 0.08 } },
  { id: 'katana', name: 'Katana Pog', emoji: '⚔️', rarity: 'legendary', color: 0x334155, droppedBy: 'musashi',
    blurb: 'Musashi’s. Combos climb fastest of all. No safety net.', perks: { flair: 0.3, speedScale: 1.05 } },
];

export function pogDef(id: string): PogDef | undefined {
  return POG_CATALOG.find((p) => p.id === id);
}

export function pogForOpponent(opponentId: string): PogDef | undefined {
  return POG_CATALOG.find((p) => p.droppedBy === opponentId);
}

export const EMPTY_PERKS: Required<PogPerks> = {
  extraLives: 0,
  shieldHits: 0,
  flair: 0,
  starBonus: 0,
  trickBonus: 0,
  speedScale: 1,
  secondWind: false,
};

/** sum perks across equipped pogs; speedScale multiplies, then everything is clamped to the table above */
export function aggregatePerks(defs: PogDef[]): Required<PogPerks> {
  const out: Required<PogPerks> = { ...EMPTY_PERKS };
  for (const d of defs) {
    out.extraLives += d.perks.extraLives ?? 0;
    out.shieldHits += d.perks.shieldHits ?? 0;
    out.flair += d.perks.flair ?? 0;
    out.starBonus += d.perks.starBonus ?? 0;
    out.trickBonus += d.perks.trickBonus ?? 0;
    out.speedScale *= d.perks.speedScale ?? 1;
    out.secondWind = out.secondWind || !!d.perks.secondWind;
  }
  out.extraLives = Math.min(2, out.extraLives);
  out.shieldHits = Math.min(3, out.shieldHits);
  out.flair = Math.min(0.45, out.flair);
  out.speedScale = Math.min(1.15, Math.max(0.85, out.speedScale));
  return out;
}

export function describePerks(p: PogPerks): string[] {
  const out: string[] = [];
  if (p.extraLives) out.push(`+${p.extraLives} life`);
  if (p.shieldHits) out.push(`${p.shieldHits} shield hit${p.shieldHits > 1 ? 's' : ''}`);
  if (p.flair) out.push(`+${Math.round(p.flair * 100)}% combo`);
  if (p.starBonus) out.push(`+${p.starBonus} star pts`);
  if (p.trickBonus) out.push(`+${p.trickBonus} trick pts`);
  if (p.speedScale && p.speedScale !== 1) out.push(`${p.speedScale > 1 ? '+' : ''}${Math.round((p.speedScale - 1) * 100)}% ramp`);
  if (p.secondWind) out.push('second wind');
  return out;
}
