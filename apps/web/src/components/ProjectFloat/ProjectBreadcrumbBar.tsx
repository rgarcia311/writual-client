'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import { projectStyles } from 'styles';
import { MOBILE_MEDIA_QUERY } from '@/lib/breakpoints';
import { useMobileNavStore } from '@/state/mobileNav';

export interface ProjectBreadcrumbBarProps {
  projectTitle: string;
  projectHref: string;
  currentPageLabel: string | null;
  rightAdornment?: React.ReactNode;
}

export function ProjectBreadcrumbBar({
  projectTitle,
  projectHref,
  currentPageLabel,
  rightAdornment,
}: ProjectBreadcrumbBarProps) {
  const toggleMobileNav = useMobileNavStore((s) => s.toggle);

  return (
    <Box
      component="header"
      data-tour="project-breadcrumb"
      className="project-breadcrumb-bar"
      sx={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        minHeight: 'var(--project-breadcrumb-row-height, 56px)',
        height: 'var(--project-breadcrumb-row-height, 56px)',
        borderBottom: 1,
        borderColor: 'divider',
        pl: 'var(--app-body-padding, 8px)',
        pr: 'var(--app-body-padding, 8px)',
        pt: 0,
        zIndex: 'var(--z-index-breadcrumbs, 20)',
        position: 'relative',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        {/*
          Shown by CSS rather than by `useIsMobile()`: the button then paints correctly on the
          very first frame, with no hydration-time swap.
        */}
        <IconButton
          aria-label="Open navigation menu"
          size="small"
          onClick={toggleMobileNav}
          sx={{
            display: 'none',
            mr: 0.5,
            flexShrink: 0,
            [`@media ${MOBILE_MEDIA_QUERY}`]: { display: 'inline-flex' },
          }}
        >
          <MenuIcon />
        </IconButton>
        <Breadcrumbs
          aria-label="breadcrumb"
          sx={{
            ...projectStyles.tableTopButtons,
            minWidth: 0,
            width: '100%',
            height: 'auto',
            minHeight: 0,
            alignItems: 'center',
          }}
        >
          <Link underline="hover" color="inherit" href="/projects">
            <Typography variant="h6">Projects</Typography>
          </Link>
          {currentPageLabel ? (
            <Link underline="hover" color="inherit" href={projectHref}>
              <Typography variant="h6">{projectTitle}</Typography>
            </Link>
          ) : null}
          <Typography sx={{ fontWeight: 700 }} variant="h6">
            {currentPageLabel ?? projectTitle}
          </Typography>
        </Breadcrumbs>
      </Box>
      {rightAdornment ? (
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{rightAdornment}</Box>
      ) : null}
    </Box>
  );
}
