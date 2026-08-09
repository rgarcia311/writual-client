'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useScreenplayInspirationPanesStore } from '@/state/screenplayInspirationPanes'
import { InspirationDetailPane } from './InspirationDetailPane'

/**
 * Portaled to `document.body` so panes float free of the screenplay paper's zoom transform and
 * scrolling workspace container — rendering them inside that subtree would clip/rescale them.
 */
export function ScreenplayInspirationPanesLayer() {
  const panes = useScreenplayInspirationPanesStore((s) => s.panes)
  const closeAllPanes = useScreenplayInspirationPanesStore((s) => s.closeAllPanes)

  React.useEffect(() => {
    return () => {
      closeAllPanes()
    }
  }, [closeAllPanes])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {Object.values(panes).map((pane) => (
        <InspirationDetailPane key={pane.id} paneId={pane.id} />
      ))}
    </>,
    document.body,
  )
}
