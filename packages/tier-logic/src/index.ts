export type Tier = 'spec' | 'indie' | 'greenlit' | 'beta-access';

export const TIER_RANK: Record<Tier, number> = {
  spec: 1,
  indie: 2,
  greenlit: 3,
  'beta-access': 4,
};

const VALID_TIERS = new Set<string>(Object.keys(TIER_RANK));

// BETA OVERRIDE: all users get top-tier access while in beta, regardless of
// their stored tier. Remove this early-return to restore real tier checks.
const BETA_ALL_ACCESS = true;

export function normalizeTier(raw: unknown): Tier {
  if (BETA_ALL_ACCESS) {
    return 'beta-access';
  }
  if (typeof raw === 'string' && VALID_TIERS.has(raw)) {
    return raw as Tier;
  }
  return 'spec';
}
