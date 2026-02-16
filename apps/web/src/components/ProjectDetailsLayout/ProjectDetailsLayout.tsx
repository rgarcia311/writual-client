'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { ProjectHeader } from '@/components/ProjectHeader';
import type { SxProps, Theme } from '@mui/material/styles';

interface ProjectDetailsLayoutProps {
  children: React.ReactNode;
  /** Optional sx for the inner content container */
  contentSx?: SxProps<Theme>;
  /** Section title shown in the header (e.g. "Outline", "Inspiration") */
  headerTitle?: string;
  /** Optional action(s) on the right side of the header (e.g. primary button) */
  headerAction?: React.ReactNode;
  /** Optional content after the title on the left (e.g. saving/saved indicator) */
  headerLeftAdornment?: React.ReactNode;
}

export function ProjectDetailsLayout({
  children,
  contentSx,
  headerTitle,
  headerAction,
  headerLeftAdornment,
}: ProjectDetailsLayoutProps) {
  const showHeader =
    headerTitle !== undefined || headerAction !== undefined || headerLeftAdornment !== undefined;

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
        {showHeader && (
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
              {headerTitle != null && (
                <Typography variant="h6" fontWeight={600}>
                  {headerTitle}
                </Typography>
              )}
              {headerLeftAdornment}
            </Box>
            {headerAction}
          </Box>
        )}
        {children}
      </Container>
    </Container>
  );
}
