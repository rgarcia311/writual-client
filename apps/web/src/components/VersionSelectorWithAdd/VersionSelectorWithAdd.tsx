'use client';

import * as React from 'react';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';

export interface VersionSelectorWithAddProps {
  /** Current selected version (e.g. "1") */
  value: string;
  /** List of version numbers to show in dropdown */
  versionOptions: number[];
  /** If set, the option with this version number shows " (New)" suffix */
  newVersionLabel?: number;
  onVersionChange: (version: number) => void;
  onAddVersion?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  /** aria-label for the add button */
  addVersionAriaLabel?: string;
}

export function VersionSelectorWithAdd({
  value,
  versionOptions,
  newVersionLabel,
  onVersionChange,
  onAddVersion,
  disabled = false,
  addVersionAriaLabel = 'Add new version',
}: VersionSelectorWithAddProps) {
  const theme = useTheme();
  const addDisabled = disabled || !onAddVersion;

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const v = event.target.value;
    const num = parseInt(v, 10);
    if (Number.isFinite(num)) onVersionChange(num);
  };

  return (
    <FormControl size="small" sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      <IconButton
        size="small"
        onClick={onAddVersion ?? (() => {})}
        disabled={addDisabled}
        aria-label={addVersionAriaLabel}
        sx={{
          backgroundColor: theme.palette.primary.light,
          color: theme.palette.primary.contrastText ?? theme.palette.common.white,
          '&:hover': { backgroundColor: theme.palette.primary.main },
          flexShrink: 0,
        }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
      <Select
        value={value}
        onChange={handleSelectChange}
        disabled={disabled}
        displayEmpty
        sx={{
          width: 65,
          backgroundColor: theme.palette.grey[100],
          borderRadius: 1,
          fontSize: '0.875rem',
          '& .MuiSelect-select': { py: 0.75 },
        }}
        renderValue={(v) => `v${v}`}
      >
        {versionOptions.map((ver) => (
          <MenuItem key={ver} value={String(ver)}>
            v{ver}{newVersionLabel != null && ver === newVersionLabel ? ' (New)' : ''}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
