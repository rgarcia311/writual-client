'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface Props {
  label: string;
}

export function DateSeparator({ label }: Props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', my: 1, px: 2 }}>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
      <Typography variant="caption" color="text.secondary" sx={{ mx: 1, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
    </Box>
  );
}
