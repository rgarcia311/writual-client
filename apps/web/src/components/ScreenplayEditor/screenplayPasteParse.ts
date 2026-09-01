/**
 * Turns clipboard content copied out of a PDF or another screenwriting app into typed screenplay
 * blocks.
 *
 * External sources carry their formatting as *layout* — each element sits at its own left margin —
 * not as semantic markup, so pasting the raw text into the editor otherwise lands every line in a
 * single Action block. Two signals recover the element types:
 *
 *   1. Indentation, when the source preserved it (PDF text copy, plain-text exports). Screenplay
 *      margins are fixed columns, so the relative indent of a line identifies its element.
 *   2. The text itself (scene-heading prefixes, all-caps cues, parenthesised wrylies), which is the
 *      only signal left when the source flattened every line to column zero (most HTML copies).
 *
 * Pure and DOM-free so it can be unit tested; `screenplayPastePlugin` supplies the lines.
 */

import type { ScreenplayElementType } from './ScreenplayExtension'
import {
  collapseSpaces,
  isCharacterCueText,
  isParentheticalText,
  isSceneHeadingText,
  isTransitionText,
} from './screenplayElementDetection'

/** One source line, with whatever positional information the clipboard flavour could provide. */
export interface PastedLine {
  text: string
  /**
   * Left offset in monospace character columns (10 per inch at Courier 12), or null when the
   * source gave no positional information at all.
   */
  indentChars?: number | null
  /** An element type the source stated outright (a class name or data attribute in pasted HTML). */
  hint?: ScreenplayElementType | null
}

export interface ParsedPasteBlock {
  elementType: ScreenplayElementType
  text: string
}

/**
 * Element left margins in character columns, relative to the action margin.
 * Standard US screenplay layout: dialogue +1.0", parenthetical +1.6", character +2.2",
 * transition +4.0" — at 10 characters per inch.
 */
const COLUMN_OFFSETS: Array<{ type: ScreenplayElementType; column: number }> = [
  { type: 'action', column: 0 },
  { type: 'dialogue', column: 10 },
  { type: 'parenthetical', column: 16 },
  { type: 'character', column: 22 },
  { type: 'transition', column: 40 },
]

/** Below this relative indent spread, the source flattened the layout and only text can classify. */
const MIN_INDENT_SPREAD = 4

/** A tab in copied screenplay text stands in for one element-column step, not a fixed 8 spaces. */
const TAB_WIDTH = 4

