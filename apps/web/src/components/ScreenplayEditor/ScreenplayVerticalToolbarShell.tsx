'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material'
import {
  SCREENPLAY_TOOLBAR_SHADOW,
  SCREENPLAY_VERTICAL_TOOLBAR_W_PX,
} from './screenplayPaperLayout'

export interface ScreenplayVerticalToolbarShellProps {
  children: React.ReactNode
}

/**
 * Floating host for the vertical document toolbar.
 * Shadow + radius live on this shell (overflow visible); only the inner box scrolls.
 */
export function ScreenplayVerticalToolbarShell({
  children,
}: ScreenplayVerticalToolbarShellProps) {
  const theme = useTheme()

  return (
    // Not a PROTECTED region — no width/margin/padding touched here, so pagination/gutter
    // alignment (screenplay-toolbar-page-alignment.mdc) is unaffected. To revert: remove the
    // `enable-xr` attribute and the `style` prop below; everything else is unchanged.
    <Box
      enable-xr
      className="screenplay-toolbar screenplay-toolbar-vertical screenplay-toolbar-vertical-shell"
      sx={{
        alignSelf: 'stretch',
        width: SCREENPLAY_VERTICAL_TOOLBAR_W_PX,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        borderTopLeftRadius: 'var(--app-sidenav-radius, 10px)',
        borderBottomLeftRadius: 'var(--app-sidenav-radius, 10px)',
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        bgcolor: 'background.default',
        boxShadow: `${SCREENPLAY_TOOLBAR_SHADOW}, ${theme.shadows[2]}`,
        position: 'relative',
        zIndex: 3,
      }}
      style={
        {
          '--xr-back': '20px',
          '--xr-background-material': 'translucent',
        } as React.CSSProperties
      }
    >
      <Box
        className="screenplay-toolbar-vertical__scroll"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
          minHeight: 0,
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          py: 1,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
