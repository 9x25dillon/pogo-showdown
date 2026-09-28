import { TRICKS, type TrickDef, type TrickInput } from '../data/tricks';

/**
 * The Yoyo Trick Lab, as a weapon. Craft a yoyo, select it, and every
 * throw opens a trick window: flick a trick's inputs (right stick or
 * arrow keys; ● is the use button again) before the window closes and the
 * trick fires. Longer tricks need a better yoyo and hit much harder.
 *
 * Risk/reward:
 *   an input that can't lead to any trick you know snaps a string;
 *   lose all three and the yoyo tangles for TANGLE_MS. A string comes back
 *   every STRING_REGEN_MS without a fumble.
 *   landed tricks chain: each within CHAIN_MS of the last adds +10% trick
 *   damage (cap +50%), and pays combo stacks and XP equal to its length.
 *   Double or Nothing is a coin flip: triple damage, or a snapped string.
 * Windows tighten as the chain grows (Trick Lab's pacing) and loosen with
 * the hero's trick window stat (Ada).
 */
export const STRINGS = 3;
export const TANGLE_MS = 6000;
export const STRING_REGEN_MS = 12_000;
export const CHAIN_MS = 3500;
export const CHAIN_STEP = 0.1;
export const CHAIN_CAP = 0.5;

export interface YoyoTier {
  name: string;
  damage: number;
  /** throw reach, px */
  reach: number;
  /** longest trick this yoyo can land */
  maxLen: number;
}

/** index 0 = none; tiers 1-4 are crafted (see items.ts RECIPES) */
export const YOYOS: YoyoTier[] = [
  { name: 'no yoyo', damage: 0, reach: 0, maxLen: 0 },
  { name: 'Wooden Yoyo', damage: 8, reach: 120, maxLen: 2 },
  { name: 'Butterfly Yoyo', damage: 14, reach: 150, maxLen: 3 },
  { name: 'Ball-Bearing Yoyo', damage: 22, reach: 180, maxLen: 4 },
  { name: 'Signature Yoyo', damage: 34, reach: 210, maxLen: 5 },
];

export type TrickEffect =
  | { kind: 'spin'; mult: number; ms: number }
  | { kind: 'shot'; mult: number; pierce: number; range: number }
  | { kind: 'pull'; radius: number; stunMs: number }
  | { kind: 'sweep'; mult: number; radius: number }
  | { kind: 'roll'; mult: number; range: number }
  | { kind: 'orbit'; mult: number; ms: number; radius: number }
  | { kind: 'shield'; ms: number }
  | { kind: 'lift'; scale: number }
  | { kind: 'multi'; mult: number; hits: number }
  | { kind: 'stun'; radius: number; ms: number }
  | { kind: 'gamble'; mult: number }
  | { kind: 'dash'; mult: number; distance: number }
  | { kind: 'star'; mult: number; range: number }
  | { kind: 'mend'; healPct: number }
  | { kind: 'bounce'; mult: number }
  | { kind: 'blast'; mult: number; radius: number }
  | { kind: 'stillness'; ms: number; mult: number; radius: number }
  | { kind: 'kwyjibo'; mult: number; ms: number };

/** what each named trick does in a fight */
export const TRICK_EFFECTS: Record<string, { effect: TrickEffect; blurb: string }> = {
  Sleeper: { effect: { kind: 'spin', mult: 0.5, ms: 3000 }, blurb: 'spins at the aim point, chewing whatever stands there' },
  'Forward Pass': { effect: { kind: 'shot', mult: 1.5, pierce: 4, range: 320 }, blurb: 'a long, fast shot that pierces' },
  'Gravity Pull': { effect: { kind: 'pull', radius: 170, stunMs: 900 }, blurb: 'yanks nearby creatures to you, dazed' },
  Breakaway: { effect: { kind: 'sweep', mult: 1.3, radius: 80 }, blurb: 'a wide sweep with big knockback' },
  'Walk the Dog': { effect: { kind: 'roll', mult: 1.6, range: 260 }, blurb: 'rolls along the ground through everything' },
  'Around the World': { effect: { kind: 'orbit', mult: 0.8, ms: 1600, radius: 70 }, blurb: 'orbits you, hitting all around' },
  'Rock the Baby': { effect: { kind: 'shield', ms: 2500 }, blurb: 'a cradle that turns every hit aside' },
  Elevator: { effect: { kind: 'lift', scale: 1.5 }, blurb: 'climb the string: a huge vertical launch' },
  Creeper: { effect: { kind: 'roll', mult: 2.2, range: 160 }, blurb: 'creeps along the floor, then bites hard' },
  'Hop the Fence': { effect: { kind: 'multi', mult: 0.9, hits: 3 }, blurb: 'three quick strikes on the aim point' },
  'Brain Twister': { effect: { kind: 'stun', radius: 160, ms: 3000 }, blurb: 'every creature nearby reels, stunned' },
  'Double or Nothing': { effect: { kind: 'gamble', mult: 3 }, blurb: 'coin flip: triple damage, or a snapped string' },
  Trapeze: { effect: { kind: 'dash', mult: 1.6, distance: 170 }, blurb: 'swing forward untouchable, striking through' },
  'Split the Atom': { effect: { kind: 'star', mult: 1.5, range: 200 }, blurb: 'four shots, every direction at once' },
  'Skin the Cat': { effect: { kind: 'mend', healPct: 0.15 }, blurb: 'heal 15% and restore a guard pip' },
  'Boingy Boing': { effect: { kind: 'bounce', mult: 2 }, blurb: 'a pogo-high bounce that stomps on landing' },
  'Atom Smasher': { effect: { kind: 'blast', mult: 3, radius: 200 }, blurb: 'a shockwave across the whole screen' },
  'Buddha’s Revenge': { effect: { kind: 'stillness', ms: 3000, mult: 2, radius: 200 }, blurb: 'freeze the field, then strike it' },
  'Cold Fusion': { effect: { kind: 'blast', mult: 3.5, radius: 100 }, blurb: 'the yoyo detonates at the aim point' },
  Kwyjibo: { effect: { kind: 'kwyjibo', mult: 1.2, ms: 3000 }, blurb: 'orbit, mend and a +5 combo: everything at once' },
};

export function tricksFor(tier: number): TrickDef[] {
  const max = YOYOS[tier]?.maxLen ?? 0;
  return TRICKS.filter((t) => t.sequence.length <= max);
}

export type Match = { status: 'fumble' } | { status: 'partial' } | { status: 'ready'; trick: TrickDef; final: boolean };

/**
 * Where a buffer stands against the tricks you know: a dead end (fumble),
 * the start of something (partial), or a complete trick - `final` when no
 * longer known trick continues it, so it can fire without waiting.
 */
export function matchTrick(buffer: TrickInput[], known: TrickDef[]): Match {
  const same = (seq: TrickInput[]) => buffer.every((b, i) => seq[i] === b);
  const prefixes = known.filter((t) => t.sequence.length >= buffer.length && same(t.sequence));
  if (prefixes.length === 0) return { status: 'fumble' };
  const exact = prefixes.find((t) => t.sequence.length === buffer.length);
  if (!exact) return { status: 'partial' };
  return { status: 'ready', trick: exact, final: prefixes.length === 1 };
}

/** seconds allowed per input: tightens with the chain, loosened by the hero stat */
export function trickWindow(chain: number, windowMult: number): number {
  return Math.max(0.55, 1.1 - chain * 0.05) * windowMult;
}
