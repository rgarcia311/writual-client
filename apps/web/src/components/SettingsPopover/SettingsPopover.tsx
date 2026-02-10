'use client';

import * as React from 'react';
import { Box, Container, IconButton, ListItemIcon, ListItemText, MenuItem, Popover, Switch } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import Link from 'next/link';
import { useThemeToggleOptional } from '@/themes/ThemeToggleContext';

export interface SettingsPopoverProps {
  /** When true, render only the icon (e.g. on projects page without SideNav). */
  standalone?: boolean;
}

export function SettingsPopover({ standalone = false }: SettingsPopoverProps) {
  const themeContext = useThemeToggleOptional();
  const isLightMode = themeContext?.isLightMode ?? true;
  const onThemeToggle = themeContext ? () => themeContext.setTheme((p) => !p) : () => {};
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = () => {
    handleClose();
    // Placeholder: wire to auth when implemented
  };

  return (
    <Container disableGutters sx={{ width: "max-content"}}>
      <IconButton
        onClick={handleClick}
        color="inherit"
        aria-label="Settings"
        size="small"
        sx={standalone ? { ml: 'auto' } : undefined}
      >
        <SettingsIcon />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: { minWidth: 220, mt: 1.5 },
        }}
      >
        <Box sx={{ py: 1 }}>
          <MenuItem disabled sx={{ cursor: 'default' }}>
            <ListItemIcon>
              {isLightMode ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary="Theme"
              secondary={isLightMode ? 'Light' : 'Dark'}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
            <Switch
              checked={!isLightMode}
              onChange={onThemeToggle}
              size="small"
              color="primary"
            />
          </MenuItem>
          <MenuItem component={Link} href="/outlines" onClick={handleClose} sx={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemIcon>
              <ManageSearchIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Manage outlines" />
          </MenuItem>
          <MenuItem onClick={handleSignOut}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Sign out" />
          </MenuItem>
        </Box>
      </Popover>
    </Container>
  );
}
