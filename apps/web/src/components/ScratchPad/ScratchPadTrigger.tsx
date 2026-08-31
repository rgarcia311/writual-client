'use client';

import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { useScratchPadStore } from '@/state/scratchPad';

interface ScratchPadTriggerProps {
  projectId: string;
}

/** Opens/closes the floating scratch pad. Lives in the breadcrumb bar, so it is on every project page. */
export function ScratchPadTrigger({ projectId }: ScratchPadTriggerProps) {
  const openProjectId = useScratchPadStore((s) => s.openProjectId);
  const togglePad = useScratchPadStore((s) => s.togglePad);
  const isOpen = openProjectId === projectId;

  return (
    <Tooltip title={isOpen ? 'Close scratch pad' : 'Open scratch pad'}>
      <IconButton
        size="small"
        aria-label="Scratch pad"
        aria-pressed={isOpen}
        color={isOpen ? 'primary' : 'default'}
        onClick={() => togglePad(projectId)}
        sx={{ flexShrink: 0 }}
      >
        <EditNoteIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
