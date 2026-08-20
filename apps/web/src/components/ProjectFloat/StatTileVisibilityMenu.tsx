'use client';

import * as React from 'react';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import TuneIcon from '@mui/icons-material/Tune';
import {
  ALL_PROJECT_STAT_TILE_KEYS,
  PROJECT_STAT_TILE_LABELS,
  type ProjectStatTileKey,
} from './buildProjectStatTiles';

export interface StatTileVisibilityMenuProps {
  /** Tiles currently shown on this page. */
  selectedKeys: ProjectStatTileKey[];
  onToggleKey: (key: ProjectStatTileKey) => void;
  onResetToDefault: () => void;
  /** Whether this page is still on its built-in tile set. */
  isDefault: boolean;
}

/** Breadcrumb-bar picker for which stat cards this page shows; the choice is saved per user. */
export function StatTileVisibilityMenu({
  selectedKeys,
  onToggleKey,
  onResetToDefault,
  isDefault,
}: StatTileVisibilityMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Choose stat cards">
        <IconButton
          size="small"
          aria-label="Choose stat cards"
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <TuneIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 232 } } }}
      >
        <Typography
          variant="caption"
          sx={{ display: 'block', px: 2, pt: 0.5, pb: 1, color: 'text.secondary' }}
        >
          Stat cards on this page
        </Typography>
        {ALL_PROJECT_STAT_TILE_KEYS.map((key) => {
          const checked = selectedKeys.includes(key);
          return (
            <MenuItem key={key} onClick={() => onToggleKey(key)} dense>
              <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                <Checkbox
                  edge="start"
                  size="small"
                  checked={checked}
                  tabIndex={-1}
                  disableRipple
                  sx={{ p: 0 }}
                  inputProps={{ 'aria-label': PROJECT_STAT_TILE_LABELS[key] }}
                />
              </ListItemIcon>
              <ListItemText primary={PROJECT_STAT_TILE_LABELS[key]} />
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem
          dense
          disabled={isDefault}
          onClick={() => {
            onResetToDefault();
            setAnchorEl(null);
          }}
        >
          <ListItemText primary="Reset to default" />
        </MenuItem>
      </Menu>
    </>
  );
}
