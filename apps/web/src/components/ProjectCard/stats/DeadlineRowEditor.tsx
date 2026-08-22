'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { alpha, useTheme } from '@mui/material/styles';
import { TILE_META_SIZE } from './statTileParts';

export interface DeadlineDraftValue {
  label: string;
  dueDate: string;
  tag: string;
}

export interface DeadlineRowEditorProps {
  value: DeadlineDraftValue;
  compact: boolean;
  /** A save is in flight for this row; inputs and actions lock until it settles. */
  isSaving?: boolean;
  onSave: (next: DeadlineDraftValue) => void;
  onCancel: () => void;
  /** Omitted when the last remaining deadline is being edited — a tracker keeps at least one. */
  onDelete?: () => void;
}

/**
 * Inline editor for a single draft deadline, sized to fit inside a compact stat tile: stacked
 * label/date/tag fields with save, cancel, and delete on one action row.
 */
export function DeadlineRowEditor({
  value,
  compact,
  isSaving = false,
  onSave,
  onCancel,
  onDelete,
}: DeadlineRowEditorProps) {
  const theme = useTheme();
  const [draft, setDraft] = React.useState<DeadlineDraftValue>(value);

  // The saved row can change under the editor (another tab, a modal save) — follow it.
  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const canSave = Boolean(draft.dueDate) && !isSaving;

  const setField = (field: keyof DeadlineDraftValue) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));

  const fieldSx = {
    '& .MuiInputBase-input': {
      fontSize: compact ? TILE_META_SIZE : undefined,
      py: compact ? 0.4 : 0.6,
    },
    '& .MuiInputLabel-root': { fontSize: compact ? TILE_META_SIZE : undefined },
  } as const;

  const submit = () => {
    if (!canSave) return;
    onSave({ label: draft.label.trim(), dueDate: draft.dueDate, tag: draft.tag.trim() });
  };

  return (
    <Box
      component="form"
      onSubmit={(event: React.FormEvent) => {
        event.preventDefault();
        submit();
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 0.5 : 0.75,
        borderRadius: 1,
        p: 0.5,
        ml: -0.5,
        bgcolor: alpha(theme.palette.primary.main, 0.08),
      }}
    >
      <TextField
        size="small"
        label="Draft"
        value={draft.label}
        onChange={setField('label')}
        disabled={isSaving}
        autoFocus
        sx={fieldSx}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        size="small"
        type="date"
        label="Due"
        value={draft.dueDate}
        onChange={setField('dueDate')}
        disabled={isSaving}
        required
        sx={fieldSx}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        size="small"
        label="Tag"
        value={draft.tag}
        onChange={setField('tag')}
        disabled={isSaving}
        sx={fieldSx}
        InputLabelProps={{ shrink: true }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Tooltip title="Save deadline">
          <span>
            <IconButton size="small" type="submit" color="primary" disabled={!canSave}>
              <CheckIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Cancel">
          <span>
            <IconButton size="small" onClick={onCancel} disabled={isSaving}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {onDelete ? (
          <Tooltip title="Delete deadline">
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={onDelete}
                disabled={isSaving}
                sx={{ ml: 'auto' }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Box>
    </Box>
  );
}
