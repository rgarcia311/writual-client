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

/**
 * Holding more than one screenplay document on a project — extra drafts, alternate cuts, an
 * imported PDF kept alongside the original — is a greenlit+ capability. Every project keeps its
 * single primary document at any tier; only *adding* to it is gated.
 */
export const MULTI_SCREENPLAY_MIN_TIER: Tier = 'greenlit';

export function canCreateAdditionalScreenplays(tier: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[MULTI_SCREENPLAY_MIN_TIER];
}
