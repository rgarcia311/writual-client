/**
 * Re-formats screenplay content pasted in from outside the editor.
 *
 * Without this, a paste from a PDF or another screenwriting app arrives as unstyled text and lands
 * in Action blocks — the source's element formatting is expressed as layout, which ProseMirror's
 * default paste has no way to read. The plugin classifies the clipboard's lines (see
 * `screenplayPasteParse`) and inserts real, typed `scriptBlock` nodes instead.
 *
 * It deliberately steps aside for:
 *   • copies from this editor (the clipboard HTML already carries `data-script-block` attributes),
 *   • single-line pastes (an inline paste inside a block must not restructure the document),
 *   • pastes that classify as nothing but Action, where the default handler does just as well and
 *     keeps the pasted text's marks.
 */

import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

import { parsePastedHtmlLines } from './screenplayPasteHtml'
import {
  measureIndent,
  parsePastedScreenplayLines,
  type PastedLine,
  type ParsedPasteBlock,
} from './screenplayPasteParse'

export const screenplayPasteKey = new PluginKey('screenplayPaste')

/** Matches the marker our own `scriptBlock` renders, i.e. a copy from inside a Writual script. */
const INTERNAL_COPY_RE = /data-script-block/i

/** Indent spread (character columns) that makes plain text the better-informed clipboard flavour. */
const PLAIN_TEXT_INDENT_SPREAD = 4

/** True when the plain-text flavour preserved the source's element columns. */
function plainTextHasIndentSignal(text: string): boolean {
  let min = Number.POSITIVE_INFINITY
  let max = 0
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const indent = measureIndent(line)
    min = Math.min(min, indent)
    max = Math.max(max, indent)
  }
  if (!Number.isFinite(min)) return false
  return max - min >= PLAIN_TEXT_INDENT_SPREAD
}

/** Pick the clipboard flavour that carries the most formatting information. */
export function selectPasteLines(plainText: string, html: string): PastedLine[] {
  const normalizedText = plainText.replace(/\r\n?/g, '\n')
  if (normalizedText && plainTextHasIndentSignal(normalizedText)) {
    return normalizedText.split('\n').map((text) => ({ text }))
  }
  if (html) {
    const htmlLines = parsePastedHtmlLines(html)
    if (htmlLines.length > 0) return htmlLines
  }
  return normalizedText.split('\n').map((text) => ({ text }))
}

/** True when classification found real screenplay structure, not just a run of prose. */
function isWorthReformatting(blocks: ParsedPasteBlock[]): boolean {
  if (blocks.length < 2) return false
  return blocks.some((block) => block.elementType !== 'action')
}

/** True when the cursor sits inside a `scriptBlock`, the only place these nodes may be inserted. */
function selectionIsInScriptBlock(view: EditorView): boolean {
  const { $from } = view.state.selection
  for (let depth = $from.depth; depth >= 0; depth--) {
    if ($from.node(depth).type.name === 'scriptBlock') return true
  }
  return false
}

export const screenplayPastePlugin = () =>
  new Plugin({
    key: screenplayPasteKey,
    props: {
      handlePaste(view, event) {
        const clipboard = event.clipboardData
        if (!clipboard) return false

        const html = clipboard.getData('text/html') ?? ''
        // A copy from another Writual script already carries its element types — leave it alone.
        if (INTERNAL_COPY_RE.test(html)) return false

        const plainText = clipboard.getData('text/plain') ?? ''
        if (!plainText.trim() && !html) return false
        if (!plainText.includes('\n') && !html) return false
        if (!selectionIsInScriptBlock(view)) return false

        const blocks = parsePastedScreenplayLines(selectPasteLines(plainText, html))
        if (!isWorthReformatting(blocks)) return false

        const scriptBlock = view.state.schema.nodes.scriptBlock
        if (!scriptBlock) return false

        const nodes: PMNode[] = []
        for (const block of blocks) {
          const content = block.text ? view.state.schema.text(block.text) : null
          nodes.push(scriptBlock.create({ elementType: block.elementType }, content))
        }
        if (nodes.length === 0) return false

        const slice = new Slice(Fragment.fromArray(nodes), 0, 0)
        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
        return true
      },
    },
  })
