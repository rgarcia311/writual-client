'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ProjectFloatShell } from '@/components/ProjectFloat';
import type { ProjectStatTileKey } from '@/components/ProjectFloat';
import type { SxProps, Theme } from '@mui/material/styles';

/** Inner scroll/content region — padded on most routes; Screenplay overrides via `contentSx`. */
const MAIN_CONTENT_CONTAINER_SX = {
  flex: 1,
  width: '100%',
  minWidth: 0,
  pl: 'var(--app-body-padding, 8px)',
  pt: 'var(--app-body-padding, 8px)',
  overflow: 'hidden',
} as const;

interface ProjectDetailsLayoutProps {
  children: React.ReactNode;
  contentSx?: SxProps<Theme>;
  headerTitle?: string;
  headerAction?: React.ReactNode;
  headerLeftAdornment?: React.ReactNode;
  breadcrumbRightAdornment?: React.ReactNode;
  /** @deprecated Use `breadcrumbRightAdornment` */
  accordionAdornment?: React.ReactNode;
  contentBleed?: boolean;
  /** Hide shell poster/info hero (screenplay shows them in the stats side tab). */
  hideFloatHero?: boolean;
  shellClassName?: string;
  showFloatStatsRail?: boolean;
  floatStatsRailKeys?: ProjectStatTileKey[];
  floatContentOverlay?: boolean;
}

export function ProjectDetailsLayout({
  children,
  contentSx,
  headerTitle,
  headerAction,
  headerLeftAdornment,
  breadcrumbRightAdornment,
  accordionAdornment,
  contentBleed = false,
  hideFloatHero = false,
  shellClassName,
  showFloatStatsRail = false,
  floatStatsRailKeys,
  floatContentOverlay = false,
}: ProjectDetailsLayoutProps) {
  const rightAdornment = breadcrumbRightAdornment ?? accordionAdornment;
  const showHeader =
    headerTitle !== undefined || headerAction !== undefined || headerLeftAdornment !== undefined;

  const pageChrome = showHeader ? (
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
  ) : null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        pl: 0,
        pr: 0,
        pb: 0,
      }}
    >
      <ProjectFloatShell
        breadcrumbRightAdornment={rightAdornment}
        pageChrome={pageChrome}
        contentBleed={contentBleed}
        hideFloatHero={hideFloatHero}
        shellClassName={shellClassName}
        showFloatStatsRail={showFloatStatsRail}
        floatStatsRailKeys={floatStatsRailKeys}
        floatContentOverlay={floatContentOverlay}
      >
        <Box
          sx={
            contentSx
              ? ([MAIN_CONTENT_CONTAINER_SX, contentSx] as SxProps<Theme>)
              : { ...MAIN_CONTENT_CONTAINER_SX }
          }
        >
          {children}
        </Box>
      </ProjectFloatShell>
    </Box>
  );
}
