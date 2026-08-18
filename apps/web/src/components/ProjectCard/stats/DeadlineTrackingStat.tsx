'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { alpha, useTheme } from '@mui/material/styles';
import type { DraftDeadline } from '../../../utils/progress';
import {
  formatWritingTrackerDueDateIso,
  formatWritingTrackerRelativeDeadlineShort,
} from '../../../utils/progress';
import { TileHeading, TILE_META_SIZE, TILE_VALUE_SIZE, TILE_LABEL_SIZE } from './statTileParts';

interface DeadlineTrackingStatProps {
  /** Draft deadlines in date order, next one flagged; empty when tracking is off. */
  deadlines: DraftDeadline[];
  trackerEnabled: boolean;
  /** When set, the header calendar becomes a button that opens the deadline editor. */
  onManageDeadlines?: () => void;
  compact?: boolean;
}

/** One draft row: state glyph, label (+tag), then date and relative timing. */
function DeadlineRow({ deadline, compact }: { deadline: DraftDeadline; compact: boolean }) {
  const theme = useTheme();
  const { label, tag, dueDate, daysUntil, isNext, isPast } = deadline;

  const overdue = isNext && daysUntil < 0;
  const glyphSx = { fontSize: compact ? 15 : 18, flexShrink: 0 };
  const glyph = isPast ? (
    <CheckCircleOutlineIcon sx={{ ...glyphSx, color: 'text.disabled' }} aria-hidden />
  ) : overdue ? (
    <ErrorOutlineIcon sx={{ ...glyphSx, color: 'error.main' }} aria-hidden />
  ) : (
    <RadioButtonUncheckedIcon
      sx={{ ...glyphSx, color: isNext ? 'warning.dark' : 'text.secondary' }}
      aria-hidden
    />
  );

  const labelColor = isPast ? 'text.disabled' : 'text.primary';
  const timingColor = overdue
    ? theme.palette.error.main
    : isNext
      ? theme.palette.warning.dark
      : theme.palette.text.secondary;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: compact ? 0.6 : 0.75,
        minWidth: 0,
        borderRadius: 1,
        px: isNext ? 0.5 : 0,
        py: isNext ? 0.35 : 0,
        ml: isNext ? -0.5 : 0,
        bgcolor: isNext ? alpha(theme.palette.warning.main, 0.12) : 'transparent',
      }}
    >
      {glyph}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: isNext ? 700 : 600,
            fontSize: compact ? TILE_VALUE_SIZE : undefined,
            lineHeight: 1.3,
            color: labelColor,
          }}
        >
          {label}
          {tag ? (
            <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
              {` · ${tag}`}
            </Box>
          ) : null}
        </Typography>
        <Typography
          variant="caption"
          sx={{ fontSize: compact ? TILE_META_SIZE : undefined, lineHeight: 1.25 }}
        >
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {formatWritingTrackerDueDateIso(dueDate)}
          </Box>
          <Box component="span" sx={{ color: timingColor, fontWeight: isNext ? 700 : 400 }}>
            {` · ${formatWritingTrackerRelativeDeadlineShort(daysUntil)}`}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}

export function DeadlineTrackingStat({
  deadlines,
  trackerEnabled,
  onManageDeadlines,
  compact = false,
}: DeadlineTrackingStatProps) {
  const calendarIconSx = { fontSize: compact ? 20 : 22, color: 'text.secondary' };
  const manageLabel = trackerEnabled ? 'Add or edit draft deadlines' : 'Add progress tracking';

  const heading = (
    <TileHeading
      title="Deadline Tracking"
      compact={compact}
      icon={
        onManageDeadlines ? (
          <Tooltip title={manageLabel} enterDelay={300}>
            <IconButton
              size="small"
              aria-label={manageLabel}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onManageDeadlines();
              }}
              sx={{ mt: -0.5, mr: -0.5 }}
            >
              <CalendarTodayIcon sx={calendarIconSx} />
            </IconButton>
          </Tooltip>
        ) : (
          <CalendarTodayIcon sx={calendarIconSx} aria-hidden />
        )
      }
    />
  );

  const emptyNote = !trackerEnabled
    ? 'Add progress tracking to set draft due dates.'
    : 'No draft due dates set yet.';

  if (deadlines.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 0.85 : 1,
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          px: compact ? 0.5 : 0,
          py: compact ? 0.35 : 0,
        }}
      >
        {heading}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: compact ? TILE_META_SIZE : undefined }}
        >
          {emptyNote}
        </Typography>
      </Box>
    );
  }

  const next = deadlines.find((d) => d.isNext) ?? null;
  const remaining = deadlines.filter((d) => !d.isPast).length;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 0.75 : 1,
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        px: compact ? 0.5 : 0,
        py: compact ? 0.35 : 0,
      }}
    >
      {heading}

      <Typography
        variant="caption"
        sx={{ fontSize: compact ? TILE_LABEL_SIZE : undefined, lineHeight: 1.3 }}
      >
        <Box component="span" sx={{ fontWeight: 700 }}>
          {next ? 'Next up: ' : 'All drafts due: '}
        </Box>
        <Box component="span" color="text.secondary">
          {next
            ? `${remaining} of ${deadlines.length} draft${deadlines.length === 1 ? '' : 's'} ahead`
            : 'every date has passed'}
        </Box>
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.5 : 0.75 }}>
        {deadlines.map((deadline) => (
          <DeadlineRow
            key={`${deadline.draftNumber}-${deadline.dueDate}`}
            deadline={deadline}
            compact={compact}
          />
        ))}
      </Box>
    </Box>
  );
}
