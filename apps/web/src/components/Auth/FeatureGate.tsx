'use client';

import * as React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useUserProfileStore } from '@/state/user';
import { TIER_RANK, type Tier } from '@/types/tier';

interface FeatureGateProps {
  minTier: Tier;
  children: React.ReactNode;
  /** 'inline' wraps a single button/element with a disabled+tooltip; 'page' shows a full lock screen */
  variant?: 'inline' | 'page';
}

export function FeatureGate({ minTier, children, variant = 'inline' }: FeatureGateProps) {
  const tier = useUserProfileStore((s) => s.userProfile?.tier ?? 'beta-access');
  const hasAccess = TIER_RANK[tier] >= TIER_RANK[minTier];

  if (hasAccess) return <>{children}</>;

  if (variant === 'page') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
          color: 'text.secondary',
        }}
      >
        <LockIcon sx={{ fontSize: 48 }} />
        <Typography variant="h6">Requires {minTier} tier or higher</Typography>
        <Typography variant="body2">Upgrade your plan to access this feature.</Typography>
      </Box>
    );
  }

  // inline: clone child with disabled=true, wrap in Box span so MUI Tooltip works on disabled elements
  const child = React.Children.only(children) as React.ReactElement<any>;
  return (
    <Tooltip title={`Requires ${minTier} tier or higher`} arrow>
      <Box component="span" sx={{ display: 'inline-flex', cursor: 'not-allowed' }}>
        {React.cloneElement(child, { disabled: true })}
      </Box>
    </Tooltip>
  );
}
