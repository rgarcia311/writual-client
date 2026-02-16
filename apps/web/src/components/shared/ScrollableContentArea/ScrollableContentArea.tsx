'use client';

import * as React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

const defaultSx: SxProps<Theme> = {
  width: '100%',
  maxWidth: '100%',
  height: '91%',
  paddingTop: 5,
  overflowY: 'scroll',
  overflowX: 'hidden',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  gap: "8px",
  padding: 1,
  minWidth: 0,
};

interface ScrollableContentAreaProps {
  children: React.ReactNode;
  /** Optional sx to merge with or override defaults (applied after defaultSx) */
  sx?: SxProps<Theme>;
}

export function ScrollableContentArea({ children, sx }: ScrollableContentAreaProps) {
  const resolvedSx =
    sx && typeof sx === 'object' && !Array.isArray(sx)
      ? { ...defaultSx, ...sx }
      : defaultSx;
  return <Box sx={resolvedSx as SxProps<Theme>}>{children}</Box>;
}
