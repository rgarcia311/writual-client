'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export interface ProjectStatProps {
  children?: React.ReactNode;
  /** Shown centered when there are no children. */
  placeholder?: string;
  /** Tighter padding and scrolling for small stat tiles (e.g. project header grid). */
  compact?: boolean;
}

export function ProjectStat({ children, placeholder, compact = false }: ProjectStatProps) {
  const hasChildren = Boolean(children);

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: '5px',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        bgcolor: 'background.paper',
        overflow: compact ? 'auto' : 'visible',
      }}
    >
      {hasChildren ? (
        children
      ) : (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: (theme) => theme.spacing(12),
          }}
        >
          <Typography
            variant="body2"
            color="text.disabled"
            sx={{ fontStyle: 'italic', textAlign: 'center' }}
          >
            {placeholder ?? ''}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
