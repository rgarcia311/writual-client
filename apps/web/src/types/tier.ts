export type Tier = 'spec' | 'indie' | 'greenlit' | 'beta-access';
export const TIER_RANK: Record<Tier, number> = { spec: 1, indie: 2, greenlit: 3, 'beta-access': 4 };

/**
 * Mirrors `MULTI_SCREENPLAY_MIN_TIER` in @writual/tier-logic, which the API enforces. Adding a
 * second screenplay document to a project is greenlit+; the primary document is available at every
 * tier.
 */
export const MULTI_SCREENPLAY_MIN_TIER: Tier = 'greenlit';
