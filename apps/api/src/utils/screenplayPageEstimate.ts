/**
 * Body page-count estimate for a stored screenplay (TipTap JSON), used when
 * `screenplay.pageCount` has not been recorded yet (documents saved before that field existed).
 *
 * The editor's real pagination (`PageBreakPlugin`) measures rendered DOM boxes, which isn't
 * available server-side, so this reproduces the same geometry analytically:
 *
 * - 12pt Courier at 10 CPI on US Letter with WGA margins ⇒ a 6.0" (60 char) text area and a
 *   54-line content band per page (864px ÷ 16px line height — see `screenplayPaperLayout.ts`).
 * - Per-element column widths mirror `Screenplay.css` (dialogue 344px ≈ 35 chars,
 *   parenthetical 192px ≈ 20 chars), unless the document carries an imported-PDF layout config
 *   (`screenplay.layout`), which the editor applies as inline CSS custom properties on the page and
 *   which therefore governs how those columns really wrap — see `charsPerLineFor`.
 * - Inter-block blank lines mirror `getScreenplayInterBlockGapInches()` in
 *   `apps/web/src/components/ScreenplayEditor/screenplaySpacing.ts`.
 *
 * Widow/orphan control and mid-block splits are not modelled: those shift content between pages
 * without changing the total by more than a page or so on a feature-length script. Treat the
 * result as an estimate the user can correct, not as authoritative pagination.
 */

/** 864px content band ÷ 16px line height (see `SCREENPLAY_CONTENT_HEIGHT_PX`). */
const LINES_PER_PAGE = 54;

/** Courier 10 CPI character capacity per element column. */
const CHARS_PER_LINE: Record<string, number> = {
  action: 60,
  slugline: 60,
  transition: 60,
  character: 35,
  dialogue: 35,
  parenthetical: 20,
};
const DEFAULT_CHARS_PER_LINE = 60;

/** 12pt Courier at 10 CPI ⇒ 9.6px @96dpi (mirrors `CHAR_WIDTH_PX` in `screenplayLayout.ts`). */
const CHAR_WIDTH_PX = 9.6;

/**
 * Per-document column overrides measured from an imported PDF (`screenplay.layout`), the same shape
 * `apps/web/src/lib/screenplayLayout.ts` writes and applies to `.screenplay-page` at render time.
 * Only the fields that change wrapping are read here; indents shift a column without resizing it.
 */
export interface ScreenplayLayoutConfigInput {
  dialogueTextWidthPx?: number | null;
  parentheticalTextWidthPx?: number | null;
}

/** Column width clamps — must match `clampLayoutConfig` in `apps/web/src/lib/screenplayLayout.ts`. */
const WIDTH_CLAMPS: Record<string, { min: number; max: number }> = {
  dialogue: { min: 240, max: 432 },
  parenthetical: { min: 96, max: 288 },
};

/**
 * Characters that fit on one line of `elementType`, honouring a stored layout config.
 *
 * The editor renders an imported document at its measured column widths, so an estimate computed
 * from the WGA defaults describes a page the user is not looking at: a dialogue column measured 14px
 * narrow holds 34 characters rather than 35, re-wraps every full-width line, and lands a whole page
 * away from what the editor paginates. Reading the same config the editor reads keeps the two in step.
 */
function charsPerLineFor(
  elementType: string,
  layout: ScreenplayLayoutConfigInput | null | undefined
): number {
  const fallback = CHARS_PER_LINE[elementType] ?? DEFAULT_CHARS_PER_LINE;
  const clamp = WIDTH_CLAMPS[elementType];
  if (!layout || !clamp) return fallback;

  const raw =
    elementType === "dialogue"
      ? layout.dialogueTextWidthPx
      : layout.parentheticalTextWidthPx;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;

  const width = Math.min(clamp.max, Math.max(clamp.min, Math.round(raw)));
  // `floor`: a partially-fitting character does not render, matching how the browser wraps.
  return Math.max(1, Math.floor(width / CHAR_WIDTH_PX));
}

/** Cover-sheet element types; the leading run of these is not part of the body page total. */
const TITLE_PAGE_TYPES = new Set(["title", "author", "contact"]);

/** Types whose CSS `padding-bottom` is 0 — nothing following them gets a trailing blank line. */
const ZERO_BOTTOM_PAD_TYPES = new Set(["character", "parenthetical"]);

