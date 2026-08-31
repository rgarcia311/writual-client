'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ProgressMiniDot } from '@/components/ProjectCard/stats/statTileParts';
import { MOBILE_MEDIA_QUERY } from '@/lib/breakpoints';
import type { WritingTracker } from '@/interfaces/project';
import type { ProgressItem, WritingTrackerStatus } from '../../utils/progress';

const STATUS_TEXT: Record<ProgressItem['status'], string> = {
  complete: 'complete',
  partial: 'in progress',
  empty: 'not started',
};

export interface BreadcrumbDevelopmentProgressProps {
  /** Development progress items (Title, Logline, Genre, Type, Characters, Outline, Screenplay). */
  progress: ProgressItem[];
  tracker: WritingTracker | null;
  status: WritingTrackerStatus;
}

/**
 * The development-phase dots as a single inline row for the breadcrumb bar. Unlike the stat-tile
 * row it lived in before, this one has to fit a 56px bar next to the breadcrumbs: the labels sit
 * beside their dots rather than under them, and the row is dropped on mobile, where the bar has no
 * width to spare — the same state is still on the Project Progress card.
 */
export function BreadcrumbDevelopmentProgress({
  progress,
  tracker,
  status,
}: BreadcrumbDevelopmentProgressProps) {
  if (progress.length === 0) return null;

  // Only a tracked project knows how far through its page target it is; without that the
  // Screenplay dot is drawn solid like the rest.
  const screenplayProgressRatio =
    tracker?.enabled && status.pageProgressPercent != null
      ? status.pageProgressPercent / 100
      : null;

  return (
    <Box
      className="project-breadcrumb-progress"
      aria-label="Development progress"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minWidth: 0,
        ml: 2,
        overflow: 'hidden',
        [`@media ${MOBILE_MEDIA_QUERY}`]: { display: 'none' },
      }}
    >
      {progress.map((item) => (
        <Tooltip key={item.label} title={`${item.label} — ${STATUS_TEXT[item.status]}`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <ProgressMiniDot
              status={item.status}
              fillRatio={item.label === 'Screenplay' ? screenplayProgressRatio : null}
              compact
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}
            >
              {item.label}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}
