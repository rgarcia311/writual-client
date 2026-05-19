'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { useTheme } from '@mui/material/styles';
import type { WritingTrackerStatus, TrackerScheduleStatus } from '../../../utils/progress';

interface ProgressItem {
  label: string;
  status: 'complete' | 'partial' | 'empty';
}

interface ProjectAtAGlanceStatProps {
  progress: ProgressItem[];
  trackerStatus: WritingTrackerStatus | null;
  trackerEnabled: boolean;
  compact?: boolean;
}

const HEALTH_LABEL: Record<TrackerScheduleStatus, string> = {
  ahead: 'Ahead of schedule',
  on_track: 'On Track',
  behind: 'Behind schedule',
  no_data: '—',
};

const PHASE_BY_LABEL: Record<string, string> = {
  Title: 'Project setup',
  Logline: 'Logline development',
  Characters: 'Character development',
  Outline: 'Outline development',
  Treatment: 'Treatment drafting',
  Screenplay: 'Screenplay writing',
};

function currentPhaseLabel(items: ProgressItem[]): string {
  const partial = items.find((p) => p.status === 'partial');
  if (partial && PHASE_BY_LABEL[partial.label]) {
    return PHASE_BY_LABEL[partial.label]!;
  }
  const empty = items.find((p) => p.status === 'empty');
  if (empty && PHASE_BY_LABEL[empty.label]) {
    return PHASE_BY_LABEL[empty.label]!;
  }
  if (partial) return `${partial.label} in progress`;
  if (empty) return `${empty.label} not started`;
  return 'Production-ready';
}

function ProgressMiniDot({
  status,
  compact = false,
}: {
  status: 'complete' | 'partial' | 'empty';
  compact?: boolean;
}) {
  const theme = useTheme();
  const dim = compact ? theme.spacing(1) : theme.spacing(1.375);
  const fill =
    status === 'complete'
      ? theme.palette.success.main
      : status === 'partial'
        ? theme.palette.warning.main
        : 'transparent';
  const border =
    status === 'empty'
      ? `2px solid ${theme.palette.text.disabled}`
      : status === 'complete'
        ? 'none'
        : `2px solid ${theme.palette.warning.dark}`;
  return (
    <Box
      sx={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        backgroundColor: fill,
        border,
        flexShrink: 0,
      }}
    />
  );
}

export function ProjectAtAGlanceStat({
  progress,
  trackerStatus,
  trackerEnabled,
  compact = false,
}: ProjectAtAGlanceStatProps) {
  const theme = useTheme();
  const healthToken =
    trackerEnabled && trackerStatus && trackerStatus.scheduleStatus !== 'no_data'
      ? trackerStatus.scheduleStatus === 'ahead'
        ? theme.palette.success.main
        : trackerStatus.scheduleStatus === 'behind'
          ? theme.palette.error.main
          : theme.palette.warning.dark
      : theme.palette.text.secondary;

  const healthText =
    trackerEnabled && trackerStatus
      ? HEALTH_LABEL[trackerStatus.scheduleStatus]
      : 'Enable writing tracker';

  const phaseLabel = currentPhaseLabel(progress);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 0.35 : 1,
        flex: 1,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: compact ? '0.8rem' : undefined }}>
          Project At-A-Glance
        </Typography>
        <AssignmentOutlinedIcon sx={{ fontSize: compact ? 18 : 22, color: 'text.secondary' }} aria-hidden />
      </Box>

      <Typography variant="caption" sx={{ fontSize: compact ? '0.68rem' : undefined }}>
        <Box component="span" sx={{ fontWeight: 700 }}>
          Project health:{' '}
        </Box>
        <Box component="span" sx={{ fontWeight: 700, color: healthToken }}>
          {healthText}
        </Box>
      </Typography>

      <Typography variant="caption" sx={{ fontSize: compact ? '0.68rem' : undefined }}>
        <Box component="span" sx={{ fontWeight: 700 }}>
          Current phase:{' '}
        </Box>
        <Box component="span" color="text.secondary">
          {phaseLabel}
        </Box>
      </Typography>

      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: compact ? '0.68rem' : undefined }}>
        Development Progress:
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 0.5 : 1.25, alignItems: 'flex-end' }}>
        {progress.map((item) => (
          <Box
            key={item.label}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 0.1 : 0.25 }}
          >
            <ProgressMiniDot status={item.status} compact={compact} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                lineHeight: 1.05,
                fontSize: compact ? '0.58rem' : '0.65rem',
              }}
            >
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
