'use client'

import * as React from 'react'
import { Box, Paper, Typography, useTheme } from '@mui/material'
import CloudDoneIcon from '@mui/icons-material/CloudDone'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { ScreenplayToolbar } from './ScreenplayToolbar'
import { SCREENPLAY_TOOLBAR_SHADOW } from './screenplayPaperLayout'

// <PROTECTED>
export const SCREENPLAY_ZOOM_MIN = 0.5
export const SCREENPLAY_ZOOM_MAX = 2
export const SCREENPLAY_ZOOM_STEP = 0.1

/** Width of the vertical document toolbar in pixels. */
export const SCREENPLAY_VERTICAL_TOOLBAR_W_PX = 44
// </PROTECTED>

export interface ScreenplayDocumentToolbarProps {
  collabActive: boolean
  isSavingOrPending: boolean
  showSaved: boolean
  orientation?: 'horizontal' | 'vertical'
}

export function ScreenplayDocumentToolbar({
  collabActive,
  isSavingOrPending,
  showSaved,
  orientation = 'horizontal',
}: ScreenplayDocumentToolbarProps) {
  const theme = useTheme()
  const showElementSelectors = useScreenplayEditorStore(
    (s) => s.canEdit && s.setElementTypeFn != null,
  )

  const showSaveRow = !collabActive && (isSavingOrPending || showSaved)

  if (!showElementSelectors && !showSaveRow) return null

  // ── Vertical layout ───────────────────────────────────────────────────────
  if (orientation === 'vertical') {
    return (
      <Paper
        className="screenplay-toolbar screenplay-toolbar-vertical"
        elevation={0}
        sx={{
          // <PROTECTED>
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          alignSelf: 'stretch',
          width: SCREENPLAY_VERTICAL_TOOLBAR_W_PX,
          flexShrink: 0,
          borderRight: `1px solid ${theme.palette.divider}`,
          borderTopLeftRadius: "8px",
          borderBottomLeftRadius: "8px",
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          bgcolor: 'background.default',
          boxShadow: SCREENPLAY_TOOLBAR_SHADOW,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          py: 1,
          zIndex: 1,
          // </PROTECTED>
        }}
      >
        {showSaveRow && (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', mb: 0.5, flexShrink: 0 }}
            aria-label={isSavingOrPending ? 'Saving' : 'Saved'}
          >
            <CloudDoneIcon
              sx={{
                fontSize: 16,
                color: isSavingOrPending ? 'text.disabled' : 'success.main',
              }}
            />
          </Box>
        )}
        {showElementSelectors && <ScreenplayToolbar orientation="vertical" />}
      </Paper>
    )
  }

  // ── Horizontal layout (original) ──────────────────────────────────────────
  const saveContent = (
    <>
      {isSavingOrPending && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} aria-label="Saving">
          <CloudDoneIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            ...saving
          </Typography>
        </Box>
      )}
      {showSaved && (
        <Box sx={{ display: 'flex', alignItems: 'center' }} aria-label="Saved">
          <CloudDoneIcon sx={{ fontSize: 18, color: 'success.main' }} />
        </Box>
      )}
    </>
  )

  return (
    <>
      {showElementSelectors ? (
        <Paper
          className="screenplay-toolbar screenplay-toolbar-elements"
          elevation={0}
          sx={{
            // <PROTECTED>
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            px: 1.5,
            py: 0.75,
            minHeight: 53,
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexShrink: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            bgcolor: 'background.default',
            boxShadow: 2,
            // </PROTECTED>
          }}
        >
          <ScreenplayToolbar />
        </Paper>
      ) : null}

      {showSaveRow ? (
        <Paper
          elevation={0}
          sx={{
            // <PROTECTED>
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexShrink: 0,
            bgcolor: 'background.default',
            boxShadow: showElementSelectors ? 0 : 2,
            ...(!showElementSelectors
              ? {
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                }
              : {}),
            // </PROTECTED>
          }}
        >
          {saveContent}
        </Paper>
      ) : null}
    </>
  )
}
