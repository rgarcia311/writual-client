export type Tier = 'spec' | 'indie' | 'greenlit' | 'beta-access';

export const TIER_RANK: Record<Tier, number> = {
  spec: 1,
  indie: 2,
  greenlit: 3,
  'beta-access': 4,
};

const VALID_TIERS = new Set<string>(Object.keys(TIER_RANK));

export function normalizeTier(raw: unknown): Tier {
  if (typeof raw === 'string' && VALID_TIERS.has(raw)) {
    return raw as Tier;
  }
  return 'spec';
}
