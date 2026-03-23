import { Node, mergeAttributes } from '@tiptap/core'
import type { Editor } from '@tiptap/core'

// ─── Element Types ────────────────────────────────────────────────────────────

export type ScreenplayElementType =
  | 'action'
  | 'slugline'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'

export const SCREENPLAY_ELEMENT_LABELS: Record<ScreenplayElementType, string> = {
  slugline: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
}

// ─── Keyboard Logic ──────────────────────────────────────────────────────────

/**
 * Tab cycles through these element types in order.
 * Pressing Tab at the last type wraps back to the first.
 */
const TAB_CYCLE: ScreenplayElementType[] = [
  'action',
  'slugline',
  'character',
  'parenthetical',
  'dialogue',
]

/**
 * After pressing Enter, the new block gets this element type.
 *
 *  Character   → Dialogue     (speech follows character cue)
 *  Parenthetical → Dialogue   (wryly) → spoken line
 *  Dialogue    → Action       (speech ends, scene continues)
 *  Slugline    → Action       (heading followed by description)
 *  Action      → Action       (new paragraph of description)
 *  Transition  → Slugline     (FADE TO: → new scene)
 */
const ENTER_NEXT: Record<ScreenplayElementType, ScreenplayElementType> = {
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action',
  slugline: 'action',
  action: 'action',
  transition: 'slugline',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Walk up the ProseMirror node tree from the current cursor position
 * to find the nearest enclosing scriptBlock and return its elementType.
 */
function getActiveElementType(editor: Editor): ScreenplayElementType {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === 'scriptBlock') {
      return (node.attrs.elementType as ScreenplayElementType) ?? 'action'
    }
  }
  return 'action'
}

// ─── Command Types ───────────────────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    scriptBlock: {
      /** Change the screenplay element type of the block at the current cursor. */
      setElementType: (type: ScreenplayElementType) => ReturnType
    }
  }
}

// ─── ScriptBlock Node ────────────────────────────────────────────────────────

export const ScriptBlock = Node.create({
  name: 'scriptBlock',
  group: 'block',
  content: 'inline*',
  /**
   * defining: true ensures that when the node is split or pasted,
   * its attributes are copied to the new node (which we then overwrite
   * with the correct "next" element type).
   */
  defining: true,

  addAttributes() {
    return {
      elementType: {
        default: 'action' as ScreenplayElementType,
        parseHTML: (element) =>
          (element.getAttribute('data-element-type') as ScreenplayElementType) || 'action',
        renderHTML: (attributes) => ({
          'data-element-type': attributes.elementType,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-script-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-script-block': 'true',
        class: 'script-block',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setElementType:
        (type: ScreenplayElementType) =>
        ({ commands }) =>
          commands.updateAttributes('scriptBlock', { elementType: type }),
    }
  },

  addKeyboardShortcuts() {
    return {
      /**
       * Tab → advance to the next element type in the cycle.
       * Returns true to prevent the browser's default focus-shift behaviour.
       */
      Tab: () => {
        const current = getActiveElementType(this.editor)
        const idx = TAB_CYCLE.indexOf(current)
        const next = TAB_CYCLE[idx === -1 ? 0 : (idx + 1) % TAB_CYCLE.length]
        return this.editor.commands.setElementType(next)
      },

      /**
       * Enter → split the block, then set the new block to the correct
       * "next" element type based on the screenplay flow rules above.
       */
      Enter: () => {
        const current = getActiveElementType(this.editor)
        const next = ENTER_NEXT[current]
        return this.editor.chain().splitBlock().setElementType(next).run()
      },
    }
  },
})

// ─── Scene Navigator Utility ─────────────────────────────────────────────────

export interface SluglineEntry {
  /** The raw text of the scene heading (e.g. "INT. OFFICE - DAY") */
  text: string
  /**
   * Zero-based index of this node in the document's top-level content array.
   * Pass back to `navigateToScene()` to scroll the editor to this scene.
   */
  index: number
}

/**
 * Parse a TipTap JSON document and return every slugline node as a
 * `SluglineEntry`. Useful for building a scene-navigator sidebar.
 *
 * @example
 * const doc = editor.getJSON()
 * const scenes = extractSluglines(doc)
 * // → [{ text: "INT. OFFICE - DAY", index: 0 }, ...]
 */
export function extractSluglines(doc: Record<string, unknown>): SluglineEntry[] {
  const result: SluglineEntry[] = []
  const content = (doc?.content as Array<Record<string, unknown>>) ?? []

  content.forEach((node, index) => {
    if (
      node.type === 'scriptBlock' &&
      (node.attrs as Record<string, unknown>)?.elementType === 'slugline'
    ) {
      const inlineNodes = (node.content as Array<Record<string, unknown>>) ?? []
      const text = inlineNodes.map((n) => (n.text as string) ?? '').join('').trim()
      result.push({ text: text || '(Untitled Scene)', index })
    }
  })

  return result
}
