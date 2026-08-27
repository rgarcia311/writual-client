'use client';

import * as React from 'react';
import { Box, Container, IconButton, ListItemIcon, ListItemText, MenuItem, Popover, Switch } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { logout } from '@/app/actions/auth';
import { useUserProfileStore } from '@/state/user';
import { useThemeToggleOptional } from '@/themes/ThemeToggleContext';
import { useWalkthroughStore } from '@/state/walkthrough';
import { useChatNotificationsStore } from '@/state/chatNotifications';
import { enableChatNotifications, disableChatNotifications } from '@/hooks/usePushNotifications';

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

  const router = useRouter();
  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);
  const startWalkthrough = useWalkthroughStore((s) => s.start);

  // All of this is populated by `usePushNotificationsRuntime`, mounted once at the app root.
  const chatNotificationsEnabled = useChatNotificationsStore((s) => s.enabled);
  const support = useChatNotificationsStore((s) => s.support);
  const permission = useChatNotificationsStore((s) => s.permission);
  const subscribed = useChatNotificationsStore((s) => s.pushSubscribed);
  const busy = useChatNotificationsStore((s) => s.busy);

  const chatNotificationsOn = chatNotificationsEnabled && permission === 'granted';
  // The two cases the user cannot resolve from this menu: a permission the browser will not
  // re-prompt for, and a platform with nowhere to deliver to. iOS is neither — it is a one-time
  // install away, so it stays actionable and says what to do.
  const notificationsBlocked =
    permission === 'denied' || permission === 'unsupported' || support === 'ios-needs-install';

  const notificationsSecondary =
    support === 'ios-needs-install'
      ? 'Add Writual to your Home Screen first'
      : permission === 'unsupported'
        ? 'Not supported in this browser'
        : permission === 'denied'
          ? 'Blocked in browser settings'
          : !chatNotificationsOn
            ? 'Off'
            // A device without a subscription only rings while a tab is open, which is worth saying
            // rather than letting the user discover it when a message misses them.
            : subscribed
              ? 'On for this device'
              : 'On while Writual is open';

  /**
   * Browsers only prompt from a user gesture, which is why the request lives on this row rather
   * than firing when the chat page loads. Turning it off unsubscribes this device alone — other
   * devices keep their own registrations.
   */
  const handleToggleChatNotifications = (turnOn: boolean) => {
    void (turnOn ? enableChatNotifications() : disableChatNotifications());
  };

  // The tour opens on whatever page the user is on, so it starts from the projects list — the
  // same place a login lands — rather than mid-project where its first steps have nothing to
  // point at.
  const handleReplayWalkthrough = () => {
    handleClose();
    router.push('/projects');
    startWalkthrough({ manual: true });
  };

  const handleSignOut = async () => {
    handleClose();
    await signOut(getFirebaseAuth());
    setUserProfile(null);
    await logout();
    router.replace('/');
  };

  return (
    <Container disableGutters sx={{ width: "max-content"}}>
      <IconButton
        onClick={handleClick}
        color="inherit"
        aria-label="Settings"
        size="small"
        data-tour="settings-button"
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
          sx: { minWidth: 220, maxWidth: 320, width: 'max-content', mt: 1.5 },
          'enable-xr': '',
          // No `position` override here: the Popover paper must stay absolutely
          // positioned, otherwise it lays out as a block child of the full-viewport
          // modal root and renders full width.
          style: {
            '--xr-back': '24px',
            '--xr-background-material': 'translucent',
          } as React.CSSProperties,
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
          <MenuItem
            onClick={notificationsBlocked || busy ? undefined : () => handleToggleChatNotifications(!chatNotificationsOn)}
            disabled={notificationsBlocked}
          >
            <ListItemIcon>
              {chatNotificationsOn
                ? <NotificationsActiveIcon fontSize="small" />
                : <NotificationsOffIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary="Chat notifications"
              secondary={notificationsSecondary}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
            {/* The row itself is the control — the switch only reports its state. */}
            <Switch
              checked={chatNotificationsOn}
              disabled={notificationsBlocked || busy}
              size="small"
              color="primary"
              tabIndex={-1}
              sx={{ pointerEvents: 'none' }}
              inputProps={{ 'aria-label': 'Chat notifications' }}
            />
          </MenuItem>
          <MenuItem onClick={handleReplayWalkthrough}>
            <ListItemIcon>
              <HelpOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Replay intro walkthrough" />
          </MenuItem>
          <MenuItem component={Link} href="/outlines" onClick={handleClose} sx={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemIcon>
              <ManageSearchIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Manage Outline Frameworks" />
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
