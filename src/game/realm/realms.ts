import type { ItemId } from './items';
import type { RealmEnemyId } from './realmEnemies';

/**
 * Chakan's elemental realms, entered through the shrine near the
 * overworld spawn. Each is regenerated on every visit (a dungeon, not
 * a home), ends in a boss arena, and its boss drops a relic that
 * permanently changes how you play.
 */
export type PocketId = 'ember' | 'tide' | 'gale' | 'grave' | 'forever' | 'foundry';
/** the four relics come from the four elemental realms; the Eternal Hall has none */
export type RelicId = Exclude<PocketId, 'forever' | 'foundry'>;
export type BossId = 'tyrant' | 'leviathan' | 'harpy' | 'king' | 'reaper' | 'warden';

export interface PocketDef {
  id: PocketId;
  name: string;
  /** shown over its portal in the shrine */
  blurb: string;
  /** suggested order, 1-4 */
  tier: number;
  portalColor: number;
  sky: number;
  /** how dark it is with no light at all (0-1) */
  darkness: number;
  hazard: 'heat' | 'water' | 'void' | 'dark' | 'machinery';
  enemies: RealmEnemyId[];
  spawnCap: number;
  boss: BossId;
  bossName: string;
  /** what the boss drops besides its relic */
  loot: { item: ItemId; count: number };
}

export const POCKETS: Record<PocketId, PocketDef> = {
  foundry: {
    id: 'foundry', name: 'Buried Foundry', blurb: 'lost ruins · steam halls · hidden caches', tier: 1, portalColor: 0xfbbf24, sky: 0x101c25, darkness: 0.38,
    hazard: 'machinery', enemies: ['crawler'], spawnCap: 0, boss: 'warden', bossName: 'Clockwork Warden', loot: { item: 'iron', count: 12 },
  },
  ember: {
    id: 'ember', name: 'Ember Realm', blurb: 'heat · lava · imps', tier: 1, portalColor: 0xf97316, sky: 0x2a0a06, darkness: 0.55,
    hazard: 'heat', enemies: ['imp', 'imp', 'slime'], spawnCap: 5, boss: 'tyrant', bossName: 'Cinder Tyrant', loot: { item: 'ember', count: 12 },
  },
  tide: {
    id: 'tide', name: 'Tide Realm', blurb: 'drowned caves · eels', tier: 2, portalColor: 0x38bdf8, sky: 0x05203a, darkness: 0.6,
    hazard: 'water', enemies: ['eel', 'eel', 'crawler'], spawnCap: 5, boss: 'leviathan', bossName: 'Leviathan', loot: { item: 'pearl', count: 8 },
  },
  gale: {
    id: 'gale', name: 'Gale Realm', blurb: 'sky islands · wind · harpies', tier: 3, portalColor: 0xe2e8f0, sky: 0x4d6a94, darkness: 0,
    hazard: 'void', enemies: ['harpy', 'harpy', 'wraith'], spawnCap: 5, boss: 'harpy', bossName: 'Harpy Queen', loot: { item: 'feather', count: 10 },
  },
  grave: {
    id: 'grave', name: 'Grave Realm', blurb: 'the dark · the dead', tier: 4, portalColor: 0xa78bfa, sky: 0x050308, darkness: 0.97,
    hazard: 'dark', enemies: ['knight', 'knight', 'wraith'], spawnCap: 6, boss: 'king', bossName: 'Hollow King', loot: { item: 'dust', count: 10 },
  },
  // behind the Forever Gate: all four realms in one gauntlet, then the throne. Its hazard and
  // darkness change by segment (see FOREVER_SEGMENTS); the values here are the throne room's.
  forever: {
    id: 'forever', name: 'The Eternal Hall', blurb: 'every realm at once · the end of it', tier: 5, portalColor: 0xfde68a, sky: 0x07040c, darkness: 0.8,
    hazard: 'dark', enemies: ['imp', 'harpy', 'knight', 'wraith'], spawnCap: 5, boss: 'reaper', bossName: 'The Eternal Reaper', loot: { item: 'soulstone', count: 20 },
  },
};

/** the four elemental realms, in suggested order (the shrine's portals) */
export const POCKET_ORDER: RelicId[] = ['ember', 'tide', 'gale', 'grave'];

/** the Eternal Hall's gauntlet: [x0, x1) tile columns and the realm each one borrows its hazard from */
export const FOREVER_SEGMENTS: { x0: number; x1: number; like: RelicId }[] = [
  { x0: 0, x1: 52, like: 'ember' },
  { x0: 52, x1: 100, like: 'tide' },
  { x0: 100, x1: 150, like: 'gale' },
  { x0: 150, x1: 196, like: 'grave' },
];

export const RELICS: Record<RelicId, { name: string; icon: string; power: string }> = {
  ember: { name: 'Ember Heart', icon: '🔥', power: 'immune to heat and lava · +4 sword damage' },
  tide: { name: 'Tide Pearl', icon: '💧', power: 'breathe underwater · swim at full speed' },
  gale: { name: 'Gale Plume', icon: '🪶', power: 'double jump, everywhere' },
  grave: { name: 'Hollow Crown', icon: '👑', power: '+50 max HP' },
};
