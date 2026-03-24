import { AppUsers } from '../db-connector';
import { TIER_RANK, type Tier } from '../constants/tier';

export async function requireTier(
  context: { uid: string | null },
  minTier: Tier
): Promise<void> {
  if (!context.uid) throw new Error('Unauthorized');
  const user = await AppUsers.findOne({ uid: context.uid }).lean().exec();
  const tier = ((user as any)?.tier ?? 'spec') as Tier;
  if (TIER_RANK[tier] < TIER_RANK[minTier]) {
    throw new Error(`Requires ${minTier} tier or higher`);
  }
}
