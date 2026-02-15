'use client';

import * as React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

const defaultSx: SxProps<Theme> = {
  width: '100%',
  maxWidth: '100%',
  height: '90%',
  paddingTop: 5,
  overflowY: 'scroll',
  overflowX: 'hidden',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 2,
  padding: 2,
  minWidth: 0,
};

interface ScrollableContentAreaProps {
  children: React.ReactNode;
  /** Optional sx to merge with or override defaults (applied after defaultSx) */
  sx?: SxProps<Theme>;
}

export function ScrollableContentArea({ children, sx }: ScrollableContentAreaProps) {
  return <Box sx={sx ? [defaultSx, sx] : defaultSx}>{children}</Box>;
}
