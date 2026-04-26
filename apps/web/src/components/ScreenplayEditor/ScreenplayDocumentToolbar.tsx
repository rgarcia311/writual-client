'use client'

import * as React from 'react'
import { Box, Paper, Typography, useTheme } from '@mui/material'
import CloudDoneIcon from '@mui/icons-material/CloudDone'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { ScreenplayToolbar } from './ScreenplayToolbar'

export const SCREENPLAY_ZOOM_MIN = 0.5
export const SCREENPLAY_ZOOM_MAX = 2
export const SCREENPLAY_ZOOM_STEP = 0.1

export interface ScreenplayDocumentToolbarProps {
  collabActive: boolean
  isSavingOrPending: boolean
  showSaved: boolean
}

export function ScreenplayDocumentToolbar({
  collabActive,
  isSavingOrPending,
  showSaved,
}: ScreenplayDocumentToolbarProps) {
  const theme = useTheme()
  const showElementSelectors = useScreenplayEditorStore(
    (s) => s.canEdit && s.setElementTypeFn != null,
  )

  const showSaveRow = !collabActive && (isSavingOrPending || showSaved)

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

  if (!showElementSelectors && !showSaveRow) return null

  return (
    <>
      {showElementSelectors ? (
        <Paper
          className="screenplay-toolbar screenplay-toolbar-elements"
          elevation={0}
          sx={{
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
          }}
        >
          <ScreenplayToolbar />
        </Paper>
      ) : null}

      {showSaveRow ? (
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexShrink: 0,
            bgcolor: 'background.default',
            /* Match TreatmentToolbar elevation when this row is on its own */
            boxShadow: showElementSelectors ? 0 : 2,
            ...(!showElementSelectors
              ? {
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                }
              : {}),
          }}
        >
          {saveContent}
        </Paper>
      ) : null}
    </>
  )
}
