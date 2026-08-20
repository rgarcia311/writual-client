'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Box, Chip, Divider, IconButton, Tooltip, Typography } from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { useScreenplayHeaderChromeStore } from '@/state/screenplayHeaderChrome'
import { useScreenplayLivePagesStore } from '@/state/screenplayLivePages'
import {
  SCREENPLAY_ZOOM_MAX,
  SCREENPLAY_ZOOM_MIN,
} from './ScreenplayDocumentToolbar'

function isScreenplayProjectPath(pathname: string | null): boolean {
  return pathname != null && /^\/project\/[^/]+\/screenplay/.test(pathname)
}

function screenplayProjectIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null
  const match = /^\/project\/([^/]+)\/screenplay/.exec(pathname)
  return match?.[1] ?? null
}

export function ScreenplayHeaderChrome() {
  const pathname = usePathname()
  const projectId = screenplayProjectIdFromPath(pathname)
  /** Measured pagination when available, else the server's stored total, else unknown. */
  const bodyPages = useScreenplayLivePagesStore((s) =>
    projectId && s.projectId === projectId ? s.liveBodyPages ?? s.seedBodyPages : null,
  )
  const zoom = useScreenplayHeaderChromeStore((s) => s.zoom)
  const isAutoZoomed = useScreenplayHeaderChromeStore((s) => s.isAutoZoomed)
  const collabActive = useScreenplayHeaderChromeStore((s) => s.collabActive)
  const handlers = useScreenplayHeaderChromeStore((s) => s.handlers)
  const collabStatus = useScreenplayEditorStore((s) => s.collabStatus)
  const connectedUsers = useScreenplayEditorStore((s) => s.connectedUsers)

  if (!isScreenplayProjectPath(pathname)) return null

  const hasCollabChip =
    (collabActive && collabStatus === 'connecting') ||
    (collabActive && collabStatus === 'disconnected') ||
    (collabActive && collabStatus === 'connected' && connectedUsers.length > 1)

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}
    >
      {collabActive && collabStatus === 'connecting' && (
        <Chip label="Syncing..." size="small" color="warning" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
      )}
      {collabActive && collabStatus === 'disconnected' && (
        <Chip label="Offline" size="small" color="error" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
      )}
      {collabActive && collabStatus === 'connected' && connectedUsers.length > 1 && (
        <Chip
          label={`${connectedUsers.length} online`}
          size="small"
          color="success"
          variant="outlined"
          sx={{ height: 22, fontSize: '0.65rem' }}
        />
      )}

      {hasCollabChip ? <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} /> : null}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}
        aria-live="polite"
        aria-label={
          bodyPages != null
            ? `${bodyPages} screenplay ${bodyPages === 1 ? 'page' : 'pages'}`
            : 'Screenplay page count loading'
        }
      >
        {bodyPages != null ? `${bodyPages} ${bodyPages === 1 ? 'page' : 'pages'}` : '—'}
      </Typography>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Zoom out (Ctrl/Cmd + scroll)">
        <span>
          <IconButton
            size="small"
            onClick={() => handlers?.zoomOut()}
            disabled={!handlers || zoom <= SCREENPLAY_ZOOM_MIN}
            aria-label="zoom out screenplay"
          >
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontFamily: 'monospace', minWidth: 36, textAlign: 'center' }}
        aria-live="polite"
      >
        {Math.round(zoom * 100)}%
      </Typography>
      <Tooltip title="Zoom in (Ctrl/Cmd + scroll)">
        <span>
          <IconButton
            size="small"
            onClick={() => handlers?.zoomIn()}
            disabled={!handlers || zoom >= SCREENPLAY_ZOOM_MAX}
            aria-label="zoom in screenplay"
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Fit page to window">
        <span>
          <IconButton
            size="small"
            onClick={() => handlers?.zoomReset()}
            disabled={!handlers || isAutoZoomed}
            aria-label="reset screenplay zoom"
          >
            <FitScreenIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Print screenplay — generates a Letter PDF and opens the system print dialog">
        <IconButton size="small" onClick={() => handlers?.print()} disabled={!handlers} aria-label="print screenplay">
          <PrintIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
