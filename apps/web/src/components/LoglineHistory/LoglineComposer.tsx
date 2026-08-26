'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export interface LoglineComposerProps {
  /** Seed text — used when editing an existing logline; the field stays uncontrolled after mount. */
  initialValue?: string;
  placeholder: string;
  submitLabel: string;
  maxLength: number;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  isPending?: boolean;
  /** Tighter type and spacing for the small stat tile. */
  dense?: boolean;
  autoFocus?: boolean;
  /**
   * Lays the field and its submit button out on one row, button to the right, instead of stacking
   * the actions underneath. Used by the panel's bottom-docked composer.
   */
  inlineAction?: boolean;
}

/** Below this many characters left, the counter appears — it stays out of the way until relevant. */
const COUNTER_VISIBLE_REMAINING = 120;

/**
 * The logline / feedback input. The field is `multiline` with **no** `maxRows`, so the textarea
 * grows downward as text is typed and wraps at the horizontal edge: the whole entry stays visible
 * instead of scrolling inside a fixed-height box.
 *
 * Submits on the button or ⌘/Ctrl+Enter; Escape cancels when the caller offers a cancel action.
 * With `inlineAction`, the submit button sits to the right of the field rather than below it.
 */
export function LoglineComposer({
  initialValue = '',
  placeholder,
  submitLabel,
  maxLength,
  onSubmit,
  onCancel,
  isPending = false,
  dense = false,
  autoFocus = false,
  inlineAction = false,
}: LoglineComposerProps) {
  const [value, setValue] = React.useState(initialValue);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !isPending;
  const remaining = maxLength - value.length;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
    // Editing keeps the seeded text; a fresh composer clears so the next iteration starts empty.
    if (!initialValue) setValue('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      onCancel();
    }
  };

  const field = (
    <TextField
      multiline
      minRows={inlineAction ? 1 : dense ? 2 : 3}
      fullWidth
      size="small"
      autoFocus={autoFocus}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
      onKeyDown={handleKeyDown}
      inputProps={{ maxLength, 'aria-label': placeholder }}
      sx={{
        '& .MuiInputBase-root': { alignItems: 'flex-start', p: dense ? 0.75 : 1 },
        // No maxRows above, so the textarea is sized by its content; hiding overflow keeps a
        // scrollbar from ever appearing inside it while it grows.
        '& .MuiInputBase-inputMultiline': {
          fontSize: dense ? '0.75rem' : '0.875rem',
          lineHeight: 1.45,
          overflow: 'hidden',
        },
      }}
    />
  );

  const counter =
    remaining <= COUNTER_VISIBLE_REMAINING ? (
      <Typography
        variant="caption"
        color={remaining <= 0 ? 'error.main' : 'text.secondary'}
        sx={{ mr: 'auto', fontSize: '0.65rem' }}
      >
        {remaining} left
      </Typography>
    ) : null;

  const cancelButton = onCancel ? (
    <Button size="small" onClick={onCancel} disabled={isPending} sx={{ minWidth: 0 }}>
      Cancel
    </Button>
  ) : null;

  const submitButton = (
    <Button
      size="small"
      variant="contained"
      onClick={submit}
      disabled={!canSubmit}
      sx={{ minWidth: 0, whiteSpace: 'nowrap' }}
    >
      {submitLabel}
    </Button>
  );

  if (inlineAction) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, minWidth: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>{field}</Box>
          {/* The field grows downward as it wraps, so the buttons stay pinned to its first row. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, mt: dense ? 0.25 : 0.5 }}>
            {cancelButton}
            {submitButton}
          </Box>
        </Box>
        {counter ? <Box sx={{ display: 'flex' }}>{counter}</Box> : null}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.5 : 1, minWidth: 0 }}>
      {field}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
        {counter}
        {cancelButton}
        {submitButton}
      </Box>
    </Box>
  );
}
