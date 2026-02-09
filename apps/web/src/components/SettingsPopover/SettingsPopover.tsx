'use client';

import * as React from 'react';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Popover,
  Switch,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { OutlineFrameworkForm, type OutlineFrameworkFormValues } from '@/components/OutlineFrameworkForm';
import { CREATE_OUTLINE_FRAMEWORK } from 'mutations/OutlineMutations';
import { useThemeToggleOptional } from '@/themes/ThemeToggleContext';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';

const ENDPOINT = GRAPHQL_ENDPOINT;
export interface SettingsPopoverProps {
  /** When true, render only the icon (e.g. on projects page without SideNav). */
  standalone?: boolean;
}

export function SettingsPopover({ standalone = false }: SettingsPopoverProps) {
  const themeContext = useThemeToggleOptional();
  const isLightMode = themeContext?.isLightMode ?? true;
  const onThemeToggle = themeContext ? () => themeContext.setTheme((p) => !p) : () => {};
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [outlineFormOpen, setOutlineFormOpen] = React.useState(false);
  const user = useUserProfileStore((s) => s.user)

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const createOutlineMutation = useMutation({
    mutationFn: async (variables: { input: any }) =>
      request(ENDPOINT, CREATE_OUTLINE_FRAMEWORK, variables),
    onSuccess: () => {
      setOutlineFormOpen(false);
      handleClose();
      queryClient.invalidateQueries({ queryKey: ['outline-frameworks'] });
    },
  });

  const handleCreateOutlineClick = () => {
    handleClose();
    setOutlineFormOpen(true);
  };

  const handleOutlineFormSubmit = (values: OutlineFrameworkFormValues) => {
    const input = {
      user: user?.uid,
      name: values.formatName.trim(),
      imageUrl: values.imageUrl.trim() || undefined,
      format: {
        name: values.formatName.trim(),
        steps: values.steps.map((s) => ({
          name: s.name,
          number: s.number,
          act: s.act,
          instructions: s.instructions,
        })),
      },
    };
    createOutlineMutation.mutate({ input });
  };

  const handleSignOut = () => {
    handleClose();
    // Placeholder: wire to auth when implemented
  };

  return (
    <>
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
          <MenuItem onClick={handleCreateOutlineClick}>
            <ListItemIcon>
              <AccountTreeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Create outline framework" />
          </MenuItem>
          <MenuItem onClick={handleSignOut}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Sign out" />
          </MenuItem>
        </Box>
      </Popover>
      <OutlineFrameworkForm
        open={outlineFormOpen}
        onClose={() => setOutlineFormOpen(false)}
        onSubmit={handleOutlineFormSubmit}
        submitLabel="Create framework"
        submitting={createOutlineMutation.isPending}
      />
    </>
  );
}
