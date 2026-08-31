'use client';

import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

export interface DialogCloseButtonProps {
  onClose: () => void;
  /** Blocked while a submit is in flight, matching dialogs that also suppress backdrop close. */
  disabled?: boolean;
  /** Names what is being closed for screen readers, e.g. "Close create project form". */
  label?: string;
}

/**
 * The top-right dismiss control every modal form carries. It is positioned against the dialog
 * paper rather than the title, so a title that wraps to two lines does not move it — give the
 * title `pr: 5` (or more) so long text never runs under it.
 */
export function DialogCloseButton({ onClose, disabled = false, label = 'Close' }: DialogCloseButtonProps) {
  return (
    <IconButton
      aria-label={label}
      onClick={onClose}
      disabled={disabled}
      size="small"
      sx={{
        position: 'absolute',
        right: 8,
        top: 8,
        zIndex: 1,
        color: 'text.secondary',
      }}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  );
}
