'use server';

import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { TIER_RANK, type Tier } from '@/types/tier';
import { connectToDatabase, AppUsers } from '../../../api/src/db-connector';

export async function requireTierForAction(minTier: Tier): Promise<void> {
  const jar = await cookies();
  const idToken = jar.get('firebase-token')?.value;
  if (!idToken) throw new Error('Unauthorized');

  const decoded = await adminAuth.verifyIdToken(idToken);
  await connectToDatabase();
  const user = await AppUsers.findOne({ uid: decoded.uid }).lean().exec();
  const tier = ((user as any)?.tier ?? 'beta-access') as Tier;
  if (TIER_RANK[tier] < TIER_RANK[minTier]) {
    throw new Error(`Requires ${minTier} tier or higher`);
  }
}
