'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useScreenplayScenePanesStore } from '@/state/screenplayScenePanes'
import { SceneDetailPane } from './SceneDetailPane'

/**
 * Portaled to `document.body` so panes float free of the screenplay paper's zoom transform and
 * scrolling workspace container — rendering them inside that subtree would clip/rescale them.
 */
export function ScreenplayScenePanesLayer() {
  const panes = useScreenplayScenePanesStore((s) => s.panes)
  const closeAllPanes = useScreenplayScenePanesStore((s) => s.closeAllPanes)

  React.useEffect(() => {
    return () => {
      closeAllPanes()
    }
  }, [closeAllPanes])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {Object.values(panes).map((pane) => (
        <SceneDetailPane key={pane.id} paneId={pane.id} />
      ))}
    </>,
    document.body,
  )
}
