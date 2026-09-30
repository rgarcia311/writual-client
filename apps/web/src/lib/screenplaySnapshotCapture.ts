'use client'

import {
  columnBoundsForPageWindow,
  pageAnchorFromColumnY,
  screenplayPageWindow,
} from '@/components/ScreenplayEditor/screenplayPageGeometry'
import {
  readScreenplayBodyPageCount,
  readScreenplayPaginationSheetTotal,
} from '../utils/screenplayPaginationRead'
import { type ScreenplaySnapshot, type SnapshotBlock } from './screenplaySnapshotCache'

/**
 * Plain text of one script block, excluding the chrome ProseMirror renders alongside it.
 *
 * `[data-node-view-content]` already excludes the node view's siblings (alts indicator, scene and
 * character hover buttons). Mid-block page splits are the exception: PageBreakPlugin nests a
 * `.page-break-gap` widget *inside* the content div, carrying "(MORE)", the next page's numeral and
 * a "(CONT'D)" cue — text that belongs to pagination, not to the document.
 */
function blockText(blockEl: HTMLElement): string {
  const contentEl = blockEl.querySelector<HTMLElement>('[data-node-view-content]') ?? blockEl
  if (!contentEl.querySelector('.page-break-gap')) return contentEl.textContent ?? ''
  const clone = contentEl.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.page-break-gap').forEach((gap) => gap.remove())
  return clone.textContent ?? ''
}

export interface CaptureOpts {
  projectId: string
  /** The scroll container (`.screenplay-workspace`). */
  workspaceEl: HTMLElement
  /** The paginated `.screenplay-page` root. */
  pageEl: HTMLElement
}

/**
 * Reads the page the reader is on — plus `SCREENPLAY_READING_WINDOW_RADIUS` pages either side —
 * into a snapshot for the local cache.
 *
 * The window is cut on sheet boundaries rather than around the viewport, so what is cached is
 * exactly the eleven pages the stored reading position claims are cached. A viewport-relative band
 * would drift with the window height and could leave the recorded window promising pages the
 * snapshot does not actually hold.
 *
 * All geometry is taken in *layout* space (pre-`transform: scale(zoom)`), which is what `offsetTop`
 * and `offsetHeight` already report, so a snapshot captured at one zoom replays correctly at
 * another. The scale is derived from the measured-vs-layout width of the ProseMirror column rather
 * than passed in, so this can never disagree with what is actually on screen.
 *
 * Returns null when the document is not paginated/laid out yet — writing then would cache an empty
 * or wrongly-positioned window and make the next refresh worse than no cache at all.
 */
export function captureScreenplaySnapshot(opts: CaptureOpts): ScreenplaySnapshot | null {
  const { projectId, workspaceEl, pageEl } = opts
  if (!projectId || !workspaceEl.isConnected || !pageEl.isConnected) return null

  const pmEl = pageEl.querySelector<HTMLElement>('.ProseMirror')
  if (!pmEl || pmEl.offsetWidth <= 0) return null

  const pmRect = pmEl.getBoundingClientRect()
  const scale = pmRect.width / pmEl.offsetWidth
  if (!Number.isFinite(scale) || scale <= 0) return null

  const wsRect = workspaceEl.getBoundingClientRect()
  /** Layout-space y of the viewport's top edge within the ProseMirror column. */
  const viewTop = (wsRect.top - pmRect.top) / scale
  const totalPages = readScreenplayPaginationSheetTotal(pageEl) ?? 1
  const { sheet } = pageAnchorFromColumnY(viewTop, totalPages)
  const pageWindow = screenplayPageWindow(sheet, totalPages)
  const { top: windowTop, bottom: windowBottom } = columnBoundsForPageWindow(pageWindow)

  const blocks: SnapshotBlock[] = []
  for (const child of Array.from(pmEl.children) as HTMLElement[]) {
    const blockEl = child.matches('.script-block')
      ? child
      : child.querySelector<HTMLElement>(':scope > .script-block')
    // Page-break gap widgets sit between blocks and hold no document text.
    if (!blockEl) continue

    const top = child.offsetTop
    if (top > windowBottom) break // children are in document order, so nothing later qualifies
    if (top + child.offsetHeight < windowTop) continue

    const prev = child.previousElementSibling
    blocks.push({
      elementType: blockEl.getAttribute('data-element-type') || 'action',
      text: blockText(blockEl),
      top,
      ...(prev?.classList.contains('page-break-gap') ? { atPageTop: true } : {}),
    })
  }

  if (blocks.length === 0) return null

  return {
    projectId,
    updatedAt: Date.now(),
    scrollTopLayoutPx: workspaceEl.scrollTop / scale,
    zoom: scale,
    documentHeightPx: pmEl.offsetHeight,
    totalPages,
    bodyPages: readScreenplayBodyPageCount(pageEl) ?? 0,
    sheet,
    windowStart: pageWindow.start,
    windowEnd: pageWindow.end,
    blocks,
  }
}