/** `next` type → `prev` types that add a `padding-top` blank line (mirrors `Screenplay.css`). */
const TOP_PAD_OVERRIDE_PREVS: Record<string, Set<string>> = {
  slugline: new Set(["character", "parenthetical", "action", "dialogue", "transition"]),
  transition: new Set(["character", "parenthetical"]),
};

interface ScriptBlock {
  elementType: string;
  text: string;
}

function textFromBlock(block: Record<string, unknown>): string {
  const content = block.content;
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const node of content) {
    if (
      node !== null &&
      typeof node === "object" &&
      !Array.isArray(node) &&
      (node as { type?: unknown }).type === "text" &&
      typeof (node as { text?: unknown }).text === "string"
    ) {
      out += (node as { text: string }).text;
    }
  }
  return out;
}

function scriptBlocks(doc: unknown): ScriptBlock[] {
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return [];
  const content = (doc as { content?: unknown }).content;
  if (!Array.isArray(content)) return [];

  const out: ScriptBlock[] = [];
  for (const block of content) {
    if (block === null || typeof block !== "object" || Array.isArray(block)) continue;
    const b = block as Record<string, unknown>;
    if (b.type !== "scriptBlock") continue;
    const attrs = b.attrs as { elementType?: unknown } | undefined;
    const elementType =
      typeof attrs?.elementType === "string" && attrs.elementType.length > 0
        ? attrs.elementType
        : "action";
    out.push({ elementType, text: textFromBlock(b) });
  }
  return out;
}

/** Drops the leading contiguous run of cover-sheet blocks (the title page carries no body pages). */
function dropCoverTitle(blocks: ScriptBlock[]): ScriptBlock[] {
  let i = 0;
  while (i < blocks.length && TITLE_PAGE_TYPES.has(blocks[i]!.elementType)) i++;
  return i > 0 ? blocks.slice(i) : blocks;
}

/** Greedy word wrap line count, matching how the browser wraps a ragged-right column. */
function wrappedLineCount(text: string, charsPerLine: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let used = 0;
  for (const word of words) {
    // A word longer than the column breaks across lines on its own.
    const wordLines = Math.ceil(word.length / charsPerLine);
    if (used === 0) {
      lines += wordLines - 1;
      used = word.length - (wordLines - 1) * charsPerLine;
      continue;
    }
    if (used + 1 + word.length <= charsPerLine) {
      used += 1 + word.length;
      continue;
    }
    lines += wordLines;
    used = word.length - (wordLines - 1) * charsPerLine;
  }
  return lines;
}

/** Blank lines rendered between two consecutive blocks (mirrors `screenplaySpacing.ts`). */
function interBlockBlankLines(prev: string | null, next: string): number {
  if (prev == null) return 0;
  const prevBottom = ZERO_BOTTOM_PAD_TYPES.has(prev) ? 0 : 1;
  const topOverride = TOP_PAD_OVERRIDE_PREVS[next]?.has(prev) ? 1 : 0;
  return prevBottom + topOverride;
}

/**
 * Estimated body page total for screenplay TipTap JSON, or null when the document has no script
 * content (so callers can distinguish "no screenplay yet" from "one page").
 */
export const estimateScreenplayPageCount = (
  doc: unknown,
  layout?: ScreenplayLayoutConfigInput | null
): number | null => {
  const blocks = dropCoverTitle(scriptBlocks(doc));
  if (blocks.length === 0) return null;

  const hasText = blocks.some((b) => b.text.trim().length > 0);
  if (!hasText) return null;

  let lines = 0;
  let prev: string | null = null;
  for (const block of blocks) {
    lines += interBlockBlankLines(prev, block.elementType);
    lines += wrappedLineCount(block.text, charsPerLineFor(block.elementType, layout));
    prev = block.elementType;
  }

  return Math.max(1, Math.ceil(lines / LINES_PER_PAGE));
};

/** Picks the stored page count, falling back to an estimate from `versions[0].content`. */
export const resolveScreenplayPageCount = (screenplay: {
  pageCount?: number | null;
  layout?: ScreenplayLayoutConfigInput | null;
  versions?: Array<{ content?: unknown }> | null;
} | null | undefined): number | null => {
  if (!screenplay) return null;

  const stored = screenplay.pageCount;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return Math.round(stored);
  }

  const content = screenplay.versions?.[0]?.content ?? null;
  return estimateScreenplayPageCount(content, screenplay.layout ?? null);
};
