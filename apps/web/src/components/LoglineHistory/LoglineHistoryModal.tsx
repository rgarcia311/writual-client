'use client';

import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { LoglineHistoryPanel } from './LoglineHistoryPanel';
import type { LoglineHistoryViewProps } from './types';

export interface LoglineHistoryModalProps extends Omit<LoglineHistoryViewProps, 'dense'> {
  open: boolean;
  onClose: () => void;
}

/** Roomy view of the same panel, for iterating without the stat tile's narrow column. */
export function LoglineHistoryModal({ open, onClose, ...panelProps }: LoglineHistoryModalProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Logline History
        <IconButton
          aria-label="Close logline history"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, bgcolor: 'background.default' }}
      >
        <LoglineHistoryPanel {...panelProps} />
      </DialogContent>
    </Dialog>
  );
}
