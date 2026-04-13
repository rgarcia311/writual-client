import { AppUsers } from '../db-connector';
import { TIER_RANK, normalizeTier, type Tier } from '@writual/tier-logic';

export async function requireTier(
  context: { uid: string | null },
  minTier: Tier
): Promise<void> {
  if (!context.uid) throw new Error('Unauthorized');
  const user = await AppUsers.findOne({ uid: context.uid }).lean().exec();
  const tier = normalizeTier((user as any)?.tier);
  if (TIER_RANK[tier] < TIER_RANK[minTier]) {
    throw new Error(`Requires ${minTier} tier or higher`);
  }
}
