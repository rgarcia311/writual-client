'use client';

import * as React from 'react';
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const MAX_DRAFT_ROWS = 5;

const DEFAULT_DRAFT_LABELS = [
  'First Draft',
  'Second Draft',
  'Third Draft',
  'Fourth Draft',
  'Fifth Draft',
];

export interface DraftDueDateFormRow {
  id: string;
  label: string;
  dueDate: string;
  tag: string;
}

export interface WritingTrackerFormState {
  enabled: boolean;
  targetPageCount: string;
  currentPageCount: string;
  draftDueDates: DraftDueDateFormRow[];
}

interface WritingTrackerSectionProps {
  value: WritingTrackerFormState;
  onChange: (v: WritingTrackerFormState) => void;
  projectType?: string;
  /** Overrides the Current Page Count helper text (e.g. when prefilled from an existing screenplay). */
  currentPageCountHelperText?: string;
  /** When true, hides the divider, toggle switch, and info note. Use when the caller has already opted the user in. */
  hideToggle?: boolean;
}

function getPageCountHint(projectType: string | undefined): string {
  if (!projectType) return 'Feature ~90–120pp · TV 1hr ~45–65pp · Short ~10–25pp';
  const t = projectType.toLowerCase();
  if (t === 'feature' || t === 'film') return 'Feature films are typically 90–120 pages';
  if (t === 'television') return 'TV hour-longs are typically 45–65 pages per episode';
  if (t === 'short') return 'Short films are typically 10–25 pages';
  return 'Feature ~90–120pp · TV 1hr ~45–65pp · Short ~10–25pp';
}

export function WritingTrackerSection({
  value,
  onChange,
  projectType,
  currentPageCountHelperText,
  hideToggle = false,
}: WritingTrackerSectionProps) {
  const handleToggle = (_: React.SyntheticEvent, checked: boolean) => {
    onChange({ ...value, enabled: checked });
  };

  const handleFieldChange = (field: keyof WritingTrackerFormState, v: string) => {
    onChange({ ...value, [field]: v });
  };

  const handleRowChange = (id: string, field: keyof DraftDueDateFormRow, v: string) => {
    onChange({
      ...value,
      draftDueDates: value.draftDueDates.map((row) =>
        row.id === id ? { ...row, [field]: v } : row
      ),
    });
  };

  const handleAddRow = () => {
    if (value.draftDueDates.length >= MAX_DRAFT_ROWS) return;
    const nextIdx = value.draftDueDates.length;
    onChange({
      ...value,
      draftDueDates: [
        ...value.draftDueDates,
        {
          id: String(Date.now()),
          label: DEFAULT_DRAFT_LABELS[nextIdx] ?? `Draft ${nextIdx + 1}`,
          dueDate: '',
          tag: '',
        },
      ],
    });
  };

  const handleRemoveRow = (id: string) => {
    if (value.draftDueDates.length <= 1) return;
    onChange({
      ...value,
      draftDueDates: value.draftDueDates.filter((row) => row.id !== id),
    });
  };

  const isDisabled = !value.enabled;

  return (
    <Box>
      {!hideToggle && (
        <>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={value.enabled}
                  onChange={handleToggle}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Enable Writing Progress Tracking
                </Typography>
              }
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.disabled">
                You can also set this up later from the project page.
              </Typography>
            </Box>
          </Box>
        </>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          mt: 1.5,
          opacity: isDisabled ? 0.45 : 1,
          pointerEvents: isDisabled ? 'none' : 'auto',
          transition: 'opacity 0.2s',
        }}
      >
        {/* Page count fields */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <TextField
              label="Target Page Count"
              value={value.targetPageCount}
              onChange={(e) => handleFieldChange('targetPageCount', e.target.value)}
              type="number"
              inputProps={{ min: 1, max: 999 }}
              size="small"
              fullWidth
              disabled={isDisabled}
              helperText={getPageCountHint(projectType)}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <TextField
              label="Current Page Count"
              value={value.currentPageCount}
              onChange={(e) => handleFieldChange('currentPageCount', e.target.value)}
              type="number"
              inputProps={{ min: 0, max: 999 }}
              size="small"
              fullWidth
              disabled={isDisabled}
              helperText={currentPageCountHelperText ?? 'Auto-filled when you import a PDF'}
            />
          </Box>
        </Box>

        {/* Draft due dates */}
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
            Draft Due Dates
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (at least 1 required · max 5)
            </Typography>
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {value.draftDueDates.map((row, idx) => (
              <Box
                key={row.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ minWidth: 48, pt: 1.25, fontWeight: 600 }}
                  >
                    Draft {idx + 1}
                  </Typography>
                  <TextField
                    label="Label"
                    value={row.label}
                    onChange={(e) => handleRowChange(row.id, 'label', e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    disabled={isDisabled}
                    placeholder="e.g. First Draft"
                  />
                  <TextField
                    label="Due Date"
                    value={row.dueDate}
                    onChange={(e) => handleRowChange(row.id, 'dueDate', e.target.value)}
                    type="date"
                    size="small"
                    sx={{ flex: 1 }}
                    disabled={isDisabled}
                    InputLabelProps={{ shrink: true }}
                    error={value.enabled && !row.dueDate}
                    helperText={value.enabled && !row.dueDate ? 'Required' : undefined}
                  />
                  <Tooltip title={value.draftDueDates.length <= 1 ? 'At least one due date is required' : 'Remove'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={isDisabled || value.draftDueDates.length <= 1}
                        aria-label={`Remove draft ${idx + 1}`}
                        sx={{ mt: 0.5 }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, pl: '56px' }}>
                  <TextField
                    label="Tag (optional)"
                    value={row.tag}
                    onChange={(e) => handleRowChange(row.id, 'tag', e.target.value)}
                    size="small"
                    fullWidth
                    disabled={isDisabled}
                    placeholder="e.g. Screenplay Contest, Workshop Feedback"
                  />
                </Box>
              </Box>
            ))}
          </Box>

          {value.draftDueDates.length < MAX_DRAFT_ROWS && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddRow}
              disabled={isDisabled}
              sx={{ mt: 1 }}
            >
              Add Draft Due Date
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
