'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useTheme } from '@mui/material/styles';
import type { WritingTracker } from '@/interfaces/project';
import type {
  DevelopmentLockSummary,
  ProgressItem,
  TrackerScheduleStatus,
  WritingTrackerStatus,
} from '../../../utils/progress';
import {
  PagesProgressBar,
  StatGridCell,
  StatTileStack,
  TileHeading,
  TILE_META_SIZE,
  tileIconSx,
  tileRowGap,
} from './statTileParts';

const HEALTH_LABEL: Record<TrackerScheduleStatus, string> = {
  ahead: 'Ahead of schedule',
  on_track: 'On track',
  behind: 'Behind schedule',
  no_data: '—',
};

const PHASE_BY_LABEL: Record<string, string> = {
  Title: 'Project setup',
  Logline: 'Logline development',
  Genre: 'Project setup',
  Type: 'Project setup',
  Characters: 'Character development',
  Outline: 'Outline development',
  Screenplay: 'Screenplay writing',
};

interface ProjectProgressStatProps {
  /** Development progress items (Title, Logline, Genre, Type, Characters, Outline, Screenplay). */
  progress: ProgressItem[];
  /** Character/outline roster counts and section lock state. */
  development: DevelopmentLockSummary;
  tracker: WritingTracker | null;
  status: WritingTrackerStatus;
  compact?: boolean;
}

/** The phase the project is currently in — the first item that isn't finished. */
function currentPhaseLabel(items: ProgressItem[]): string {
  const partial = items.find((p) => p.status === 'partial');
  if (partial) return PHASE_BY_LABEL[partial.label] ?? `${partial.label} in progress`;
  const empty = items.find((p) => p.status === 'empty');
  if (empty) return PHASE_BY_LABEL[empty.label] ?? `${empty.label} not started`;
  return 'Production-ready';
}

/** "8 of 12 locked", or an empty-roster note. */
function lockedCountText(locked: number, total: number, itemNoun: string): string {
  if (total === 0) return `No ${itemNoun} yet`;
  return `${locked} of ${total} locked`;
}

export function ProjectProgressStat({
  progress,
  development,
  tracker,
  status,
  compact = false,
}: ProjectProgressStatProps) {
  const theme = useTheme();
  const trackerEnabled = Boolean(tracker?.enabled);
  const target = tracker?.targetPageCount ?? 0;
  const current = status.resolvedCurrentPages;
  const pct = status.pageProgressPercent ?? 0;

  const scheduleColor = (s: TrackerScheduleStatus): string => {
    if (s === 'ahead') return theme.palette.success.main;
    if (s === 'on_track') return theme.palette.warning.main;
    if (s === 'behind') return theme.palette.error.main;
    return theme.palette.text.disabled;
  };

  const healthColor = trackerEnabled
    ? scheduleColor(status.scheduleStatus)
    : theme.palette.text.disabled;
  const healthText = trackerEnabled ? HEALTH_LABEL[status.scheduleStatus] : 'Tracking off';

  const lockIconSx = { fontSize: compact ? 15 : 18, flexShrink: 0 };
  const charactersLocked = development.charactersSectionLocked;
  const scenesLocked = development.outlineSectionLocked;

  return (
    <StatTileStack
      compact={compact}
      heading={
        <TileHeading
          title="Project Progress"
          compact={compact}
          icon={
            <TrendingUpIcon sx={tileIconSx(compact)} aria-hidden />
          }
        />
      }
    >
      {trackerEnabled ? (
        <PagesProgressBar
          label={target > 0 ? `${current} / ${target} Pages (${pct}%)` : `${current} / ? Pages`}
          percent={pct}
          compact={compact}
        />
      ) : (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: TILE_META_SIZE }}
        >
          Add progress tracking to set a page target and follow your pace.
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          columnGap: compact ? 1 : 1.5,
          rowGap: tileRowGap(compact),
        }}
      >
        <StatGridCell
          label="Project health"
          value={healthText}
          valueColor={healthColor}
          compact={compact}
        />
        <StatGridCell label="Current phase" value={currentPhaseLabel(progress)} compact={compact} />
        <StatGridCell
          label="Characters"
          value={lockedCountText(
            development.lockedCharacters,
            development.totalCharacters,
            'characters'
          )}
          meta={`Development ${charactersLocked ? 'locked' : 'open'}`}
          icon={
            charactersLocked ? (
              <LockIcon sx={{ ...lockIconSx, color: 'success.main' }} aria-hidden />
            ) : (
              <LockOpenIcon sx={{ ...lockIconSx, color: 'text.secondary' }} aria-hidden />
            )
          }
          compact={compact}
        />
        <StatGridCell
          label="Scenes"
          value={lockedCountText(development.lockedScenes, development.totalScenes, 'scenes')}
          meta={`Outline ${scenesLocked ? 'locked' : 'open'}`}
          icon={
            scenesLocked ? (
              <LockIcon sx={{ ...lockIconSx, color: 'success.main' }} aria-hidden />
            ) : (
              <LockOpenIcon sx={{ ...lockIconSx, color: 'text.secondary' }} aria-hidden />
            )
          }
          compact={compact}
        />
        <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <StatGridCell
            label="Pace"
            value={
              trackerEnabled && status.pagesPerDay != null ? `${status.pagesPerDay} pg/day` : '—'
            }
            icon={
              <HourglassEmptyIcon
                sx={{ fontSize: compact ? 15 : 18, color: 'text.secondary', flexShrink: 0 }}
                aria-hidden
              />
            }
            compact={compact}
          />
        </Box>
      </Box>
    </StatTileStack>
  );
}
