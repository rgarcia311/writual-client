'use client'

import * as React from 'react'
import Fab from '@mui/material/Fab'
import ViewInArIcon from '@mui/icons-material/ViewInAr'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useIsSpatialEnvironment } from '@/hooks/useIsSpatialEnvironment'

/**
 * There is no WebSpatial SDK call that forces the page into spatial mode — that state is set by
 * the browser/OS (visionOS packaging, or a PICO OS 6 page launched via "Run as standalone app").
 * This button surfaces the standard `beforeinstallprompt` install flow in-app instead of relying
 * on users to find it in browser chrome; accepting the prompt is what actually gets PICO Browser
 * to relaunch the page in standalone/spatial mode.
 */
export function EnterSpatialModeButton() {
  const isSpatial = useIsSpatialEnvironment()
  const { isAvailable, installed, promptInstall } = useInstallPrompt()

  if (isSpatial || installed || !isAvailable) return null

  return (
    <Fab
      variant="extended"
      color="primary"
      onClick={() => {
        void promptInstall()
      }}
      sx={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: (theme) => theme.zIndex.speedDial,
      }}
    >
      <ViewInArIcon sx={{ mr: 1 }} />
      Enter Spatial Mode
    </Fab>
  )
}
