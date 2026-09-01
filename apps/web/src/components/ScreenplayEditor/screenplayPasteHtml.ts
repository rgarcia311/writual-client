/**
 * Reads clipboard HTML (Final Draft, WriterDuet, Highland, Google Docs, a PDF viewer's rich copy)
 * into the flat line list `screenplayPasteParse` classifies.
 *
 * Two things are worth recovering from the markup that plain text loses: an explicit element name
 * in a class or data attribute, and the left margin the source drew the element at.
 */

import type { ScreenplayElementType } from './ScreenplayExtension'
import type { PastedLine } from './screenplayPasteParse'

/** Class / attribute tokens screenwriting apps use, mapped to our element types. */
const CLASS_HINTS: Record<string, ScreenplayElementType> = {
  action: 'action',
  general: 'action',
  description: 'action',
  scriptnote: 'action',
  sceneheading: 'slugline',
  'scene-heading': 'slugline',
  scene_heading: 'slugline',
  slugline: 'slugline',
  slug: 'slugline',
  heading: 'slugline',
  character: 'character',
  'character-cue': 'character',
  cue: 'character',
  speaker: 'character',
  parenthetical: 'parenthetical',
  paren: 'parenthetical',
  wryly: 'parenthetical',
  dialogue: 'dialogue',
  dialog: 'dialogue',
  speech: 'dialogue',
  transition: 'transition',
}

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'PRE',
  'TD',
  'TH',
  'SECTION',
  'ARTICLE',
])

/** Characters per inch in the fixed-pitch layout screenplay margins are measured in. */
const CHARS_PER_INCH = 10

/** Convert a CSS length to character columns; unknown or unparseable units contribute nothing. */
function cssLengthToChars(value: string): number {
  const match = /^(-?[\d.]+)\s*(in|pt|px|cm|mm|em|rem)?$/.exec(value.trim())
  if (!match) return 0
  const amount = Number.parseFloat(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return 0
  switch (match[2]) {
    case 'in':
      return amount * CHARS_PER_INCH
    case 'pt':
      return (amount / 72) * CHARS_PER_INCH
    case 'px':
      return (amount / 96) * CHARS_PER_INCH
    case 'cm':
      return (amount / 2.54) * CHARS_PER_INCH
    case 'mm':
      return (amount / 25.4) * CHARS_PER_INCH
    // A monospace character is ~0.6em wide, so an em of margin is ~1.67 columns.
    case 'em':
    case 'rem':
      return amount / 0.6
    default:
      return 0
  }
}

/**
 * Left offset an element states inline, in character columns. `left` is included because PDF
 * viewers copy each line as an absolutely positioned box, where the whole layout lives in `left`.
 */
function indentOf(element: HTMLElement): number {
  const style = element.style
  const stated =
    cssLengthToChars(style.marginLeft || '') +
    cssLengthToChars(style.paddingLeft || '') +
    cssLengthToChars(style.textIndent || '') +
    cssLengthToChars(style.left || '')
  return Math.round(stated)
}

/** An element type the source named outright, via `data-element-type` or a known class token. */
function hintOf(element: HTMLElement): ScreenplayElementType | null {
  const attr = element.getAttribute('data-element-type')
  if (attr && attr in CLASS_HINTS) return CLASS_HINTS[attr]
  if (attr && Object.values(CLASS_HINTS).includes(attr as ScreenplayElementType)) {
    return attr as ScreenplayElementType
  }
  for (const token of Array.from(element.classList)) {
    const hint = CLASS_HINTS[token.toLowerCase()]
    if (hint) return hint
  }
  return null
}

/** True when the element has no block-level descendant, i.e. it is one visual line's container. */
function isLeafBlock(element: HTMLElement): boolean {
  for (const child of Array.from(element.children)) {
    if (BLOCK_TAGS.has(child.tagName)) return false
  }
  return true
}

/** Split a leaf block's text on its `<br>`s, which stand for line breaks inside one element. */
function leafLines(element: HTMLElement): string[] {
  const html = element.innerHTML.replace(/<br\s*\/?>/gi, '\n')
  const scratch = element.ownerDocument.createElement('div')
  scratch.innerHTML = html
  return (scratch.textContent ?? '').split('\n')
}

/**
 * Flatten pasted HTML into lines, inheriting indent and element hints from the nearest ancestor
 * that stated them.
 */
export function parsePastedHtmlLines(html: string): PastedLine[] {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const lines: PastedLine[] = []

  const walk = (element: HTMLElement, inheritedIndent: number, inheritedHint: ScreenplayElementType | null) => {
    const indent = inheritedIndent + indentOf(element)
    const hint = hintOf(element) ?? inheritedHint

    if (BLOCK_TAGS.has(element.tagName) && isLeafBlock(element)) {
      for (const text of leafLines(element)) {
        lines.push({ text, indentChars: indent, hint })
      }
      return
    }

    // Mixed content: inline text and nested blocks side by side. Inline runs become their own line
    // so bare text between blocks (and text a `<br>` splits) is not dropped.
    let pending = ''
    const flush = () => {
      if (pending.trim()) lines.push({ text: pending, indentChars: indent, hint })
      pending = ''
    }
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        pending += child.textContent ?? ''
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const childElement = child as HTMLElement
      if (childElement.tagName === 'BR') {
        flush()
        continue
      }
      if (BLOCK_TAGS.has(childElement.tagName)) {
        flush()
        walk(childElement, indent, hint)
        continue
      }
      pending += childElement.textContent ?? ''
    }
    flush()
  }

  walk(doc.body, 0, null)

  // A document with no block markup at all (a bare run of spans) still has its text worth reading.
  if (lines.length === 0) {
    const text = doc.body.textContent ?? ''
    return text.split('\n').map((line) => ({ text: line, indentChars: null, hint: null }))
  }
  return lines
}
