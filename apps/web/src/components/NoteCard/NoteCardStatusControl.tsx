'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  NOTE_STATUS_ACTIONS,
  NOTE_STATUS_COLORS,
  NOTE_STATUS_ORDER,
  type NoteStatus,
} from './status';

const STATUS_ICONS: Record<NoteStatus, React.ElementType> = {
  todo: RadioButtonUncheckedIcon,
  maybe: HelpOutlineIcon,
  incorporated: CheckCircleIcon,
};

interface NoteCardStatusControlProps {
  status: NoteStatus;
  onChange: (status: NoteStatus) => void;
}

/**
 * Segmented three-way status picker: one tap sends a note to "To incorporate", "Maybe" or
 * "Incorporated". Only the active bucket is coloured, so the card reads at a glance.
 */
export function NoteCardStatusControl({ status, onChange }: NoteCardStatusControlProps) {
  return (
    <Box sx={{ display: 'flex' }} role="group" aria-label="Note status">
      {NOTE_STATUS_ORDER.map((option) => {
        const Icon = STATUS_ICONS[option];
        const active = option === status;
        return (
          <Tooltip key={option} title={NOTE_STATUS_ACTIONS[option]}>
            <IconButton
              size="small"
              color={active ? NOTE_STATUS_COLORS[option] : 'default'}
              onClick={() => onChange(option)}
              aria-label={NOTE_STATUS_ACTIONS[option]}
              aria-pressed={active}
              sx={{ opacity: active ? 1 : 0.5 }}
            >
              <Icon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      })}
    </Box>
  );
}
