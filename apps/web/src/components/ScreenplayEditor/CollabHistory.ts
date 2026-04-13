import { Extension } from '@tiptap/core'
import { undoCommand, redoCommand } from 'y-prosemirror'

/**
 * Replaces StarterKit's built-in undo/redo when collaboration is active.
 * Binds Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z to Yjs's UndoManager via
 * y-prosemirror so undo/redo operates on the shared CRDT document.
 */
export const CollabHistory = Extension.create({
  name: 'collabHistory',

  addKeyboardShortcuts() {
    return {
      'Mod-z': () => undoCommand(this.editor.state, this.editor.view.dispatch, this.editor.view),
      'Mod-Shift-z': () => redoCommand(this.editor.state, this.editor.view.dispatch, this.editor.view),
      'Mod-y': () => redoCommand(this.editor.state, this.editor.view.dispatch, this.editor.view),
    }
  },
})
