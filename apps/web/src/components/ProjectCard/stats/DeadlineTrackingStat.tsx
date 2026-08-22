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
import EditIcon from '@mui/icons-material/Edit';
import { alpha, useTheme } from '@mui/material/styles';
import type { DraftDeadline } from '../../../utils/progress';
import {
  formatWritingTrackerDueDateIso,
  formatWritingTrackerRelativeDeadlineShort,
} from '../../../utils/progress';
import { TileHeading, TILE_META_SIZE, TILE_VALUE_SIZE, TILE_LABEL_SIZE } from './statTileParts';
import { DeadlineRowEditor, type DeadlineDraftValue } from './DeadlineRowEditor';

interface DeadlineTrackingStatProps {
  /** Draft deadlines in date order, next one flagged; empty when tracking is off. */
  deadlines: DraftDeadline[];
  trackerEnabled: boolean;
  /** When set, the header calendar becomes a button that opens the deadline editor. */
  onManageDeadlines?: () => void;
  /** When set, each deadline row becomes editable in place. Rejecting keeps the editor open. */
  onSaveDeadline?: (draftNumber: number, next: DeadlineDraftValue) => Promise<unknown> | void;
  /** When set, an open row editor offers Delete (suppressed for the last remaining deadline). */
  onDeleteDeadline?: (draftNumber: number) => Promise<unknown> | void;
  compact?: boolean;
}

/** One draft row: state glyph, label (+tag), then date and relative timing. */
function DeadlineRow({
  deadline,
  compact,
  onEdit,
}: {
  deadline: DraftDeadline;
  compact: boolean;
  onEdit?: () => void;
}) {
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

  const editable = Boolean(onEdit);

  return (
    <Box
      component={editable ? 'button' : 'div'}
      type={editable ? 'button' : undefined}
      onClick={onEdit}
      aria-label={editable ? `Edit deadline ${label}` : undefined}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: compact ? 0.6 : 0.75,
        minWidth: 0,
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        border: 'none',
        borderRadius: 1,
        px: isNext || editable ? 0.5 : 0,
        py: isNext || editable ? 0.35 : 0,
        ml: isNext || editable ? -0.5 : 0,
        cursor: editable ? 'pointer' : 'default',
        bgcolor: isNext ? alpha(theme.palette.warning.main, 0.12) : 'transparent',
        '&:hover': editable
          ? {
              bgcolor: isNext
                ? alpha(theme.palette.warning.main, 0.2)
                : alpha(theme.palette.text.primary, 0.06),
            }
          : undefined,
        '&:hover .deadline-row__edit-glyph': { opacity: 1 },
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
      {editable ? (
        <EditIcon
          className="deadline-row__edit-glyph"
          aria-hidden
          sx={{
            fontSize: compact ? 13 : 15,
            flexShrink: 0,
            mt: 0.15,
            color: 'text.secondary',
            opacity: 0,
            transition: 'opacity 120ms ease-in-out',
          }}
        />
      ) : null}
    </Box>
  );
}

export function DeadlineTrackingStat({
  deadlines,
  trackerEnabled,
  onManageDeadlines,
  onSaveDeadline,
  onDeleteDeadline,
  compact = false,
}: DeadlineTrackingStatProps) {
  const [editingDraft, setEditingDraft] = React.useState<number | null>(null);
  const [savingDraft, setSavingDraft] = React.useState<number | null>(null);
  const calendarIconSx = { fontSize: compact ? 20 : 22, color: 'text.secondary' };
  const manageLabel = trackerEnabled ? 'Add or edit draft deadlines' : 'Add progress tracking';
  const canEditRows = Boolean(onSaveDeadline);

  const runRowMutation = async (draftNumber: number, mutate: () => Promise<unknown> | void) => {
    setSavingDraft(draftNumber);
    try {
      await mutate();
      setEditingDraft(null);
    } catch {
      // The caller logs the failure; keep the editor open so the edit is not lost.
    } finally {
      setSavingDraft(null);
    }
  };

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

      {/* Scrolls internally past the CSS max height so a long list never stretches the hero row. */}
      <Box
        className="deadline-tracking-stat__list"
        sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.5 : 0.75 }}
      >
        {deadlines.map((deadline) =>
          editingDraft === deadline.draftNumber ? (
            <DeadlineRowEditor
              key={`${deadline.draftNumber}-${deadline.dueDate}`}
              compact={compact}
              isSaving={savingDraft === deadline.draftNumber}
              value={{
                label: deadline.label ?? '',
                dueDate: deadline.dueDate,
                tag: deadline.tag ?? '',
              }}
              onCancel={() => setEditingDraft(null)}
              onSave={(nextValue) =>
                runRowMutation(deadline.draftNumber, () =>
                  onSaveDeadline?.(deadline.draftNumber, nextValue),
                )
              }
              onDelete={
                onDeleteDeadline && deadlines.length > 1
                  ? () =>
                      runRowMutation(deadline.draftNumber, () =>
                        onDeleteDeadline(deadline.draftNumber),
                      )
                  : undefined
              }
            />
          ) : (
            <DeadlineRow
              key={`${deadline.draftNumber}-${deadline.dueDate}`}
              deadline={deadline}
              compact={compact}
              onEdit={
                canEditRows ? () => setEditingDraft(deadline.draftNumber) : undefined
              }
            />
          ),
        )}
      </Box>
    </Box>
  );
}
