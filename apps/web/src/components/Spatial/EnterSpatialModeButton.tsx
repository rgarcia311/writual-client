'use client'

import * as React from 'react'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'
import ViewInArIcon from '@mui/icons-material/ViewInAr'
import { AppAlert } from '@/components/AppAlert'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useSpatialRuntime } from '@/hooks/useIsSpatialEnvironment'

const PICO_GUIDANCE =
  'Open the browser address bar and choose "Run as a standalone app" to launch Writual in spatial mode.'

/**
 * There is no WebSpatial SDK call that forces the page into spatial mode — that state is set by
 * the browser/OS (visionOS packaging, or a PICO OS 6 page launched via "Run as standalone app").
 * This button surfaces the standard `beforeinstallprompt` install flow in-app instead of relying
 * on users to find it in browser chrome; accepting the prompt is what actually gets PICO Browser
 * to relaunch the page in standalone/spatial mode.
 *
 * Deliberately keyed on "is this presented as an app?" (`status === 'standalone'`) rather than
 * "is a spatial runtime present?" (`isSpatial`), which is what the earlier version checked.
 * The two are not the same on PICO: its OS-level Web App Runtime can report `picoos` while the
 * page is still an ordinary browser tab, so `isSpatial` alone would hide this button in exactly
 * the state where the user still needs to launch standalone. Treating them independently is
 * also robust to whichever way PICO actually reports browser-mode on device, which is unverified.
 *
 * Renders nothing unless there is something actionable to offer, so it stays invisible on
 * desktop browsers that will never fire the install event.
 */
export function EnterSpatialModeButton() {
  const { isPicoOs } = useSpatialRuntime()
  const { status, promptInstall } = useInstallPrompt()
  const [guidanceOpen, setGuidanceOpen] = React.useState(false)

  // Already an installed/standalone app, or installed during this session — nothing to offer.
  if (status === 'standalone' || status === 'installed') return null

  const canPrompt = status === 'available'
  // Spatial-capable but no install event: PICO exposes the affordance in its own chrome, so
  // point at it rather than rendering nothing and looking broken.
  const canGuide = !canPrompt && isPicoOs

  if (!canPrompt && !canGuide) return null

  const label = canPrompt ? 'Enter Spatial Mode' : 'How to enter Spatial Mode'

  return (
    <>
      <Tooltip title={canPrompt ? '' : PICO_GUIDANCE} placement="left">
        <Fab
          variant="extended"
          color="primary"
          aria-label={label}
          onClick={() => {
            if (canPrompt) void promptInstall()
            else setGuidanceOpen(true)
          }}
          sx={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: (theme) => theme.zIndex.speedDial,
          }}
        >
          <ViewInArIcon sx={{ mr: 1 }} />
          {label}
        </Fab>
      </Tooltip>

      {/* Click-driven rather than hover-only: ray pointers on a headset don't hover the way a
          mouse does, so the tooltip alone would be unreachable on the device that needs it. */}
      <AppAlert
        open={guidanceOpen}
        onClose={() => setGuidanceOpen(false)}
        message={PICO_GUIDANCE}
        severity="info"
        autoHideDurationMs={8000}
      />
    </>
  )
}
