import { Extension } from '@tiptap/core'
import { yCursorPlugin, defaultSelectionBuilder } from '@tiptap/y-tiptap'
import type { HocuspocusProvider } from '@hocuspocus/provider'

interface CollaborationCursorOptions {
  provider: HocuspocusProvider | null
  user: { name: string | null; color: string | null }
  render?: (user: { name: string; color: string }) => HTMLElement
  selectionRender?: typeof defaultSelectionBuilder
}

/**
 * Collaboration cursor extension that imports yCursorPlugin from
 * @tiptap/y-tiptap (the same package that provides ySyncPlugin to
 * @tiptap/extension-collaboration), ensuring shared PluginKey instances.
 *
 * Replaces @tiptap/extension-collaboration-cursor which still imports
 * from the standalone y-prosemirror package, creating a PluginKey conflict.
 */
export const CollaborationCursor = Extension.create<CollaborationCursorOptions>({
  name: 'collaborationCursor',

  addOptions() {
    return {
      provider: null,
      user: { name: null, color: null },
      render: (user: { name: string; color: string }) => {
        const cursor = document.createElement('span')
        cursor.classList.add('collaboration-cursor__caret')
        cursor.setAttribute('style', `border-color: ${user.color}`)
        const label = document.createElement('div')
        label.classList.add('collaboration-cursor__label')
        label.setAttribute('style', `background-color: ${user.color}`)
        label.insertBefore(document.createTextNode(user.name), null)
        cursor.insertBefore(label, null)
        return cursor
      },
      selectionRender: defaultSelectionBuilder,
    }
  },

  addStorage() {
    return { users: [] as Array<{ clientId: number; [key: string]: unknown }> }
  },

  addProseMirrorPlugins() {
    const provider = this.options.provider
    const awareness = provider?.awareness
    if (!provider || !awareness) return []

    awareness.setLocalStateField('user', this.options.user)

    const awarenessToArray = (states: Map<number, Record<string, unknown>>) =>
      Array.from(states.entries()).map(([key, value]) => ({
        clientId: key,
        ...(value.user as Record<string, unknown>),
      }))

    this.storage.users = awarenessToArray(awareness.states)

    awareness.on('update', () => {
      this.storage.users = awarenessToArray(awareness.states)
    })

    return [
      yCursorPlugin(awareness, {
        cursorBuilder: this.options.render,
        selectionBuilder: this.options.selectionRender,
      }),
    ]
  },
})
