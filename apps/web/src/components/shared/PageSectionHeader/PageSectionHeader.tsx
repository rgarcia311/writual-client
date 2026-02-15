'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/material';

interface PageSectionHeaderProps {
  /** Section title (e.g. "Characters", "Inspiration", "Outline") */
  title: string;
  /** Optional action(s) on the right (e.g. primary button, or button + menu) */
  action?: React.ReactNode;
  /** Optional content after the title on the left (e.g. saving/saved indicator) */
  leftAdornment?: React.ReactNode;
}

export function PageSectionHeader({ title, action, leftAdornment }: PageSectionHeaderProps) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          {title}
        </Typography>
        {leftAdornment}
      </Box>
      {action}
    </Box>
  );
}
