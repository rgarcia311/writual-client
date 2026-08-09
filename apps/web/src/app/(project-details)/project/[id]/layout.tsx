"use client"

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Box } from '@mui/material';
import '@fontsource/lato/100.css'
import '@fontsource/lato/300.css'
import '@fontsource/lato'
import '@fontsource/lato/700.css'
import '@fontsource/lato/900.css';
import '@fontsource/varela-round';

import { SideNavComponent } from '@/components/SideNav';
import '@/styles/appSpacing.css';
import '@/styles/projectDetailsFloat.css';

export default function ProjectLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    const pathname = usePathname();
    const isScreenplayRoute = pathname?.includes('/screenplay') ?? false;

    return (
    <Box
      className={`project-details-page${isScreenplayRoute ? ' project-details-page--screenplay' : ''}`}
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <SideNavComponent />
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          height: '100%',
          minWidth: 0,
          overflow: isScreenplayRoute ? 'visible' : 'hidden',
          borderRadius: isScreenplayRoute ? 0 : 'var(--project-float-radius, 12px)',
          bgcolor: isScreenplayRoute ? 'transparent' : 'background.default',
        }}
      >
          {children}
        </Box>
      </Box>
    );
  }
