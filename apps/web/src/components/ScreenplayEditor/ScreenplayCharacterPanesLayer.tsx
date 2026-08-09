'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useScreenplayCharacterPanesStore } from '@/state/screenplayCharacterPanes'
import { CharacterDetailPane } from './CharacterDetailPane'

/**
 * Portaled to `document.body` so panes float free of the screenplay paper's zoom transform and
 * scrolling workspace container — rendering them inside that subtree would clip/rescale them.
 */
export function ScreenplayCharacterPanesLayer() {
  const panes = useScreenplayCharacterPanesStore((s) => s.panes)
  const closeAllPanes = useScreenplayCharacterPanesStore((s) => s.closeAllPanes)

  React.useEffect(() => {
    return () => {
      closeAllPanes()
    }
  }, [closeAllPanes])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {Object.values(panes).map((pane) => (
        <CharacterDetailPane key={pane.id} paneId={pane.id} />
      ))}
    </>,
    document.body,
  )
}
