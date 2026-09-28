import { CHARACTERS } from '../data/characters';
import { LEVELS, type LevelDef } from '../data/levels';
import { pogDef, type PogDef } from '../data/pogs';
import { progressFor, TRAINING_SECONDS, type CharacterProgress } from '../systems/characterMastery';
import { dbPut } from './LocalDB';
import { bankXp, grantMilestone } from '../realm/progression';
import { loadRealm, saveRealm } from '../realm/realmSave';
import type { PlatformerResult } from './platformerResult';
import { grantPog } from './pogRepository';
import { getProfile } from './repository';
import type { PlayerProfile, QuestLevelProgress } from './schema';

/**
 * Pog Quest levels are rifts in the Forever Realm. A run pays out into it:
 *   - every clear banks hero XP straight away (a rift is a safe room: no
 *     unbanked risk) and turns coins into copper ore in your realm pack
 *   - the first clear of each level is a Tech Point milestone and grants
 *     that level's reward pog
 */
export const QUEST_FIRST_CLEAR_XP = 150;
export const QUEST_XP_PER_LEVEL = 15;
export const QUEST_REPEAT_XP = 30;
export const COINS_PER_COPPER = 5;
export interface QuestRunReward {
  firstClear: boolean;
  newBestTime: boolean;
  xp: number;
  copper: number;
  trainingEarned: boolean;
  techPointsGranted: number;
  rewardPog: PogDef | null;
  mastery: CharacterProgress;
  level: QuestLevelProgress;
}

export function emptyQuestProgress(): QuestLevelProgress {
  return { attempts: 0, clears: 0, bestTimeSeconds: null, bestCoins: 0 };
}

export function questProgressFor(profile: PlayerProfile, levelId: string): QuestLevelProgress {
  return profile.quest?.[levelId] ?? emptyQuestProgress();
}

/**
 * Level 1 is always open, and so are co-op levels (a second player may
 * want to jump straight in). Every other level opens once the solo level
 * before it has been cleared.
 */
export function isLevelUnlocked(profile: PlayerProfile, index: number): boolean {
  const level = LEVELS[index];
  if (!level) return false;
  if (index === 0 || level.coop) return true;
  for (let i = index - 1; i >= 0; i--) {
    if (!LEVELS[i].coop) return questProgressFor(profile, LEVELS[i].id).clears > 0;
  }
  return true;
}

export async function recordQuestRun(result: PlatformerResult): Promise<QuestRunReward> {
  const level: LevelDef = LEVELS[result.levelIndex] ?? LEVELS[0];
  const profile = await getProfile();
  const won = result.raceOutcome === 'playerWon';

  const characterId = CHARACTERS.find((c) => c.id === result.characterId)?.id ?? CHARACTERS[0].id;
  const previous = progressFor(profile, characterId);
  const trainingEarned = result.elapsedSeconds >= TRAINING_SECONDS;
  const mastery: CharacterProgress = {
    ...previous,
    runs: previous.runs + 1,
    trainingRuns: previous.trainingRuns + (trainingEarned ? 1 : 0),
  };
  profile.characters = { ...profile.characters, [characterId]: mastery };
  profile.lastCharacterId = characterId;

  const before = questProgressFor(profile, level.id);
  const firstClear = won && before.clears === 0;
  const newBestTime = won && (before.bestTimeSeconds === null || result.elapsedSeconds < before.bestTimeSeconds);
  const progress: QuestLevelProgress = {
    attempts: before.attempts + 1,
    clears: before.clears + (won ? 1 : 0),
    bestTimeSeconds: newBestTime ? result.elapsedSeconds : before.bestTimeSeconds,
    bestCoins: won ? Math.max(before.bestCoins, result.coins) : before.bestCoins,
  };
  profile.quest = { ...profile.quest, [level.id]: progress };
  profile.updatedAt = new Date().toISOString();
  await dbPut('profile', profile);

  let techPointsGranted = 0;
  let rewardPog: PogDef | null = null;
  const xp = won ? (firstClear ? QUEST_FIRST_CLEAR_XP + result.levelIndex * QUEST_XP_PER_LEVEL : QUEST_REPEAT_XP) : 0;
  if (xp) await bankXp(characterId, xp);
  const copper = won ? Math.floor(result.coins / COINS_PER_COPPER) : 0;
  const realm = copper ? await loadRealm() : undefined;
  if (realm) {
    const { id: _id, version: _v, savedAt: _at, ...rest } = realm;
    await saveRealm({ ...rest, inventory: { ...rest.inventory, copper: (rest.inventory.copper ?? 0) + copper } });
  }
  if (firstClear) {
    if (await grantMilestone(`quest:${level.id}`)) techPointsGranted += 1;
    const def = level.rewardPogId ? pogDef(level.rewardPogId) : undefined;
    if (def) {
      await grantPog(def.id, `quest:${level.id}`);
      rewardPog = def;
    }
  }

  return { firstClear, newBestTime, xp, copper: realm ? copper : 0, trainingEarned, techPointsGranted, rewardPog, mastery, level: progress };
}
