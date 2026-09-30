'use client'

import * as React from 'react'
import { Box, CircularProgress, Fade } from '@mui/material'
import {
  SCREENPLAY_PAPER_WIDTH_PX,
  SCREENPLAY_VERTICAL_TOOLBAR_W_PX,
} from './screenplayPaperLayout'
import { ScreenplayVerticalToolbarShell } from './ScreenplayVerticalToolbarShell'
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

/**
 * Cross-fade out of the curtain and into the live editor.
 *
 * The two are not pixel-identical — the curtain paints no inter-page gap widgets, so page breaks
 * appear only once the real document is uncovered. Snapping between them reads as a flicker; a
 * short fade reads as the page settling.
 */
const HANDOFF_FADE_MS = 200

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
function SnapshotPaper({
  snapshot,
  toolbar,
}: {
  snapshot: ScreenplaySnapshot
  toolbar?: React.ReactNode
}) {
  const zoom = snapshot.zoom
  return (
    <Box
      sx={{
        width: `${rowWidthPx(zoom)}px`,
        maxWidth: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        boxSizing: 'border-box',
      }}
      aria-hidden
    >
      {/*
        The curtain carries its own toolbar column.

        The real one is right behind it and in the correct place, but `screenplayWorkspace.css`
        gives the editor column `z-index: 2`, which makes it a stacking context — so the toolbar's
        own `z-index: 3` can never lift it above this overlay. Without a copy here the reader sees
        the page appear first and the toolbar arrive only when the curtain drops. It is inert
        (`pointerEvents: none`): the live toolbar underneath owns every interaction.
      */}
      <Box sx={{ flexShrink: 0, display: 'flex', pointerEvents: 'none' }}>
        {toolbar ?? <ScreenplayVerticalToolbarShell>{null}</ScreenplayVerticalToolbarShell>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', position: 'relative' }}>
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
   * Screenplay document being previewed. The paint cache is keyed per document — two screenplays in
   * one project paint different pages — so this must match what `useScreenplaySnapshotPersistence`
   * writes, or the curtain falls back to a spinner every time.
   */
  documentId?: string | null
  /**
   * `absolute` covers an already-mounted editor while it finishes paginating; `flow` fills the
   * gate's own box while the document is still being fetched and there is nothing underneath.
   */
  variant?: 'flow' | 'absolute'
  /**
   * Vertical document toolbar to paint in the curtain's toolbar column, so it is on screen for as
   * long as the cached pages are. Passed in rather than imported because `ScreenplayToolbar` reads
   * `ELEMENT_ICONS` from `WritualEditor`, which imports this module — importing it here would close
   * that loop. Callers without a live toolbar omit it and get the bare shell.
   */
  toolbar?: React.ReactNode
  /**
   * False once the live editor is ready to be seen. The curtain fades out and then unmounts itself
   * rather than being switched off by the caller, so the hand-off can be animated at all.
   */
  visible?: boolean
}

/** Distinguishes "the cache said no" from "the cache has not answered yet". */
interface SnapshotRead {
  snapshot: ScreenplaySnapshot | null
  /** False only while the IndexedDB read is still in flight. */
  resolved: boolean
}

/**
 * The refresh curtain: cached pages if we have them for this project, a spinner if we don't.
 *
 * Reading the cache is asynchronous (IndexedDB), so the first paint of a cold session cannot show
 * pages yet; `peekScreenplaySnapshot` makes every later mount within the session synchronous, which
 * is what keeps the hand-off from the gates to the editor overlay from flashing.
 */
export function ScreenplayInstantPreview({
  projectId,
  documentId,
  variant = 'flow',
  toolbar,
  visible = true,
}: ScreenplayInstantPreviewProps) {
  const snapshotKey = screenplaySnapshotKey(projectId, documentId)

  const [read, setRead] = React.useState<SnapshotRead>(() => {
    const seen = snapshotKey ? peekScreenplaySnapshot(snapshotKey) : null
    return { snapshot: seen, resolved: seen != null }
  })

  React.useEffect(() => {
    if (!snapshotKey) {
      setRead({ snapshot: null, resolved: true })
      return
    }
    let cancelled = false
    void readScreenplaySnapshot(snapshotKey).then((snap) => {
      if (!cancelled) setRead({ snapshot: snap, resolved: true })
    })
    return () => {
      cancelled = true
    }
  }, [snapshotKey])

  const { snapshot, resolved } = read

  /**
   * As an overlay there is a real editor underneath, so once the cache has actually answered "no"
   * the honest thing is to show it — covering a ready editor would be slower than the behaviour
   * this replaces. Crucially this waits for `resolved`: bailing out while the read was still in
   * flight uncovered the editor mid-build for a frame or two, which is exactly the empty page and
   * half-populated toolbar that flashed before the cached pages arrived.
   */
  if (variant === 'absolute' && resolved && !snapshot) return null

  const positioning =
    variant === 'absolute'
      ? ({ position: 'absolute', inset: 0, zIndex: 4 } as const)
      : ({ position: 'relative', flex: 1, minHeight: 0, width: '100%' } as const)

  return (
    <Fade
      in={visible}
      appear={false}
      timeout={{ enter: 0, exit: HANDOFF_FADE_MS }}
      unmountOnExit
    >
      <Box
        className="screenplay-instant-preview"
        sx={{
          ...positioning,
          display: 'flex',
          justifyContent: 'center',
          alignItems: snapshot ? 'stretch' : 'center',
          overflow: 'hidden',
          bgcolor: 'background.default',
          // While fading out the editor beneath is already live; don't swallow its clicks.
          pointerEvents: visible ? undefined : 'none',
        }}
      >
        {snapshot ? (
          <SnapshotPaper snapshot={snapshot} toolbar={toolbar} />
        ) : variant === 'flow' ? (
          <Fade in style={{ transitionDelay: '400ms' }}>
            <CircularProgress size={28} />
          </Fade>
        ) : null}
      </Box>
    </Fade>
  )
}

/**
 * Cache key for one screenplay document's painted pages.
 *
 * Shared by the preview curtain and `useScreenplaySnapshotPersistence` so both sides agree. A
 * document-less key (the project id alone) is what projects had before multi-document support, and
 * is still used while the active document is being resolved.
 */
export function screenplaySnapshotKey(
  projectId: string | undefined,
  documentId?: string | null,
): string | undefined {
  if (!projectId) return undefined
  return documentId ? `${projectId}:${documentId}` : projectId
}
