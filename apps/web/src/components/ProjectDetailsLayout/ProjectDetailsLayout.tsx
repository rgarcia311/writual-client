'use client';

import * as React from 'react';
import Container from '@mui/material/Container';
import { ProjectHeader } from '@/components/ProjectHeader';
import type { SxProps, Theme } from '@mui/material/styles';

interface ProjectDetailsLayoutProps {
  children: React.ReactNode;
  /** Optional sx for the inner content container */
  contentSx?: SxProps<Theme>;
}

export function ProjectDetailsLayout({ children, contentSx }: ProjectDetailsLayoutProps) {
  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 2, height: '100%', width: '100%', minWidth: 0, overflow: 'hidden' }}
    >
      <ProjectHeader />
      <Container
        maxWidth={false}
        disableGutters
        sx={
          contentSx
            ? ([{ flex: 1, width: '100%', minWidth: 0, paddingTop: 2, overflow: 'hidden' }, contentSx] as SxProps<Theme>)
            : { flex: 1, width: '100%', minWidth: 0, paddingTop: 2, overflow: 'hidden' }
        }
      >
        {children}
      </Container>
    </Container>
  );
}
