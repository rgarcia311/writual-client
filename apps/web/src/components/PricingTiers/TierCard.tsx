'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { alpha, useTheme } from '@mui/material/styles';
import type { BillingCycle, PricingTier } from '@/lib/pricing';
import { priceForCycle } from '@/lib/pricing';

export interface TierCardProps {
  tier: PricingTier;
  billingCycle: BillingCycle;
  /** True while this card's button is the one that started the sign-in. */
  busy: boolean;
  /** True while any card is mid sign-in — every button locks, not just the busy one. */
  disabled: boolean;
  /** Label shown in place of "Get Started" while {@link busy}. */
  busyLabel: string;
  /** Set by the `?tier=` deep link, so the linked plan reads as pre-picked. */
  highlighted: boolean;
  onSelect: (tierId: PricingTier['id']) => void;
}

export function TierCard({
  tier,
  billingCycle,
  busy,
  disabled,
  busyLabel,
  highlighted,
  onSelect,
}: TierCardProps) {
  const theme = useTheme();
  const price = priceForCycle(tier, billingCycle);
  const featured = tier.featured;
  const accented = featured || highlighted;

  // The featured card is scaled up in place rather than given a wider flex basis, so the
  // stretch-based equal-height layout is untouched and the card simply overlaps its neighbours.
  // Skipped below `md`, where the cards stack in one column and a scaled card would overflow it.
  const restTransform = featured ? { xs: 'none', md: 'scale(1.06)' } : 'none';
  const hoverTransform = featured
    ? { xs: 'translateY(-4px)', md: 'scale(1.06) translateY(-4px)' }
    : 'translateY(-4px)';

  return (
    <Box
      component="section"
      aria-label={`${tier.title} plan`}
      sx={{
        // Equal-height columns come from the parent's `alignItems: 'stretch'`; this column then
        // stretches the feature list so every "Get Started" button lands on the same baseline.
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minWidth: 0,
        position: 'relative',
        // Lifts the featured card above the siblings it now overlaps.
        zIndex: featured ? 2 : 1,
        p: { xs: 2.5, md: 3 },
        pt: featured ? { xs: 4, md: 4.5 } : { xs: 2.5, md: 3 },
        pb: featured ? { xs: 3.5, md: 3 } : { xs: 2.5, md: 3 },
        borderRadius: 2,
        backgroundColor: theme.palette.background.paper,
        border: accented
          ? `2px solid ${theme.palette.primary.main}`
          : `1px solid ${theme.palette.divider}`,
        // An elevation shadow under the accent glow — the glow alone is too low-contrast to read
        // as depth, so the featured card would not look like it sits in front without it.
        boxShadow: featured
          ? `${theme.shadows[12]}, 0 10px 30px ${alpha(theme.palette.primary.main, 0.45)}`
          : accented
            ? `0 10px 30px ${alpha(theme.palette.primary.main, 0.45)}`
            : 'none',
        transform: restTransform,
        transition: theme.transitions.create(['transform', 'box-shadow'], {
          duration: theme.transitions.duration.short,
        }),
        '&:hover': {
          transform: hoverTransform,
          boxShadow: featured
            ? `${theme.shadows[16]}, 0 16px 38px ${alpha(theme.palette.primary.main, 0.45)}`
            : accented
              ? `0 16px 38px ${alpha(theme.palette.primary.main, 0.45)}`
              : theme.shadows[4],
        },
      }}
    >
      {featured ? (
        <Chip
          label="Most Popular"
          size="small"
          color="primary"
          sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        />
      ) : null}

      <Typography component="h2" variant={featured ? 'h5' : 'h6'} sx={{ fontWeight: 700 }}>
        {tier.title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {tier.tagline}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 2 }}>
        <Typography component="p" variant="h3" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {`$${price}`}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          /month
        </Typography>
      </Box>

      {/* Reserved whether or not the caption has text, so the three price blocks stay aligned. */}
      <Typography
        variant="caption"
        sx={{ display: 'block', minHeight: 20, mt: 0.5, color: 'text.secondary' }}
      >
        {billingCycle === 'yearly'
          ? tier.annualTotal > 0
            ? `Billed as $${tier.annualTotal}/year`
            : 'Free forever'
          : ' '}
      </Typography>

      <Divider sx={{ my: 2.5, borderColor: theme.palette.divider }} />

      <Box
        component="ul"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          listStyle: 'none',
          m: 0,
          p: 0,
        }}
      >
        {tier.features.map((feature) => (
          <Box
            key={feature}
            component="li"
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
          >
            <CheckCircleOutlineIcon
              fontSize="small"
              sx={{ color: theme.palette.primary.main, mt: '2px' }}
            />
            <Typography variant="body2">{feature}</Typography>
          </Box>
        ))}
      </Box>

      <Button
        onClick={() => onSelect(tier.id)}
        disabled={disabled}
        fullWidth
        variant={accented ? 'contained' : 'outlined'}
        color="primary"
        sx={{
          mt: 3,
          py: 1.25,
          borderRadius: 999,
          textTransform: 'none',
          fontSize: 16,
          opacity: disabled && !busy ? 0.6 : 1,
          transition: theme.transitions.create('opacity', {
            duration: theme.transitions.duration.short,
          }),
        }}
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}
      >
        {busy ? busyLabel : 'Get Started'}
      </Button>
    </Box>
  );
}
