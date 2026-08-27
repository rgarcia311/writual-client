'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import IosShareIcon from '@mui/icons-material/IosShare';
import { useChatNotificationsStore } from '@/state/chatNotifications';
import { enableChatNotifications } from '@/hooks/usePushNotifications';
import { SUPPRESSED_PROMPT_HINT } from '@/lib/desktopNotifications';

/**
 * The one place that tells people notifications exist.
 *
 * Buried in a settings popover, behind a nav drawer on mobile, the switch was effectively
 * undiscoverable — so this offers it where the messages are. It appears only while the browser
 * has not been asked yet, and never comes back once waved off: a prompt that reappears every
 * visit is how a site gets blocked outright rather than allowed.
 */
export function ChatNotificationPrompt() {
  const support = useChatNotificationsStore((s) => s.support);
  const permission = useChatNotificationsStore((s) => s.permission);
  const busy = useChatNotificationsStore((s) => s.busy);
  const dismissed = useChatNotificationsStore((s) => s.promptDismissed);
  const setPromptDismissed = useChatNotificationsStore((s) => s.setPromptDismissed);
  const suppressed = useChatNotificationsStore((s) => s.promptSuppressed);

  // iOS has nothing to grant until the app is on the Home Screen, so it gets the step it can act
  // on instead of a button that would do nothing.
  const needsInstall = support === 'ios-needs-install';
  const canAsk = support === 'supported' && permission === 'default';
  // The request came back unanswered, so the offer becomes instructions.
  const showHint = canAsk && suppressed;

  if (dismissed || (!canAsk && !needsInstall)) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1.5,
        py: 1.25,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover',
      }}
    >
      {needsInstall
        ? <IosShareIcon fontSize="small" sx={{ color: 'text.secondary', mt: 0.25 }} />
        : showHint
          ? <NotificationsOffIcon fontSize="small" sx={{ color: 'text.secondary', mt: 0.25 }} />
          : <NotificationsActiveIcon fontSize="small" sx={{ color: 'text.secondary', mt: 0.25 }} />}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600}>
          {needsInstall
            ? 'Get notified of new messages'
            : showHint
              ? 'The prompt did not appear'
              : 'Turn on message notifications'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {needsInstall
            ? 'Add Writual to your Home Screen from the Share menu, then turn notifications on in Settings.'
            : showHint
              ? SUPPRESSED_PROMPT_HINT
              : 'Hear about replies when Writual is closed.'}
        </Typography>
        {/*
          * No retry once the browser has swallowed a prompt: asking again is what teaches Chrome to
          * keep swallowing them, and the site-settings route above works every time.
          */}
        {!needsInstall && !showHint && (
          <Button
            size="small"
            variant="contained"
            disableElevation
            disabled={busy}
            onClick={() => { void enableChatNotifications(); }}
            sx={{ mt: 1, borderRadius: 3, textTransform: 'none' }}
          >
            Turn on
          </Button>
        )}
      </Box>
      <IconButton
        size="small"
        aria-label="Dismiss notification prompt"
        onClick={() => setPromptDismissed(true)}
        sx={{ mt: -0.25, mr: -0.5 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
