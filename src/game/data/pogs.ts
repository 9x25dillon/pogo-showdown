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

/**
 * A usable battle item, for the Pog Quest platformer mode - separate from
 * the passive `perks` above, which keep applying unmodified in Pogo Dash
 * and Pog Battles. A pog can define both (dual-purpose), just one, or
 * neither. `charges` are per level attempt; not persisted to IndexedDB.
 */
export type PogActiveEffect =
  | { kind: 'shieldBurst'; charges: number; invulnMs: number }
  | { kind: 'speedBurst'; charges: number; boostMs: number }
  | { kind: 'extraLife'; charges: number }
  | { kind: 'projectile'; charges: number }
  /** enemies, pellets and the rival all stop dead for a moment */
  | { kind: 'freeze'; charges: number; freezeMs: number }
  /** coins within MAGNET_RADIUS_PX fly to you */
  | { kind: 'magnet'; charges: number; magnetMs: number }
  /** one extra mid-air jump per airtime, for the duration */
  | { kind: 'doubleJump'; charges: number; windowMs: number }
  /** slam straight down; landing sends a shockwave that hits everything nearby, spikers included */
  | { kind: 'groundPound'; charges: number };

export interface PogDef {
  id: string;
  name: string;
  emoji: string;
  rarity: PogRarity;
  color: number;
  /** highschooler or circuit pro id whose battles drop this pog, or `quest:<levelId>` for a Pog Quest first-clear reward */
  droppedBy: string;
  blurb: string;
  perks: PogPerks;
  activeEffect?: PogActiveEffect;
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
    blurb: 'Genghis’s. Absorbs one hit without breaking your combo. In Pog Quest, activate it for a shield burst.',
    perks: { shieldHits: 1 }, activeEffect: { kind: 'shieldBurst', charges: 1, invulnMs: 3000 } },
  { id: 'foil', name: 'Foil Tip', emoji: '⚔️', rarity: 'common', color: 0xc0c0c8, droppedBy: 'joan',
    blurb: 'Jo’s. Cleaner dodges pay more. In Pog Quest, flick it as a projectile.', perks: { trickBonus: 4 },
    activeEffect: { kind: 'projectile', charges: 2 } },
  { id: 'chalk', name: 'Chalk Disc', emoji: '\u{1F9E0}', rarity: 'common', color: 0x3b82f6, droppedBy: 'einstein',
    blurb: 'Albert’s. Speed ramps a touch faster. More score, more danger. In Pog Quest, it bends time: everything else freezes.',
    perks: { speedScale: 1.06 }, activeEffect: { kind: 'freeze', charges: 1, freezeMs: 2500 } },
  { id: 'punchcard', name: 'Punch Card', emoji: '\u{1F916}', rarity: 'common', color: 0x22d3ee, droppedBy: 'ada',
    blurb: 'Ada’s. Stars are worth a little more. In Pog Quest, it runs a coin-magnet program.', perks: { starBonus: 6 },
    activeEffect: { kind: 'magnet', charges: 2, magnetMs: 5000 } },
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
    blurb: 'Amelia’s. Faster ramp, and a shield for when it bites. In Pog Quest, it gives you a mid-air second jump.',
    perks: { speedScale: 1.1, shieldHits: 1 }, activeEffect: { kind: 'doubleJump', charges: 2, windowMs: 6000 } },
  { id: 'lantern', name: 'Lantern Pog', emoji: '\u{1F31F}', rarity: 'legendary', color: 0x78350f, droppedBy: 'tubman',
    blurb: 'Harriet’s. Second wind: come back once from zero. In Pog Quest, activate it for an extra life.',
    perks: { secondWind: true, starBonus: 8 }, activeEffect: { kind: 'extraLife', charges: 1 } },
  { id: 'radium', name: 'Radium Disc', emoji: '☢️', rarity: 'epic', color: 0x22d3ee, droppedBy: 'curie',
    blurb: 'Marie’s. Everything glows a bit brighter. In Pog Quest, a radiant pulse freezes the field.',
    perks: { starBonus: 10, trickBonus: 4 }, activeEffect: { kind: 'freeze', charges: 2, freezeMs: 2000 } },
  { id: 'coil', name: 'Tesla Coil', emoji: '⚡', rarity: 'epic', color: 0x7c3aed, droppedBy: 'tesla',
    blurb: 'Nikola’s. Fastest ramp on the circuit. Not for the timid. In Pog Quest, activate it for a burst of speed.',
    perks: { speedScale: 1.15 }, activeEffect: { kind: 'speedBurst', charges: 2, boostMs: 3500 } },
  { id: 'dragon', name: 'Dragon Slammer', emoji: '\u{1F409}', rarity: 'legendary', color: 0xdc2626, droppedBy: 'brucelee',
    blurb: 'Bruce’s. Two shield hits and serious style. In Pog Quest, activate it to hurl a slam projectile.',
    perks: { shieldHits: 2, flair: 0.15 }, activeEffect: { kind: 'projectile', charges: 3 } },
  { id: 'pearl', name: 'Virgin Pearl', emoji: '\u{1F48E}', rarity: 'epic', color: 0xa855f7, droppedBy: 'elizabeth',
    blurb: 'Elizabeth’s. Slower ramp, one extra life. The long game.', perks: { speedScale: 0.9, extraLives: 1 } },
  { id: 'tusk', name: 'Tusk Cap', emoji: '\u{1F418}', rarity: 'epic', color: 0x92400e, droppedBy: 'hannibal',
    blurb: 'Hannibal’s. Built to take a hit. In Pog Quest, an elephant-weight ground pound.',
    perks: { shieldHits: 1, extraLives: 1 }, activeEffect: { kind: 'groundPound', charges: 2 } },
  { id: 'jolly', name: 'Jolly Roger', emoji: '☠️', rarity: 'legendary', color: 0x0f766e, droppedBy: 'chingshih',
    blurb: 'Ching Shih’s. Plunder: stars and tricks both pay out big. In Pog Quest, every coin nearby is yours.',
    perks: { starBonus: 16, trickBonus: 8, flair: 0.08 }, activeEffect: { kind: 'magnet', charges: 3, magnetMs: 6000 } },
  { id: 'katana', name: 'Katana Pog', emoji: '⚔️', rarity: 'legendary', color: 0x334155, droppedBy: 'musashi',
    blurb: 'Musashi’s. Combos climb fastest of all. No safety net. In Pog Quest, a two-sword ground pound.',
    perks: { flair: 0.3, speedScale: 1.05 }, activeEffect: { kind: 'groundPound', charges: 3 } },

  // ---- Pog Quest first-clear rewards (one per level, see levels.ts rewardPogId) ----
  { id: 'flagpole', name: 'Flagpole Pog', emoji: '\u{1F6A9}', rarity: 'common', color: 0x4ade80, droppedBy: 'quest:level1',
    blurb: 'Footpeg Flats finisher. Pulls in nearby coins.', perks: { starBonus: 4 },
    activeEffect: { kind: 'magnet', charges: 1, magnetMs: 5000 } },
  { id: 'sprinter', name: 'Sprint Spike', emoji: '\u{1F45F}', rarity: 'rare', color: 0x38bdf8, droppedBy: 'quest:level2',
    blurb: 'Signature Sprint finisher. A mid-air second jump.', perks: { trickBonus: 4 },
    activeEffect: { kind: 'doubleJump', charges: 2, windowMs: 5000 } },
  { id: 'gearwheel', name: 'Gearwheel', emoji: '⚙️', rarity: 'rare', color: 0x94a3b8, droppedBy: 'quest:level5',
    blurb: 'Tech Park Tangle finisher. Jams every gear on the field.', perks: { speedScale: 0.97 },
    activeEffect: { kind: 'freeze', charges: 2, freezeMs: 2000 } },
  { id: 'champbelt', name: 'Champion Belt', emoji: '\u{1F94A}', rarity: 'epic', color: 0xdc2626, droppedBy: 'quest:level3',
    blurb: 'Taken off the Circuit Champion. Ground pound that cracks spikers.', perks: { shieldHits: 1 },
    activeEffect: { kind: 'groundPound', charges: 2 } },
  { id: 'highfive', name: 'High-Five Pog', emoji: '\u{1F64C}', rarity: 'rare', color: 0x6ee7ff, droppedBy: 'quest:level4',
    blurb: 'Co-op Circuit clear. A shield burst for whoever needs it.', perks: { extraLives: 1 },
    activeEffect: { kind: 'shieldBurst', charges: 2, invulnMs: 2500 } },
  { id: 'skyline', name: 'Skyline Pog', emoji: '\u{1F3D9}\u{FE0F}', rarity: 'rare', color: 0x818cf8, droppedBy: 'quest:level6',
    blurb: 'Rooftop Relay finisher. Rooftop-to-rooftop double jumps.', perks: { starBonus: 6 },
    activeEffect: { kind: 'doubleJump', charges: 2, windowMs: 6000 } },
  { id: 'nightowl', name: 'Night Owl', emoji: '\u{1F989}', rarity: 'rare', color: 0x6366f1, droppedBy: 'quest:level7',
    blurb: 'Night Circuit finisher. Three slam throws in the dark.', perks: { trickBonus: 6 },
    activeEffect: { kind: 'projectile', charges: 3 } },
  { id: 'summitcrown', name: 'Summit Crown', emoji: '\u{1F3D4}\u{FE0F}', rarity: 'legendary', color: 0xf59e0b, droppedBy: 'quest:level8',
    blurb: 'Taken off the Summit Slammer. Slam back: three ground pounds and a spare life.', perks: { extraLives: 1, flair: 0.1 },
    activeEffect: { kind: 'groundPound', charges: 3 } },
  { id: 'ropeteam', name: 'Rope Team', emoji: '\u{1F9D7}', rarity: 'epic', color: 0x14b8a6, droppedBy: 'quest:level9',
    blurb: 'Co-op Summit clear. Freeze the mountain so your partner can climb.', perks: { shieldHits: 1 },
    activeEffect: { kind: 'freeze', charges: 2, freezeMs: 2500 } },
  { id: 'candle', name: 'Candle Pog', emoji: '\u{1F56F}\u{FE0F}', rarity: 'rare', color: 0xfbbf24, droppedBy: 'quest:level10',
    blurb: 'Midnight Mansion finisher. Hold the light up and everything stops.', perks: { starBonus: 8 },
    activeEffect: { kind: 'freeze', charges: 2, freezeMs: 2200 } },
  { id: 'stormcell', name: 'Storm Cell', emoji: '\u{1F329}\u{FE0F}', rarity: 'legendary', color: 0x22d3ee, droppedBy: 'quest:level11',
    blurb: 'Pulled out of the Storm Conductor. Four bolts of your own.', perks: { flair: 0.12, speedScale: 1.04 },
    activeEffect: { kind: 'projectile', charges: 4 } },
  { id: 'lightningrod', name: 'Lightning Rod', emoji: '⚡', rarity: 'epic', color: 0x0ea5e9, droppedBy: 'quest:level12',
    blurb: 'Co-op Storm clear. Take the hit so your partner doesn’t.', perks: { shieldHits: 1 },
    activeEffect: { kind: 'shieldBurst', charges: 3, invulnMs: 2500 } },
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

/** short one-liner for the Binder/HUD, e.g. "Quest: freeze 2.5s ×1" */
export function describeActive(e: PogActiveEffect): string {
  const secs = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)}s`;
  switch (e.kind) {
    case 'shieldBurst':
      return `Quest: shield ${secs(e.invulnMs)} ×${e.charges}`;
    case 'speedBurst':
      return `Quest: speed ${secs(e.boostMs)} ×${e.charges}`;
    case 'extraLife':
      return `Quest: +1 life ×${e.charges}`;
    case 'projectile':
      return `Quest: projectile ×${e.charges}`;
    case 'freeze':
      return `Quest: freeze ${secs(e.freezeMs)} ×${e.charges}`;
    case 'magnet':
      return `Quest: magnet ${secs(e.magnetMs)} ×${e.charges}`;
    case 'doubleJump':
      return `Quest: double jump ${secs(e.windowMs)} ×${e.charges}`;
    case 'groundPound':
      return `Quest: ground pound ×${e.charges}`;
  }
}
