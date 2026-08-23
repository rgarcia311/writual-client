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

import { SideNavComponent, MobileNavDrawer } from '@/components/SideNav';
import { useIsMobile } from '@/hooks/useIsMobile';
import { DESKTOP_MEDIA_QUERY } from '@/lib/breakpoints';
import '@/styles/appSpacing.css';
import '@/styles/projectDetailsFloat.css';
import '@/styles/mobileLayout.css';

export default function ProjectLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    const pathname = usePathname();
    const isScreenplayRoute = pathname?.includes('/screenplay') ?? false;
    // Chat's panes end flush with the side nav's bottom line, so this box must not clip their
    // radius and elevation shadow — they bleed into `.project-details-page`'s padding.
    const isChatRoute = pathname?.includes('/chat') ?? false;
    // Under 768px the rail is a drawer instead. The two are mutually exclusive: two live
    // `SideNavComponent`s would duplicate the walkthrough's `data-tour="side-nav"` anchor.
    const isMobile = useIsMobile();

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
      {isMobile ? (
        <MobileNavDrawer />
      ) : (
        /*
         * `useIsMobile()` reports desktop on the server and for the first client frame, so the
         * rail would flash across a phone before the drawer took over. This wrapper is hidden by
         * CSS from the very first paint, which resolves before hydration ever runs.
         */
        <Box
          sx={{
            display: 'none',
            flexShrink: 0,
            height: '100%',
            minHeight: 0,
            [`@media ${DESKTOP_MEDIA_QUERY}`]: { display: 'flex' },
          }}
        >
          <SideNavComponent />
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          height: '100%',
          minWidth: 0,
          overflow: isScreenplayRoute || isChatRoute ? 'visible' : 'hidden',
          borderRadius: isScreenplayRoute ? 0 : 'var(--project-float-radius, 12px)',
          bgcolor: isScreenplayRoute ? 'transparent' : 'background.default',
        }}
      >
          {children}
        </Box>
      </Box>
    );
  }
