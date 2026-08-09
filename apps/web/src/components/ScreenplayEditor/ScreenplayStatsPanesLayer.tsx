'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useScreenplayStatsPanesStore } from '@/state/screenplayStatsPanes'
import { ProjectStatDetailPane } from './ProjectStatDetailPane'

/**
 * Portaled to `document.body` so panes float free of the screenplay paper's zoom transform and
 * scrolling workspace container — rendering them inside that subtree would clip/rescale them.
 */
export function ScreenplayStatsPanesLayer() {
  const panes = useScreenplayStatsPanesStore((s) => s.panes)
  const closeAllPanes = useScreenplayStatsPanesStore((s) => s.closeAllPanes)

  React.useEffect(() => {
    return () => {
      closeAllPanes()
    }
  }, [closeAllPanes])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {Object.values(panes).map((pane) =>
        pane ? <ProjectStatDetailPane key={pane.id} paneId={pane.id} /> : null,
      )}
    </>,
    document.body,
  )
}
