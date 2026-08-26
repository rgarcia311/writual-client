import type { Tier } from '@/types/tier';
import pricingConfig from './pricingTiers.json';

export type BillingCycle = 'monthly' | 'yearly';

export interface PricingTier {
  /** Matches the `Tier` union the API and `@writual/tier-logic` enforce. */
  id: Exclude<Tier, 'beta-access'>;
  title: string;
  tagline: string;
  /** Dollars per month when billed monthly. */
  monthlyPrice: number;
  /**
   * Dollars per month when billed yearly — the number shown on the card. The amount actually
   * charged once a year is {@link annualTotal}, not this value times twelve on a paid block.
   */
  yearlyPricePerMonth: number;
  /** Dollars charged up front on a yearly plan; 0 when the tier is free. */
  annualTotal: number;
  /** Renders the "Most Popular" badge, the accent border and the scaled-up card. */
  featured: boolean;
  features: string[];
}

export interface PricingBlock {
  label: string;
  tiers: PricingTier[];
}

/**
 * Blocks defined in `pricingTiers.json`. Which one renders is the file's own `active` key, so
 * moving off beta pricing is a config edit rather than a code change.
 */
const BLOCKS = pricingConfig.blocks as unknown as Record<string, PricingBlock>;

const ACTIVE_BLOCK_NAME = pricingConfig.active;

const activeBlock = BLOCKS[ACTIVE_BLOCK_NAME];

if (!activeBlock) {
  throw new Error(
    `pricingTiers.json: "active" is "${ACTIVE_BLOCK_NAME}", which is not one of ${Object.keys(
      BLOCKS
    ).join(', ')}`
  );
}

export const PRICING_BLOCK_NAME = ACTIVE_BLOCK_NAME;

export const PRICING_TIERS: readonly PricingTier[] = activeBlock.tiers;

/** True when no tier in the active block costs anything — the beta block, today. */
export const IS_FREE_PRICING_BLOCK = PRICING_TIERS.every(
  (tier) => tier.monthlyPrice === 0 && tier.yearlyPricePerMonth === 0
);

/** `?tier=` values that map onto a tier in the active block; anything else is ignored. */
export function parseTierParam(value: string | null): PricingTier['id'] | null {
  const match = PRICING_TIERS.find((tier) => tier.id === value?.toLowerCase());
  return match ? match.id : null;
}

export function priceForCycle(tier: PricingTier, cycle: BillingCycle): number {
  return cycle === 'yearly' ? tier.yearlyPricePerMonth : tier.monthlyPrice;
}
