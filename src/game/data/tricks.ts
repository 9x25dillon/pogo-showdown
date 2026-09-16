/**
 * Yoyo Trick Lab trick table. Each trick is a short input sequence the
 * player has to reproduce with swipes/taps inside a timing window.
 * Names are real yoyo tricks; the input patterns are invented to feel
 * like the motion (Walk the Dog = down then forward, etc).
 */
export type TrickInput = 'up' | 'down' | 'left' | 'right' | 'tap';

export interface TrickDef {
  name: string;
  sequence: TrickInput[];
}

export const INPUT_GLYPH: Record<TrickInput, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  tap: '●',
};

export const TRICKS: TrickDef[] = [
  // 2 inputs — warm-ups
  { name: 'Sleeper', sequence: ['down', 'tap'] },
  { name: 'Forward Pass', sequence: ['right', 'tap'] },
  { name: 'Gravity Pull', sequence: ['down', 'up'] },
  { name: 'Breakaway', sequence: ['left', 'right'] },
  // 3 inputs
  { name: 'Walk the Dog', sequence: ['down', 'right', 'up'] },
  { name: 'Around the World', sequence: ['up', 'right', 'down'] },
  { name: 'Rock the Baby', sequence: ['down', 'left', 'right'] },
  { name: 'Elevator', sequence: ['down', 'tap', 'up'] },
  { name: 'Creeper', sequence: ['down', 'right', 'tap'] },
  { name: 'Hop the Fence', sequence: ['up', 'down', 'up'] },
  // 4 inputs
  { name: 'Brain Twister', sequence: ['down', 'up', 'left', 'up'] },
  { name: 'Double or Nothing', sequence: ['right', 'left', 'right', 'tap'] },
  { name: 'Trapeze', sequence: ['left', 'right', 'tap', 'up'] },
  { name: 'Split the Atom', sequence: ['down', 'left', 'up', 'right'] },
  { name: 'Skin the Cat', sequence: ['up', 'left', 'down', 'tap'] },
  { name: 'Boingy Boing', sequence: ['up', 'down', 'up', 'down'] },
  // 5 inputs — for deep combos
  { name: 'Atom Smasher', sequence: ['down', 'left', 'right', 'up', 'tap'] },
  { name: 'Buddha’s Revenge', sequence: ['left', 'up', 'right', 'down', 'tap'] },
  { name: 'Cold Fusion', sequence: ['right', 'tap', 'left', 'up', 'down'] },
  { name: 'Kwyjibo', sequence: ['up', 'right', 'up', 'left', 'tap'] },
];

/** which sequence lengths are in play at a given number of landed tricks */
export function lengthsForProgress(landed: number): [number, number] {
  if (landed < 4) return [2, 3];
  if (landed < 10) return [3, 4];
  if (landed < 18) return [4, 5];
  return [5, 5];
}

/** seconds allowed per input, tightening as the session goes on */
export function windowPerInput(landed: number): number {
  return Math.max(0.55, 1.1 - landed * 0.025);
}