/** Page furniture that must not survive the paste as script content. */
const PAGE_NUMBER_RE = /^\d{1,4}\.?$/
const MORE_LINE_RE = /^\(MORE\)$/i
const CONTD_ONLY_RE = /^\(?CONT['’]?D\)?[.:]?$/i
const CONTINUED_MARKER_RE = /^\(?CONTINUED\)?[.:]?$/i
const REVISION_SLUG_RE = /^\(?(?:PAGE\s+)?\d{1,4}\s*[.)]?\s*(?:CONTINUED)?\)?$/i

/** True for lines a page break inserted, which the editor re-derives on its own. */
function isPageArtifact(text: string): boolean {
  const trimmed = collapseSpaces(text)
  if (!trimmed) return false
  return (
    PAGE_NUMBER_RE.test(trimmed) ||
    MORE_LINE_RE.test(trimmed) ||
    CONTD_ONLY_RE.test(trimmed) ||
    CONTINUED_MARKER_RE.test(trimmed) ||
    REVISION_SLUG_RE.test(trimmed)
  )
}

/** Leading-whitespace width of a raw line in character columns. */
export function measureIndent(text: string): number {
  let width = 0
  for (const char of text) {
    if (char === ' ') width += 1
    else if (char === '\t') width += TAB_WIDTH
    else break
  }
  return width
}

/** The element whose column sits nearest this relative indent. */
function columnElementType(relativeIndent: number): ScreenplayElementType {
  let best = COLUMN_OFFSETS[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const band of COLUMN_OFFSETS) {
    const distance = Math.abs(relativeIndent - band.column)
    if (distance < bestDistance) {
      bestDistance = distance
      best = band
    }
  }
  return best.type
}

interface NormalizedLine {
  text: string
  blank: boolean
  relativeIndent: number
  hint: ScreenplayElementType | null
}

/**
 * Drop page furniture, collapse whitespace, and re-base every indent against the shallowest
 * non-blank line (the source's action margin, wherever the copy happened to put it).
 */
function normalizeLines(lines: PastedLine[]): { lines: NormalizedLine[]; hasIndentSignal: boolean } {
  const kept = lines.filter((line) => !isPageArtifact(line.text))

  let baseIndent = Number.POSITIVE_INFINITY
  let maxIndent = 0
  for (const line of kept) {
    if (!collapseSpaces(line.text)) continue
    const indent = line.indentChars ?? measureIndent(line.text)
    baseIndent = Math.min(baseIndent, indent)
    maxIndent = Math.max(maxIndent, indent)
  }
  if (!Number.isFinite(baseIndent)) baseIndent = 0

  const normalized = kept.map((line) => {
    const text = collapseSpaces(line.text)
    const indent = line.indentChars ?? measureIndent(line.text)
    return {
      text,
      blank: text.length === 0,
      relativeIndent: Math.max(0, indent - baseIndent),
      hint: line.hint ?? null,
    }
  })

  return { lines: normalized, hasIndentSignal: maxIndent - baseIndent >= MIN_INDENT_SPREAD }
}

/** The next line that carries text, used to decide whether an all-caps line is a cue. */
function hasSpeechBelow(lines: NormalizedLine[], index: number): boolean {
  const next = lines[index + 1]
  return next != null && !next.blank
}

/**
 * Classify one line using its column, with the text overriding the column wherever the text is the
 * stronger signal — scene headings and parentheticals are unmistakable, and column measurements
 * drift between exporters.
 */
function classifyByColumn(
  line: NormalizedLine,
  speechBelow: boolean,
  previousType: ScreenplayElementType | null,
): ScreenplayElementType {
  const column = columnElementType(line.relativeIndent)
  if (isSceneHeadingText(line.text)) return 'slugline'
  if (isParentheticalText(line.text) && column !== 'action') return 'parenthetical'
  if (isTransitionText(line.text)) return 'transition'
  if (column === 'character' && !isCharacterCueText(line.text, speechBelow)) {
    // Wrapped dialogue occasionally measures into the cue column; a line that cannot be a name
    // continues whatever it followed.
    return previousType === 'character' || previousType === 'dialogue' ? 'dialogue' : 'action'
  }
  return column
}

/**
 * Classify one line with no positional information: element order carries the meaning, the way
 * Fountain reads a flat text file.
 */
function classifyByText(
  line: NormalizedLine,
  speechBelow: boolean,
  previousType: ScreenplayElementType | null,
  separatedFromPrevious: boolean,
): ScreenplayElementType {
  if (isSceneHeadingText(line.text)) return 'slugline'
  if (isTransitionText(line.text)) return 'transition'

  const inSpeech =
    !separatedFromPrevious &&
    (previousType === 'character' || previousType === 'parenthetical' || previousType === 'dialogue')

  if (isParentheticalText(line.text) && inSpeech) return 'parenthetical'
  // A cue can't follow a cue, but it can interrupt a run of dialogue when the source dropped the
  // blank lines between elements as well as the indentation.
  if (previousType !== 'character' && isCharacterCueText(line.text, speechBelow)) return 'character'
  if (inSpeech) return 'dialogue'
  return 'action'
}

/** Element types whose consecutive lines may be a single paragraph the source hard-wrapped. */
const WRAPPABLE: ReadonlySet<ScreenplayElementType> = new Set(['action', 'dialogue', 'parenthetical'])

/** Column an unmistakable line ought to sit at, used to calibrate the paste's left margin. */
function anchorColumnFor(line: NormalizedLine, speechBelow: boolean): number | null {
  if (isSceneHeadingText(line.text)) return 0
  if (isParentheticalText(line.text)) return 16
  if (isCharacterCueText(line.text, speechBelow)) return 22
  return null
}

/**
 * Find how far the paste's columns sit from the standard layout.
 *
 * Indents are re-based against the shallowest line, which is only the action margin if the paste
 * actually contains an action-margin element — a copied run of pure dialogue has its shallowest
 * line one inch in, and reading its columns literally would demote every element by one step. The
 * lines whose *text* pins them to a known column (scene headings, parentheticals, character cues)
 * say how far the whole block is displaced; the median keeps one odd line from skewing it.
 */
function calibrateColumnShift(lines: NormalizedLine[]): number {
  const deltas: number[] = []
  lines.forEach((line, index) => {
    if (line.blank) return
    const anchor = anchorColumnFor(line, hasSpeechBelow(lines, index))
    if (anchor == null) return
    deltas.push(anchor - line.relativeIndent)
  })
  if (deltas.length === 0) return 0
  deltas.sort((a, b) => a - b)
  const median = deltas[Math.floor(deltas.length / 2)]
  return Math.min(22, Math.max(0, median))
}

interface ClassifiedLine {
  elementType: ScreenplayElementType
  text: string
  /** True when a blank line stood between this line and the one before it. */
  separated: boolean
}

/** Assign an element type to every non-blank line, remembering where the blank lines were. */
function classifyLines(lines: NormalizedLine[], hasIndentSignal: boolean): ClassifiedLine[] {
  const shift = hasIndentSignal ? calibrateColumnShift(lines) : 0
  const classified: ClassifiedLine[] = []
  let previousType: ScreenplayElementType | null = null
  let separated = true

  lines.forEach((line, index) => {
    if (line.blank) {
      separated = true
      return
    }
    const speechBelow = hasSpeechBelow(lines, index)
    const shifted: NormalizedLine = { ...line, relativeIndent: line.relativeIndent + shift }
    const elementType =
      line.hint ??
      (hasIndentSignal
        ? classifyByColumn(shifted, speechBelow, previousType)
        : classifyByText(line, speechBelow, previousType, separated))

    classified.push({ elementType, text: line.text, separated })
    previousType = elementType
    separated = false
  })

  return classified
}

/**
 * The width each element type ran to in this paste, i.e. its wrap width: only a line that reached
 * (nearly) the width of its own column can have been broken by wrapping, and the columns are
 * different widths — a full action line is far longer than a full dialogue line.
 */
function wrapWidthByType(lines: ClassifiedLine[]): Map<ScreenplayElementType, number> {
  const widths = new Map<ScreenplayElementType, number>()
  for (const line of lines) {
    widths.set(line.elementType, Math.max(widths.get(line.elementType) ?? 0, line.text.length))
  }
  return widths
}

/** Join a wrapped line onto the previous one, healing a hyphen split across the break. */
function joinWrapped(existing: string, addition: string): string {
  const joinsHyphenatedWord = /[\p{L}\d]-$/u.test(existing) && /^[\p{L}\d]/u.test(addition)
  return joinsHyphenatedWord ? existing + addition : `${existing} ${addition}`
}

/** Minimum wrap width worth trusting: below it, short lines are paragraphs, not wrapped text. */
const MIN_WRAP_WIDTH = 30

/** How far short of the wrap width a line may fall and still count as wrapped. */
const WRAP_TOLERANCE = 12

/** Re-join consecutive lines of one element that the source hard-wrapped into a single paragraph. */
function mergeWrappedLines(lines: ClassifiedLine[]): ParsedPasteBlock[] {
  const widths = wrapWidthByType(lines)
  const blocks: ParsedPasteBlock[] = []
  let previousLineLength = 0
  let previousType: ScreenplayElementType | null = null

  for (const line of lines) {
    const wrapWidth = widths.get(line.elementType) ?? 0
    const last = blocks[blocks.length - 1]
    const continuesWrappedParagraph =
      last != null &&
      !line.separated &&
      line.elementType === previousType &&
      WRAPPABLE.has(line.elementType) &&
      wrapWidth >= MIN_WRAP_WIDTH &&
      previousLineLength >= wrapWidth - WRAP_TOLERANCE

    if (continuesWrappedParagraph && last) {
      last.text = joinWrapped(last.text, line.text)
    } else {
      blocks.push({ elementType: line.elementType, text: line.text })
    }

    previousType = line.elementType
    previousLineLength = line.text.length
  }

  return blocks
}

/**
 * Parse clipboard lines into typed screenplay blocks.
 *
 * Returns an empty array when there is nothing worth pasting as blocks, which the caller treats as
 * "let the editor handle this paste normally".
 */
export function parsePastedScreenplayLines(input: PastedLine[]): ParsedPasteBlock[] {
  const { lines, hasIndentSignal } = normalizeLines(input)
  return mergeWrappedLines(classifyLines(lines, hasIndentSignal))
}

/** Parse a plain-text clipboard payload, taking indentation from the leading whitespace. */
export function parsePastedScreenplayText(raw: string): ParsedPasteBlock[] {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((text) => ({ text }))
  return parsePastedScreenplayLines(lines)
}
