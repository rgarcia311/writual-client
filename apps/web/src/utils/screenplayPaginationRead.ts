/**
 * Reads body page totals matching PageBreak pagination (same as `--total-pages` intent).
 */

import {
  SCREENPLAY_INTER_PAGE_GAP_PX,
  SCREENPLAY_PAPER_HEIGHT_PX,
} from '../components/ScreenplayEditor/screenplayPaperLayout'

const PAGE_GAP_NUM_SELECTOR = '.page-break-gap__page-number'

function parseCssPx(raw: string): number | null {
  const m = /^([\d.]+)px\s*$/i.exec(raw.trim())
  if (!m) return null
  const x = Number.parseFloat(m[1])
  return Number.isFinite(x) && x > 0 ? x : null
}

function inferPagesFromStackMinHeight(screenplayPageRoot: HTMLElement): number | null {
  if (typeof window === 'undefined') return null
  const mhPx = parseCssPx(window.getComputedStyle(screenplayPageRoot).minHeight)
  if (mhPx == null) return null
  /** Mirrors `.screenplay-page { min-height: T*PH + max(0,T-1)*G }` in Screenplay.css */
  const ph = SCREENPLAY_PAPER_HEIGHT_PX
  const g = SCREENPLAY_INTER_PAGE_GAP_PX
  const t = Math.round((mhPx + g) / (ph + g))
  return Math.max(1, t)
}

export function readScreenplayPaginationTotalPages(screenplayPageRoot: HTMLElement): number | null {
  const spans = screenplayPageRoot.querySelectorAll(PAGE_GAP_NUM_SELECTOR)
  let maxPrinted = 0
  spans.forEach((el) => {
    const digits = Number.parseInt((el.textContent ?? '').replace(/\D/g, ''), 10)
    if (Number.isFinite(digits)) maxPrinted = Math.max(maxPrinted, digits)
  })
  /** Page-break widgets print from page 2 upward; highest num matches body page total for normal scripts */
  let best = maxPrinted >= 2 ? maxPrinted : 0

  const fromVarInline = screenplayPageRoot.style.getPropertyValue('--total-pages').trim()
  const nInline = Number.parseInt(fromVarInline, 10)
  if (Number.isFinite(nInline) && nInline >= 1) best = Math.max(best, nInline)

  if (typeof window !== 'undefined') {
    const fromComputedVar = Number.parseInt(
      window.getComputedStyle(screenplayPageRoot).getPropertyValue('--total-pages').trim(),
      10,
    )
    if (Number.isFinite(fromComputedVar) && fromComputedVar >= 1) {
      best = Math.max(best, fromComputedVar)
    }
  }

  const inferred = inferPagesFromStackMinHeight(screenplayPageRoot)
  if (inferred != null) best = Math.max(best, inferred)

  if (best >= 2) return best

  /** One body page — no `.page-break-gap__page-number` spans (numerals begin at page 2) */
  if (best === 1) return 1
  if (maxPrinted === 0 && spans.length === 0) return 1
  return inferred ?? (best >= 1 ? best : null)
}
