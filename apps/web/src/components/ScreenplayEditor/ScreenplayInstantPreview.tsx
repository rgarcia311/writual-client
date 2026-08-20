'use client'

import * as React from 'react'
import { Box, CircularProgress, Fade } from '@mui/material'
import {
  SCREENPLAY_PAPER_WIDTH_PX,
  SCREENPLAY_VERTICAL_TOOLBAR_W_PX,
} from './screenplayPaperLayout'
import { courierPrime } from '../../utils/fonts'
import {
  peekScreenplaySnapshot,
  readScreenplaySnapshot,
  type ScreenplaySnapshot,
} from '@/lib/screenplaySnapshotCache'
import './Screenplay.css'

/**
 * Right-hand insets of the toolbar + paper row, mirroring the same-named PROTECTED constants in
 * `WritualEditor.tsx` (scroll-inner right pad, and the lateral rim-shadow bleed). Duplicated rather
 * than imported because that block cannot be refactored to export them; they only affect where this
 * curtain centres its paper, so a drift shows as a few px of horizontal shift, never a broken page.
 */
const SCROLL_INNER_PAD_RIGHT_PX = 32
const STAGE_RIM_HORIZONTAL_OUTSET_PX = 18

/** Same row width formula as `screenplayToolbarPaperRowMinWidthPx`, so the paper lands where the real one will. */
function rowWidthPx(zoom: number): number {
  return (
    SCREENPLAY_VERTICAL_TOOLBAR_W_PX +
    Math.ceil(SCREENPLAY_PAPER_WIDTH_PX * zoom) +
    SCROLL_INNER_PAD_RIGHT_PX +
    STAGE_RIM_HORIZONTAL_OUTSET_PX
  )
}

/**
 * Static repaint of the cached window of script blocks, positioned at the reader's last scroll
 * offset. Purely visual: it reuses `Screenplay.css` (same font, indents, page furniture) so it
 * reads as the document rather than as a placeholder, and it is never editable or saved.
 *
 * Blocks are absolutely positioned at the exact `top` they occupied when captured instead of being
 * laid out in flow, because the cache deliberately holds only a ±5 page slice — flowing it would
 * stack those blocks from the top of the document and land every one of them on the wrong page.
 */
function SnapshotPaper({ snapshot }: { snapshot: ScreenplaySnapshot }) {
  const zoom = snapshot.zoom
  return (
    <Box
      sx={{
        width: `${rowWidthPx(zoom)}px`,
        maxWidth: '100%',
        height: '100%',
        overflow: 'hidden',
        pl: `${SCREENPLAY_VERTICAL_TOOLBAR_W_PX}px`,
        boxSizing: 'border-box',
      }}
      aria-hidden
    >
      <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <Box
          sx={{
            width: `${SCREENPLAY_PAPER_WIDTH_PX}px`,
            transform: `scale(${zoom}) translateY(${-snapshot.scrollTopLayoutPx}px)`,
            transformOrigin: 'top left',
          }}
        >
          <div
            className="screenplay-page"
            style={
              {
                ...courierPrime.style,
                '--total-pages': snapshot.totalPages,
              } as React.CSSProperties
            }
          >
            <div
              className="ProseMirror"
              style={{ position: 'relative', height: `${snapshot.documentHeightPx}px` }}
            >
              {/* Placeholder so `.ProseMirror > .node-scriptBlock:first-child` — which strips the
                  opening slugline's lead — cannot match a block that is merely first in the
                  cached window rather than first in the document. */}
              <div />
              {snapshot.blocks.map((block, i) => (
                <div
                  key={`${block.top}-${i}`}
                  className="node-scriptBlock"
                  style={{ position: 'absolute', top: `${block.top}px`, left: 0, right: 0 }}
                >
                  <div
                    className="script-block"
                    data-script-block="true"
                    data-element-type={block.elementType}
                    style={block.atPageTop ? { paddingTop: 0 } : undefined}
                  >
                    <div data-node-view-content="">{block.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Box>
      </Box>
    </Box>
  )
}

export interface ScreenplayInstantPreviewProps {
  projectId: string | undefined
  /**
   * `absolute` covers an already-mounted editor while it finishes paginating; `flow` fills the
   * gate's own box while the document is still being fetched and there is nothing underneath.
   */
  variant?: 'flow' | 'absolute'
}

/**
 * The refresh curtain: cached pages if we have them for this project, a spinner if we don't.
 *
 * Reading the cache is asynchronous (IndexedDB), so the first paint of a cold session is still the
 * spinner; `peekScreenplaySnapshot` makes every later mount within the session synchronous, which
 * is what keeps the hand-off from the gates to the editor overlay from flashing.
 */
export function ScreenplayInstantPreview({
  projectId,
  variant = 'flow',
}: ScreenplayInstantPreviewProps) {
  const [snapshot, setSnapshot] = React.useState<ScreenplaySnapshot | null>(() =>
    projectId ? peekScreenplaySnapshot(projectId) : null,
  )

  React.useEffect(() => {
    if (!projectId) return
    let cancelled = false
    void readScreenplaySnapshot(projectId).then((snap) => {
      if (!cancelled) setSnapshot(snap)
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  /**
   * As an overlay there is a real editor underneath, so with nothing cached the honest thing is to
   * show it — covering a ready editor with a spinner would be slower than the behaviour this
   * replaces. In the gates there is nothing underneath, so a spinner is still the fallback.
   */
  if (variant === 'absolute' && !snapshot) return null

  const positioning =
    variant === 'absolute'
      ? ({ position: 'absolute', inset: 0, zIndex: 4 } as const)
      : ({ position: 'relative', flex: 1, minHeight: 0, width: '100%' } as const)

  return (
    <Box
      className="screenplay-instant-preview"
      sx={{
        ...positioning,
        display: 'flex',
        justifyContent: 'center',
        alignItems: snapshot ? 'stretch' : 'center',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {snapshot ? (
        <SnapshotPaper snapshot={snapshot} />
      ) : (
        <Fade in style={{ transitionDelay: '400ms' }}>
          <CircularProgress size={28} />
        </Fade>
      )}
    </Box>
  )
}
