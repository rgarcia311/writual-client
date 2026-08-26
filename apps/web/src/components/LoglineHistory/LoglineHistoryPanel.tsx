'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LoglineComposer } from './LoglineComposer';
import { LoglineVersionRow } from './LoglineVersionRow';
import { MAX_LOGLINE_LENGTH, type LoglineHistoryViewProps } from './types';

/**
 * Body of the Logline History card: the current logline first, then the alternates with their
 * feedback threads, and the composer for the next iteration docked at the bottom. Shared by the
 * stat tile (`dense`) and the dialog.
 *
 * Before anything has been written to the history, the project's existing logline is shown
 * read-only — editors get it seeded into the history automatically by `LoglineHistoryTile`.
 */
export function LoglineHistoryPanel({
  versions,
  currentLogline,
  access,
  viewerUid,
  isPending = false,
  errorMessage = null,
  dense = false,
  onAddVersion,
  onUpdateVersion,
  onDeleteVersion,
  onMakeCurrent,
  onAddFeedback,
  onDeleteFeedback,
}: LoglineHistoryViewProps) {
  const hasVersions = versions.length > 0;

  // The current logline leads; the alternates keep the order they arrive in behind it.
  const orderedVersions = React.useMemo(() => {
    const current = versions.filter((version) => version.current);
    const alternates = versions.filter((version) => !version.current);
    return [...current, ...alternates];
  }, [versions]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? 0.6 : 1.25,
        flex: 1,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {errorMessage ? (
        <Typography variant="caption" color="error.main" sx={{ fontSize: '0.68rem' }}>
          {errorMessage}
        </Typography>
      ) : null}

      {!hasVersions && currentLogline ? (
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, fontSize: dense ? '0.85rem' : '1rem', lineHeight: 1.3 }}
          >
            Current logline
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: dense ? '0.82rem' : '0.95rem',
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {currentLogline}
          </Typography>
        </Box>
      ) : null}

      {!hasVersions && !currentLogline ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontStyle: 'italic', fontSize: dense ? '0.65rem' : '0.8rem' }}
        >
          {access.canEdit
            ? 'No logline yet — write one below and keep iterating.'
            : 'No logline has been written for this project yet.'}
        </Typography>
      ) : null}

      {hasVersions ? (
        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: dense ? 0.5 : 1,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            // The stat tile grows with its content, so the list needs its own ceiling before it
            // starts scrolling; the dialog is bounded by its own height instead.
            maxHeight: dense ? 'var(--project-float-logline-list-max-height, 220px)' : 'none',
          }}
        >
          {orderedVersions.map((version) => (
            <LoglineVersionRow
              key={version._id}
              version={version}
              access={access}
              viewerUid={viewerUid}
              isPending={isPending}
              dense={dense}
              onUpdateVersion={onUpdateVersion}
              onDeleteVersion={onDeleteVersion}
              onMakeCurrent={onMakeCurrent}
              onAddFeedback={onAddFeedback}
              onDeleteFeedback={onDeleteFeedback}
            />
          ))}
        </Box>
      ) : null}

      {access.canEdit ? (
        // Docked under the history: the list above scrolls, this stays put as the entry point.
        <Box sx={{ flexShrink: 0, mt: 'auto', pt: dense ? 0.25 : 0.5 }}>
          <LoglineComposer
            placeholder={hasVersions ? 'Try another logline…' : 'Write your logline…'}
            submitLabel="Add"
            maxLength={MAX_LOGLINE_LENGTH}
            dense={dense}
            isPending={isPending}
            inlineAction
            onSubmit={onAddVersion}
          />
        </Box>
      ) : null}
    </Box>
  );
}
