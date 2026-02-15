'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/material';

interface PlaceholderMessageProps {
  /** Message to display (default: "Coming Soon") */
  message?: string;
}

export function PlaceholderMessage({ message = 'Coming Soon' }: PlaceholderMessageProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontSize: 40 }}
      >
        {message}
      </Typography>
    </Box>
  );
}
