'use client';

import * as React from 'react';
import { Paper } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface EditorPaperProps {
  children: React.ReactNode;
  /** Optional sx overrides */
  sx?: SxProps<Theme>;
}

/** Paper container with 8.5" × 11" aspect ratio and elevation for housing the Tiptap editor */
export function EditorPaper({ children, sx }: EditorPaperProps) {
  return (
    <Paper
      elevation={3}
      sx={{
        aspectRatio: '8.5 / 11',
        maxWidth: '8.5in',
        maxHeight: '11in',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        //border: '1px solid green',
 
            flex: 1,
            position: 'relative',
            '& .tiptap': {
              outline: 'none',
              px: 2,
              py: 2,
              flex: 1,
              overflow: 'auto',
              '& p.is-editor-empty:first-of-type::before': {
                content: 'attr(data-placeholder)',
                float: 'left',
                color: 'text.disabled',
                pointerEvents: 'none',
              },
            },
        ...sx,
        zIndex: 1000,
      }}
    >
      {children}
    </Paper>
  );
}
