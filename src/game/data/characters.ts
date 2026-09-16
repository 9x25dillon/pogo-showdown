export interface Character {
  id: string;
  name: string;
  club: string;
  color: number;
  emoji: string;
  perk: string;
  /** multiplier applied to trick/combo score */
  flairMod: number;
  /** multiplier applied to world scroll speed ramp */
  speedMod: number;
  /** extra hits the player can take before losing a life */
  shield: number;
}

export const CHARACTERS: Character[] = [
  {
    id: 'cleo',
    name: 'Cleo P.',
    club: 'Class President',
    color: 0xf4c430,
    emoji: '\u{1F451}',
    perk: 'Style+ — bigger combo multiplier',
    flairMod: 1.3,
    speedMod: 1,
    shield: 0,
  },
  {
    id: 'khan',
    name: 'Genghis K.',
    club: 'Wrestling Captain',
    color: 0xd9432f,
    emoji: '\u{1F4AA}',
    perk: 'Power+ — shrugs off one extra hit',
    flairMod: 1,
    speedMod: 1,
    shield: 1,
  },
  {
    id: 'joan',
    name: 'Jo of Arc',
    club: 'Fencing Captain',
    color: 0xc0c0c8,
    emoji: '⚔️',
    perk: 'Trick+ — bonus points on clean dodges',
    flairMod: 1.15,
    speedMod: 1,
    shield: 0,
  },
  {
    id: 'einstein',
    name: 'Albert E.',
    club: 'AP Physics TA',
    color: 0x3b82f6,
    emoji: '\u{1F9E0}',
    perk: 'Momentum+ — speed ramps faster',
    flairMod: 1,
    speedMod: 1.25,
    shield: 0,
  },
  {
    id: 'ada',
    name: 'Ada L.',
    club: 'Robotics President',
    color: 0x14b8a6,
    emoji: '\u{1F916}',
    perk: 'Precision+ — wider timing window',
    flairMod: 1,
    speedMod: 0.9,
    shield: 0,
  },
  {
    id: 'suntzu',
    name: 'Sun Tzu',
    club: 'Debate Captain',
    color: 0x22c55e,
    emoji: '\u{1F4D6}',
    perk: 'Tactician — starts each run shielded',
    flairMod: 1,
    speedMod: 1,
    shield: 1,
  },
  {
    id: 'frida',
    name: 'Frida K.',
    club: 'Art Club President',
    color: 0xec4899,
    emoji: '\u{1F3A8}',
    perk: 'Flair+ — chained tricks pay out big',
    flairMod: 1.4,
    speedMod: 0.95,
    shield: 0,
  },
  {
    id: 'leo',
    name: 'Leo da V.',
    club: 'Yearbook / Inventor',
    color: 0xf97316,
    emoji: '\u{1F4A1}',
    perk: 'Gadgets+ — more power-ups spawn',
    flairMod: 1.1,
    speedMod: 1,
    shield: 0,
  },
];
