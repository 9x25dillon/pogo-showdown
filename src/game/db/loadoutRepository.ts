import { TIER_CUMULATIVE_COST, TP_PER_QUEST_CLEAR } from '../data/loadoutData';
import { dbGet, dbPut } from './LocalDB';
import type { AxisState, PlayerLoadout } from './loadoutSchema';

function freshAxis(): AxisState {
  return { tier: 0, unlockedAtRun: -1 };
}

function newLoadout(): PlayerLoadout {
  return {
    id: 'me',
    techPointsEarned: 0,
    techPointsFromWins: 0,
    techPointsSpent: 0,
    pog: freshAxis(),
    yoyo: freshAxis(),
    mastery: freshAxis(),
    characterMasteryMigrated: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function getLoadout(): Promise<PlayerLoadout> {
  const existing = await dbGet<PlayerLoadout>('loadout', 'me');
  if (existing) {
    if (!existing.characterMasteryMigrated) {
      const refund = TIER_CUMULATIVE_COST[existing.mastery.tier];
      existing.techPointsSpent = Math.max(0, existing.techPointsSpent - refund);
      existing.masteryRefund = refund;
      existing.mastery = freshAxis();
      existing.characterMasteryMigrated = true;
      existing.updatedAt = new Date().toISOString();
      await dbPut('loadout', existing);
    }
    return existing;
  }
  const created = newLoadout();
  await dbPut('loadout', created);
  return created;
}

export function techPointsAvailable(loadout: PlayerLoadout): number {
  return loadout.techPointsEarned - loadout.techPointsSpent;
}

/** call once per Pog Quest level, on its first clear - finite, one per level */
export async function grantQuestClearBonus(): Promise<boolean> {
  const loadout = await getLoadout();
  loadout.techPointsEarned += TP_PER_QUEST_CLEAR;
  loadout.updatedAt = new Date().toISOString();
  await dbPut('loadout', loadout);
  return true;
}
