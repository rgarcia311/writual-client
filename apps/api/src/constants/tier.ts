export type Tier = 'spec' | 'indie' | 'greenlit' | 'beta-access';
export const TIER_RANK: Record<Tier, number> = { spec: 1, indie: 2, greenlit: 3, 'beta-access': 4 };
