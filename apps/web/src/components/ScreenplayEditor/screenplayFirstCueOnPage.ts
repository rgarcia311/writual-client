'use client'

import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { DecorationWithType } from '@tiptap/core'

import { normalizeCharacterCueName } from './ScreenplayExtension'

/**
 * Marks the first character cue for each speaker on each *screenplay page* so the node view can
 * render the character-details button once per page instead of on every cue. Page boundaries come
 * from `PageBreakPlugin`'s widget decorations, so the marks follow repagination automatically.
 */

const FIRST_CUE_SPEC = { screenplayFirstCueOnPage: true }

interface FirstCueState {
  /** Identity of the page-break decoration set the marks were built from. */
  breaks: DecorationSet
  set: DecorationSet
}

const firstCueKey = new PluginKey<FirstCueState>('screenplayFirstCueOnPage')

function buildFirstCueDecorations(doc: PMNode, breaks: DecorationSet): DecorationSet {
  // Every page-break widget starts a new page; mid-block split widgets sit inside a block, so a
  // position compare against each block's start is enough to bucket blocks into pages.
  const breakPositions = breaks
    .find()
    .map((d) => d.from)
    .sort((a, b) => a - b)

  const decorations: Decoration[] = []
  const seenOnPage = new Set<string>()
  let breakIndex = 0

  doc.forEach((node, offset) => {
    while (breakIndex < breakPositions.length && breakPositions[breakIndex] <= offset) {
      breakIndex++
      seenOnPage.clear()
    }
    if (node.type.name !== 'scriptBlock') return
    if (node.attrs.elementType !== 'character') return
    const name = normalizeCharacterCueName(node.textContent ?? '')
    if (!name || seenOnPage.has(name)) return
    seenOnPage.add(name)
    decorations.push(Decoration.node(offset, offset + node.nodeSize, {}, FIRST_CUE_SPEC))
  })

  return DecorationSet.create(doc, decorations)
}

/**
 * `pageBreakKey` is passed in rather than imported so this module stays free of a cycle with
 * `PageBreakPlugin`. The plugin must be registered *after* the page-break plugin so it reads that
 * plugin's already-updated state.
 */
export function firstCueOnPagePlugin(
  pageBreakKey: PluginKey<DecorationSet>,
): Plugin<FirstCueState> {
  const breaksFrom = (state: EditorState): DecorationSet =>
    pageBreakKey.getState(state) ?? DecorationSet.empty

  return new Plugin<FirstCueState>({
    key: firstCueKey,
    state: {
      init: (_config, state) => {
        const breaks = breaksFrom(state)
        return { breaks, set: buildFirstCueDecorations(state.doc, breaks) }
      },
      apply: (tr, value, _oldState, newState) => {
        const breaks = breaksFrom(newState)
        if (!tr.docChanged && breaks === value.breaks) return value
        return { breaks, set: buildFirstCueDecorations(newState.doc, breaks) }
      },
    },
    props: {
      decorations(state) {
        return firstCueKey.getState(state)?.set
      },
    },
  })
}

/** True when this node view's block is the page's first cue for that speaker. */
export function isFirstCueOnPage(decorations: readonly DecorationWithType[]): boolean {
  return decorations.some((d) => d.spec?.screenplayFirstCueOnPage === true)
}
