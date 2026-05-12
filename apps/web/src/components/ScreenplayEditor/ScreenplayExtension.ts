'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'
import { useUserProfileStore } from '@/state/user'
import { TIER_RANK } from '@/types/tier'
import { ScriptBlockNodeView } from './ScriptBlockNodeView'

// ─── Element Types ────────────────────────────────────────────────────────────

export type ScreenplayElementType =
  | 'action'
  | 'slugline'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'title'
  | 'author'
  | 'contact'

export const SCREENPLAY_ELEMENT_LABELS: Record<ScreenplayElementType, string> = {
  slugline: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  title: 'Title',
  author: 'Author',
  contact: 'Contact Info',
}

// ─── Block Versioning Types ───────────────────────────────────────────────────

export interface BlockVersion {
  id: string
  type: string
  content: unknown[]
  timestamp: number
  authorId: string
  label?: string
  isOriginal?: boolean
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
  title: 'author',
  author: 'contact',
  contact: 'action',
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

function extractTextFromContent(content: unknown[]): string {
  return (content as Array<{ text?: string }>).map((n) => n.text ?? '').join('').trim()
}

// ─── Command Types ───────────────────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    scriptBlock: {
      /** Change the screenplay element type of the block at the current cursor. */
      setElementType: (type: ScreenplayElementType) => ReturnType
      /** Branch the current block into a new empty alternative. */
      createBlockVersion: (authorId: string) => ReturnType
      /** Swap the active version's content into the live editor. */
      promoteVersion: (nodePos: number, versionId: string) => ReturnType
      /** Remove a non-original version from a block. */
      deleteBlockVersion: (nodePos: number, versionId: string) => ReturnType
      /** Save-back live content, self-heal, and prune empty alts on blur. */
      syncAndCleanMetadata: (nodePos: number) => ReturnType
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
      versions: {
        default: [],
        keepOnSplit: false,
        parseHTML: (element) => {
          try {
            return JSON.parse(element.getAttribute('data-versions') ?? '[]')
          } catch {
            return []
          }
        },
        renderHTML: (attributes) => ({
          'data-versions': JSON.stringify(attributes.versions),
        }),
      },
      activeVersionId: {
        default: null,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-active-version-id') || null,
        renderHTML: (attributes) => ({
          'data-active-version-id': attributes.activeVersionId ?? '',
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

      createBlockVersion:
        (authorId: string) =>
        ({ state, dispatch, editor }) => {
          const { userProfile } = useUserProfileStore.getState()
          if (TIER_RANK[userProfile?.tier ?? 'spec'] < TIER_RANK['indie']) return false

          const tier = userProfile?.tier ?? 'spec'
          const MAX_ALTS = tier === 'greenlit' || tier === 'beta-access' ? 10 : 5

          const { $from } = state.selection
          type BlockFound = { nodePos: number; node: ReturnType<typeof $from.node> }
          let found: BlockFound | null = null
          for (let d = $from.depth; d >= 0; d--) {
            if ($from.node(d).type.name === 'scriptBlock') {
              found = { nodePos: $from.before(d), node: $from.node(d) }
              break
            }
          }
          if (!found) return false
          const { nodePos, node } = found

          const rawContent = node.content.toJSON() as Record<string, unknown>[] | null
          const content: unknown[] = rawContent ?? []

          // Version cap guard (Original excluded from count)
          if ((node.attrs.versions.length - 1) >= MAX_ALTS) return false

          // Empty block guard
          if (content.length === 0 || extractTextFromContent(content) === '') return false

          // Pre-branch save-back (subsequent branches only)
          let savedBackVersions: BlockVersion[] = node.attrs.versions
          if (node.attrs.activeVersionId && node.attrs.versions.length > 0) {
            const currentVersion = savedBackVersions.find(
              (v: BlockVersion) => v.id === node.attrs.activeVersionId,
            )
            if (currentVersion && JSON.stringify(content) !== JSON.stringify(currentVersion.content)) {
              savedBackVersions = savedBackVersions.map((v: BlockVersion) =>
                v.id === node.attrs.activeVersionId
                  ? { ...v, content, timestamp: Date.now(), authorId }
                  : v,
              )
            }
          }

          // Duplicate content check (subsequent branches only) — abort immediately if duplicate
          if (node.attrs.versions.length > 0) {
            const isDuplicate = savedBackVersions.some(
              (v: BlockVersion) => JSON.stringify(v.content) === JSON.stringify(content),
            )
            if (isDuplicate) return false
          }

          // Build version entries
          let newVersions: BlockVersion[]
          let nextActiveId: string

          if (node.attrs.versions.length === 0) {
            const originalVersion: BlockVersion = {
              id: crypto.randomUUID(),
              isOriginal: true,
              label: 'Original',
              type: node.attrs.elementType,
              content,
              timestamp: Date.now(),
              authorId: 'initial',
            }
            const newAlt: BlockVersion = {
              id: crypto.randomUUID(),
              isOriginal: false,
              type: node.attrs.elementType,
              content: [],
              timestamp: Date.now(),
              authorId,
            }
            newVersions = [originalVersion, newAlt]
            nextActiveId = newAlt.id
          } else {
            const newAlt: BlockVersion = {
              id: crypto.randomUUID(),
              isOriginal: false,
              type: node.attrs.elementType,
              content,
              timestamp: Date.now(),
              authorId,
            }
            newVersions = [...savedBackVersions, newAlt]
            nextActiveId = newAlt.id
          }

          if (dispatch) {
            const tr = state.tr
            tr.setNodeMarkup(nodePos, undefined, {
              ...node.attrs,
              versions: newVersions,
              activeVersionId: nextActiveId,
            })
            tr.delete(nodePos + 1, nodePos + node.nodeSize - 1)
            tr.setSelection(TextSelection.create(tr.doc, nodePos + 1))
            dispatch(tr)
          }

          editor.commands.focus()
          return true
        },

      promoteVersion:
        (nodePos: number, versionId: string) =>
        ({ state, dispatch }) => {
          const { userProfile } = useUserProfileStore.getState()
          if (TIER_RANK[userProfile?.tier ?? 'spec'] < TIER_RANK['indie']) return false

          const node = state.doc.nodeAt(nodePos)
          if (!node) return false

          const targetVersion = (node.attrs.versions as BlockVersion[]).find(
            (v) => v.id === versionId,
          )
          if (!targetVersion) return false

          // Save-back (always runs — activeVersionId guaranteed set on versioned blocks)
          let updatedVersions: BlockVersion[] = node.attrs.versions
          const currentVersion = updatedVersions.find(
            (v: BlockVersion) => v.id === node.attrs.activeVersionId,
          )
          if (currentVersion) {
            const liveContent = (node.content.toJSON() as Record<string, unknown>[] | null) ?? []
            if (JSON.stringify(liveContent) !== JSON.stringify(currentVersion.content)) {
              const currentUserId = useUserProfileStore.getState().userProfile?.user ?? 'unknown'
              updatedVersions = updatedVersions.map((v: BlockVersion) =>
                v.id === node.attrs.activeVersionId
                  ? { ...v, content: liveContent, timestamp: Date.now(), authorId: currentUserId }
                  : v,
              )
            }
          }

          try {
            const restoredNode = state.schema.nodeFromJSON({
              type: 'scriptBlock',
              attrs: {
                ...node.attrs,
                versions: updatedVersions,
                activeVersionId: versionId,
                elementType: targetVersion.type,
              },
              content: targetVersion.content,
            })
            if (dispatch) {
              const tr = state.tr
              tr.replaceWith(nodePos, nodePos + node.nodeSize, restoredNode)
              tr.setSelection(TextSelection.create(tr.doc, nodePos + 1))
              dispatch(tr)
            }
          } catch {
            if (dispatch) {
              const tr = state.tr
              tr.setNodeMarkup(nodePos, undefined, {
                ...node.attrs,
                versions: updatedVersions,
                activeVersionId: versionId,
                elementType: targetVersion.type,
              })
              dispatch(tr)
            }
          }

          return true
        },

      deleteBlockVersion:
        (nodePos: number, versionId: string) =>
        ({ state, dispatch }) => {
          const { userProfile } = useUserProfileStore.getState()
          if (TIER_RANK[userProfile?.tier ?? 'spec'] < TIER_RANK['indie']) return false
          if (!state.doc.nodeAt(nodePos)) return false

          const node = state.doc.nodeAt(nodePos)!
          const targetVersion = (node.attrs.versions as BlockVersion[]).find(
            (v) => v.id === versionId,
          )
          if (!targetVersion) return false
          if (targetVersion.isOriginal) return false

          // Pre-compute final state before any transaction
          const filteredVersions: BlockVersion[] = (node.attrs.versions as BlockVersion[]).filter(
            (v) => v.id !== versionId,
          )

          // Pristine Reset check BEFORE queuing any transaction
          let finalVersions: BlockVersion[]
          let finalActiveId: string | null

          if (filteredVersions.length === 1 && filteredVersions[0].isOriginal === true) {
            finalVersions = []
            finalActiveId = null
          } else if (node.attrs.activeVersionId === versionId) {
            finalActiveId = filteredVersions.find((v) => v.isOriginal)?.id ?? null
            finalVersions = filteredVersions
          } else {
            finalActiveId = node.attrs.activeVersionId
            finalVersions = filteredVersions
          }

          const originalVersion = filteredVersions.find((v) => v.isOriginal)

          // Single transaction — branch on active/non-active, NOT on Pristine Reset
          if (dispatch) {
            const tr = state.tr
            if (node.attrs.activeVersionId === versionId) {
              const restoredNode = state.schema.nodeFromJSON({
                type: 'scriptBlock',
                attrs: {
                  ...node.attrs,
                  versions: finalVersions,
                  activeVersionId: finalActiveId,
                  elementType: originalVersion?.type ?? node.attrs.elementType,
                },
                content: originalVersion?.content ?? [],
              })
              tr.replaceWith(nodePos, nodePos + node.nodeSize, restoredNode)
            } else {
              tr.setNodeMarkup(nodePos, undefined, {
                ...node.attrs,
                versions: finalVersions,
                activeVersionId: finalActiveId,
              })
            }
            dispatch(tr)
          }

          return true
        },

      syncAndCleanMetadata:
        (nodePos: number) =>
        ({ state, dispatch }) => {
          const { userProfile } = useUserProfileStore.getState()
          if (!state.doc.nodeAt(nodePos)) return false

          const node = state.doc.nodeAt(nodePos)!
          const currentUserId = userProfile?.user ?? 'unknown'

          // Step 1: Universal save-back (ALL tiers)
          let updatedVersions: BlockVersion[] = node.attrs.versions
          if (node.attrs.activeVersionId && node.attrs.versions.length > 0) {
            const currentVersion = updatedVersions.find(
              (v: BlockVersion) => v.id === node.attrs.activeVersionId,
            )
            if (currentVersion) {
              const liveContent =
                (node.content.toJSON() as Record<string, unknown>[] | null) ?? []
              if (JSON.stringify(liveContent) !== JSON.stringify(currentVersion.content)) {
                updatedVersions = updatedVersions.map((v: BlockVersion) =>
                  v.id === node.attrs.activeVersionId
                    ? { ...v, content: liveContent, timestamp: Date.now(), authorId: currentUserId }
                    : v,
                )
              }
            }
          }

          // Step 2: Indie-tier gate — dispatch save-back-only and return false for Spec
          if (TIER_RANK[userProfile?.tier ?? 'spec'] < TIER_RANK['indie']) {
            if (dispatch && updatedVersions !== node.attrs.versions) {
              const tr = state.tr
              tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, versions: updatedVersions })
              dispatch(tr)
            }
            return false
          }

          // Step 3: Self-healing check (Indie+)
          let selfHealingTriggered = false
          let nextActiveId: string | null = node.attrs.activeVersionId
          const originalVersion = updatedVersions.find((v: BlockVersion) => v.isOriginal)
          const activeEntry = updatedVersions.find(
            (v: BlockVersion) => v.id === nextActiveId,
          )

          if (activeEntry && !activeEntry.isOriginal) {
            if (extractTextFromContent(activeEntry.content as unknown[]) === '') {
              selfHealingTriggered = true
              nextActiveId = originalVersion?.id ?? null
            }
          }

          // Step 4: Purge empty drafts (Indie+)
          const prunedVersions = updatedVersions.filter((v: BlockVersion) => {
            if (v.isOriginal) return true
            return extractTextFromContent(v.content as unknown[]) !== ''
          })

          // Step 5: Pristine Reset check BEFORE dispatching
          let finalVersions: BlockVersion[]
          let finalActiveId: string | null

          if (prunedVersions.length === 1 && prunedVersions[0].isOriginal === true) {
            finalVersions = []
            finalActiveId = null
          } else {
            finalVersions = prunedVersions
            finalActiveId = nextActiveId
          }

          // Step 6: Single atomic dispatch
          if (dispatch) {
            const tr = state.tr
            if (selfHealingTriggered && originalVersion) {
              const restoredNode = state.schema.nodeFromJSON({
                type: 'scriptBlock',
                attrs: {
                  ...node.attrs,
                  versions: finalVersions,
                  activeVersionId: finalActiveId,
                  elementType: originalVersion.type,
                },
                content: originalVersion.content,
              })
              tr.replaceWith(nodePos, nodePos + node.nodeSize, restoredNode)
            } else {
              tr.setNodeMarkup(nodePos, undefined, {
                ...node.attrs,
                versions: finalVersions,
                activeVersionId: finalActiveId,
              })
            }
            dispatch(tr)
          }

          return true
        },
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

      /**
       * Mod-Shift-S → create a new alt for the current block (Indie+ only).
       * Always returns true inside a scriptBlock to swallow the keystroke and
       * prevent "Save Page As" even when the command rejects (cap, Spec tier).
       */
      'Mod-Shift-S': () => {
        if (!this.editor.isEditable) return false
        const { userProfile } = useUserProfileStore.getState()
        if (!userProfile) return false
        const { $from } = this.editor.state.selection
        let insideBlock = false
        for (let d = $from.depth; d >= 0; d--) {
          if ($from.node(d).type.name === 'scriptBlock') {
            insideBlock = true
            break
          }
        }
        if (!insideBlock) return false
        this.editor.commands.createBlockVersion(userProfile.user)
        return true
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScriptBlockNodeView)
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
