'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'
import { writeScreenplayDocument } from '@/lib/screenplayContentCache'

/** Idle gap before an edit is written to the local document cache. */
const PERSIST_DEBOUNCE_MS = 1500

/**
 * Keeps the persisted script body in step with what the reader is actually looking at.
 *
 * Under collaboration the server's copy of a document lags the Y.Doc between autosaves, so caching
 * only what the read query returned would restore a slightly older script on the next visit. The
 * mounted editor is the freshest copy there is, so it is what gets persisted.
 *
 * Empty documents are never written: TipTap reports an empty doc during the frames before content
 * is seeded, and persisting that would replace a good entry with a blank screenplay.
 */
export function useScreenplayContentPersistence(opts: {
  projectId: string | undefined
  documentId: string | null
  editor: Editor | null
  /** False until the document has actually been seeded — see the empty-document note above. */
  enabled: boolean
}): void {
  const { projectId, documentId, editor, enabled } = opts

  React.useEffect(() => {
    if (!enabled || !projectId || !editor) return

    let timerId: ReturnType<typeof setTimeout> | null = null

    const persist = () => {
      timerId = null
      if (editor.isDestroyed || editor.isEmpty) return
      void writeScreenplayDocument({
        projectId,
        documentId,
        version: null,
        source: 'editor',
        content: editor.getJSON(),
      })
    }

    const schedule = () => {
      if (timerId != null) clearTimeout(timerId)
      timerId = setTimeout(persist, PERSIST_DEBOUNCE_MS)
    }

    const persistNow = () => {
      if (timerId != null) {
        clearTimeout(timerId)
        timerId = null
      }
      persist()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistNow()
    }

    editor.on('update', schedule)
    window.addEventListener('pagehide', persistNow)
    document.addEventListener('visibilitychange', onVisibility)

    // Seed once so a visit that never edits still leaves a usable body behind.
    schedule()

    return () => {
      editor.off('update', schedule)
      window.removeEventListener('pagehide', persistNow)
      document.removeEventListener('visibilitychange', onVisibility)
      persistNow()
    }
  }, [enabled, projectId, documentId, editor])
}
