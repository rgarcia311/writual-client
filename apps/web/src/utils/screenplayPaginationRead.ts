/**
 * Reads the screenplay's page total off the paginated DOM.
 *
 * PageBreakPlugin counts *physical sheets* — the cover/title sheet occupies layout slot 1 like any
 * other page, because `--total-pages` feeds a flat `total * paper-height` min-height formula in
 * Screenplay.css that has no separate term for the cover. Every consumer of this module wants the
 * *body* total instead ("a 112 page script" never counts the title page, and the API documents
 * `screenplay.pageCount` as "body page total, title page excluded"), so the cover sheet is
 * subtracted here rather than at each call site.
 */

import {
  SCREENPLAY_INTER_PAGE_GAP_PX,
  SCREENPLAY_PAPER_HEIGHT_PX,
} from '../components/ScreenplayEditor/screenplayPaperLayout'

const PAGE_GAP_NUM_SELECTOR = '.page-break-gap__page-number'

/** Mirrors `TITLE_PAGE_TYPES` in PageBreakPlugin — the contiguous cover prefix. */
const TITLE_PAGE_ELEMENT_TYPES = new Set(['title', 'author', 'contact'])

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

/**
 * Ordered `data-element-type` values of the document's script blocks, read straight from the DOM
 * (the editor's ProseMirror doc is not reachable from here).
 */
function scriptBlockElementTypes(screenplayPageRoot: HTMLElement): string[] {
  return Array.from(screenplayPageRoot.querySelectorAll<HTMLElement>('.script-block')).map(
    (el) => el.getAttribute('data-element-type') || 'action',
  )
}

/**
 * True when the document opens with a contiguous run of title/author/contact blocks — the same
 * `docStartsWithCoverTitle()` test PageBreakPlugin uses to decide whether sheet 1 is a cover.
 */
export function screenplayDomHasCoverTitlePage(screenplayPageRoot: HTMLElement): boolean {
  let sawCover = false
  for (const type of scriptBlockElementTypes(screenplayPageRoot)) {
    if (TITLE_PAGE_ELEMENT_TYPES.has(type)) {
      sawCover = true
      continue
    }
    break
  }
  return sawCover
}

/** Physical sheets in the paginated stack, cover sheet included. */
export function readScreenplayPaginationSheetTotal(
  screenplayPageRoot: HTMLElement,
): number | null {
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

  if (best >= 1) return best
  if (maxPrinted === 0 && spans.length === 0) return 1
  return inferred
}

/**
 * Body page total — what the toolbar shows and what `writingTracker.currentPageCount` stores.
 *
 * Returns `null` while the answer is not yet knowable: before PageBreakPlugin's first pass the
 * stack is one sheet tall and `--total-pages` is unset, which for a cover-page document would
 * otherwise read as a confident "0 pages" and flash a wrong number into the toolbar.
 */
export function readScreenplayBodyPageCount(screenplayPageRoot: HTMLElement): number | null {
  const sheets = readScreenplayPaginationSheetTotal(screenplayPageRoot)
  if (sheets == null) return null

  const types = scriptBlockElementTypes(screenplayPageRoot)
  if (types.length === 0) return null

  let coverBlocks = 0
  for (const type of types) {
    if (!TITLE_PAGE_ELEMENT_TYPES.has(type)) break
    coverBlocks++
  }
  const hasCover = coverBlocks > 0
  const body = sheets - (hasCover ? 1 : 0)

  if (body >= 1) return body
  /** No body pages: correct only when the document really is nothing but its cover. */
  return coverBlocks === types.length ? 0 : null
}
