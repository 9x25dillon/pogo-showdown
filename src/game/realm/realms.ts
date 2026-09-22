import type { ItemId } from './items';
import type { RealmEnemyId } from './realmEnemies';

/**
 * Chakan's elemental realms, entered through the shrine near the
 * overworld spawn. Each is regenerated on every visit (a dungeon, not
 * a home), ends in a boss arena, and its boss drops a relic that
 * permanently changes how you play.
 */
export type PocketId = 'ember' | 'tide' | 'gale' | 'grave';
export type RelicId = PocketId;
export type BossId = 'tyrant' | 'leviathan' | 'harpy' | 'king';

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
  hazard: 'heat' | 'water' | 'void' | 'dark';
  enemies: RealmEnemyId[];
  spawnCap: number;
  boss: BossId;
  bossName: string;
  /** what the boss drops besides its relic */
  loot: { item: ItemId; count: number };
}

export const POCKETS: Record<PocketId, PocketDef> = {
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
};

export const POCKET_ORDER: PocketId[] = ['ember', 'tide', 'gale', 'grave'];

export const RELICS: Record<RelicId, { name: string; icon: string; power: string }> = {
  ember: { name: 'Ember Heart', icon: '🔥', power: 'immune to heat and lava · +4 sword damage' },
  tide: { name: 'Tide Pearl', icon: '💧', power: 'breathe underwater · swim at full speed' },
  gale: { name: 'Gale Plume', icon: '🪶', power: 'double jump, everywhere' },
  grave: { name: 'Hollow Crown', icon: '👑', power: '+50 max HP' },
};
