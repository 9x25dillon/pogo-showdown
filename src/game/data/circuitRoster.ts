export interface CircuitPro {
  id: string;
  name: string;
  epithet: string;
  color: number;
  emoji: string;
  /** 1-99, drives simulated match performance */
  skill: number;
}

export const CIRCUIT_ROSTER: CircuitPro[] = [
  { id: 'napoleon', name: 'Napoleon B.', epithet: 'The Little General', color: 0x1d4ed8, emoji: '\u{1F451}', skill: 88 },
  { id: 'nefertiti', name: 'Nefertiti', epithet: 'The Crown', color: 0xeab308, emoji: '☁️', skill: 91 },
  { id: 'earhart', name: 'Amelia E.', epithet: 'Sky Queen', color: 0x0ea5e9, emoji: '✈️', skill: 87 },
  { id: 'tubman', name: 'Harriet T.', epithet: 'The Conductor', color: 0x78350f, emoji: '\u{1F31F}', skill: 93 },
  { id: 'curie', name: 'Marie C.', epithet: 'The Glow', color: 0x22d3ee, emoji: '☢️', skill: 90 },
  { id: 'tesla', name: 'Nikola T.', epithet: 'The Current', color: 0x7c3aed, emoji: '⚡', skill: 89 },
  { id: 'brucelee', name: 'Bruce L.', epithet: 'The Storm', color: 0xdc2626, emoji: '\u{1F409}', skill: 97 },
  { id: 'elizabeth', name: 'Elizabeth I', epithet: 'The Virgin Queen', color: 0xa855f7, emoji: '\u{1F48E}', skill: 86 },
  { id: 'hannibal', name: 'Hannibal B.', epithet: 'The Alps Breaker', color: 0x92400e, emoji: '\u{1F418}', skill: 92 },
  { id: 'chingshih', name: 'Ching Shih', epithet: 'The Pirate Queen', color: 0x0f766e, emoji: '☠️', skill: 94 },
  { id: 'musashi', name: 'Miyamoto M.', epithet: 'The Blade', color: 0x334155, emoji: '⚔️', skill: 96 },
];
