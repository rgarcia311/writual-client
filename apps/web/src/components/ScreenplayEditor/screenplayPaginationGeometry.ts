'use client'

import { SCREENPLAY_LINE_HEIGHT_PX } from './screenplayPaperLayout'

/**
 * Pure geometry helpers shared by `PageBreakPlugin.ts`.
 *
 * Everything in here exists to make pagination decisions a function of the document's *layout*
 * only — never of the on-screen zoom, and therefore never of the browser window size. The paper is
 * a fixed 816 x 1056px box scaled to the viewport with `transform: scale(zoom)` (see
 * `WritualEditor.tsx`), so line wrapping and block heights are already window-independent; the
 * drift came entirely from how measured *visual* pixels were mapped back to layout pixels.
 */

/**
 * Tolerance (layout px) when comparing a measured position against the 16px line grid.
 *
 * Script-block tops and bottoms land on exact multiples of `SCREENPLAY_LINE_HEIGHT_PX`, so a
 * measured bottom is `16k ± noise`. Any positive noise pushes `Math.ceil()` to `k + 1` lines,
 * i.e. reports a block as overflowing a page it exactly fills — and because a break moved one
 * line early shifts everything after it, a single flipped boundary changes the total page count.
 * The previous `1e-3` epsilon was far tighter than real measurement noise. Half a pixel is
 * comfortably above the residual noise (~0.01px once the scale is exact, see
 * `layoutScaleFromEditorDom`) and far below the 16px a genuine extra line adds, so it can only
 * absorb error, never mask a real overflow.
 */
export const LINE_GRID_TOLERANCE_PX = 0.5

/**
 * Compare against the industry 16px line grid (54 lines x 16px = 864px content band).
 * Sub-pixel bottoms from zoom/font metrics must not push a line that still fits on-page.
 */
export function layoutBottomExceedsPageContentEnd(
  layoutBottom: number,
  pageContentEnd: number,
  pageContentStart: number,
): boolean {
  const relativeBottom = layoutBottom - pageContentStart
  const maxLines = (pageContentEnd - pageContentStart) / SCREENPLAY_LINE_HEIGHT_PX
  const usedLines = Math.ceil((relativeBottom - LINE_GRID_TOLERANCE_PX) / SCREENPLAY_LINE_HEIGHT_PX)
  return usedLines > maxLines
}

/**
 * Script blocks use `padding-bottom: var(--sp-line-single)` as the blank line *before* the next
 * element. That spacer does not need to fit on the same page as the last ink line when deciding
 * whether a block "overflows" — same idea as PDF flow. Subtract it for overflow checks only.
 */
export function layoutBottomForPaginationOverflow(
  elementType: string | undefined,
  layoutBottom: number,
): number {
  const t = elementType ?? 'action'
  if (t === 'dialogue' || t === 'action' || t === 'slugline' || t === 'transition') {
    return layoutBottom - SCREENPLAY_LINE_HEIGHT_PX
  }
  return layoutBottom
}

/**
 * Whole lines that fit in `spanPx`, tolerant of sub-pixel measurement noise on the line grid.
 * `Math.floor()` alone drops a whole line whenever a grid-aligned span measures a hair short.
 */
export function wholeLinesInSpan(spanPx: number): number {
  return Math.floor((spanPx + LINE_GRID_TOLERANCE_PX) / SCREENPLAY_LINE_HEIGHT_PX)
}

/**
 * Vertical scale factor of a computed `transform` value (the matrix's `d` / `m22` component), or
 * `null` if it isn't a matrix this can read. Exported for tests; callers want
 * `layoutScaleFromEditorDom`.
 */
export function transformScaleY(transform: string): number | null {
  if (!transform || transform === 'none') return null

  if (typeof DOMMatrixReadOnly !== 'undefined') {
    try {
      const d = new DOMMatrixReadOnly(transform).d
      return Number.isFinite(d) ? d : null
    } catch {
      // Fall through to the manual parse below.
    }
  }

  const match = /^matrix(3d)?\(([^)]+)\)$/.exec(transform.trim())
  if (!match) return null
  const parts = match[2].split(',').map((v) => Number.parseFloat(v))
  // matrix(a, b, c, d, e, f) -> d is index 3; matrix3d(m11, m12, m13, m14, m21, m22, ...) -> m22 is index 5.
  const d = match[1] ? parts[5] : parts[3]
  return Number.isFinite(d) ? d : null
}

/**
 * Product of every ancestor's vertical scale, or `null` if any of them is unreadable.
 *
 * Covers all three ways an ancestor can scale its subtree's rendered box without changing its
 * layout coordinates: `transform`, the standalone `scale` property, and (non-standard, Chromium)
 * `zoom`. Today only `transform: scale(zoom)` in `WritualEditor.tsx` is in play; the other two are
 * read anyway so a future style change can't silently reintroduce a scale this misses.
 */
function cumulativeScaleY(dom: HTMLElement): number | null {
  if (typeof getComputedStyle !== 'function') return null
  let scale = 1
  for (let el: HTMLElement | null = dom; el; el = el.parentElement) {
    const cs = getComputedStyle(el)

    const transform = cs.transform
    if (transform && transform !== 'none') {
      const d = transformScaleY(transform)
      // An unreadable transform means the product would be wrong — say so rather than under-report.
      if (d == null || d <= 0) return null
      scale *= d
    }

    // `scale: <sy>` or `scale: <sx> <sy>` — a shorthand-free sibling of `transform: scale()`.
    const scaleProp = cs.scale
    if (scaleProp && scaleProp !== 'none') {
      const parts = scaleProp.trim().split(/\s+/).map((v) => Number.parseFloat(v))
      const sy = parts.length > 1 ? parts[1] : parts[0]
      if (!Number.isFinite(sy) || sy <= 0) return null
      scale *= sy
    }

    const zoomProp = Number.parseFloat((cs as CSSStyleDeclaration & { zoom?: string }).zoom ?? '1')
    if (Number.isFinite(zoomProp) && zoomProp > 0) scale *= zoomProp
  }
  return Number.isFinite(scale) && scale > 0 ? scale : null
}

/**
 * Map post-`transform: scale()` visual pixels to layout CSS px (`getBoundingClientRect` /
 * `offsetHeight`).
 *
 * Read from the ancestors' actual transform matrices, not inferred from
 * `getBoundingClientRect().height / offsetHeight`. `offsetHeight` is rounded to a whole pixel, so
 * that ratio carries a relative error of about `0.5 / documentHeight` — which on a feature-length
 * script grows back into several tenths of a layout pixel at the bottom of the document, and whose
 * magnitude and sign change with the zoom, i.e. with the browser window size. Since block bottoms
 * sit on the 16px line grid, that noise flipped page-boundary decisions and made the reported page
 * count depend on the window. The matrix is exact and window-size independent.
 *
 * The `offsetHeight` ratio is kept only as a fallback for environments where the computed
 * transform can't be read.
 */
export function layoutScaleFromEditorDom(dom: HTMLElement): number {
  const exact = cumulativeScaleY(dom)
  if (exact != null) return Math.abs(exact - 1) < 1e-9 ? 1 : exact

  const h = dom.offsetHeight
  if (h === 0) return 1
  const r = dom.getBoundingClientRect().height
  const s = r / h
  if (!Number.isFinite(s) || s <= 0) return 1
  return Math.abs(s - 1) < 0.001 ? 1 : s
}
