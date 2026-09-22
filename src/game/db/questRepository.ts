import { CHARACTERS } from '../data/characters';
import { LEVELS, type LevelDef } from '../data/levels';
import { pogDef, type PogDef } from '../data/pogs';
import { progressFor, TRAINING_SECONDS, type CharacterProgress } from '../systems/characterMastery';
import { dbPut } from './LocalDB';
import { grantQuestClearBonus } from './loadoutRepository';
import type { PlatformerResult } from './platformerResult';
import { grantPog } from './pogRepository';
import { getProfile } from './repository';
import type { PlayerProfile, QuestLevelProgress } from './schema';

/**
 * How Pog Quest feeds the wider economy:
 *   - any attempt of TRAINING_SECONDS or longer counts as a training run
 *     for the character (the same rule Pogo Dash uses), which is what
 *     character mastery and the Circuit Advantage read
 *   - the first clear of each level grants +1 Tech Point and that
 *     level's reward pog
 * It never touches career tier, careerBestScore, totalRuns or the
 * Circuit match: those are Pogo Dash score-shaped and stay that way.
 */
export interface QuestRunReward {
  firstClear: boolean;
  newBestTime: boolean;
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
  if (firstClear) {
    if (await grantQuestClearBonus()) techPointsGranted += 1;
    const def = level.rewardPogId ? pogDef(level.rewardPogId) : undefined;
    if (def) {
      await grantPog(def.id, `quest:${level.id}`);
      rewardPog = def;
    }
  }

  return { firstClear, newBestTime, trainingEarned, techPointsGranted, rewardPog, mastery, level: progress };
}
