'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/core'
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import NotesIcon from '@mui/icons-material/Notes'
import LocalMoviesIcon from '@mui/icons-material/LocalMovies'
import PersonIcon from '@mui/icons-material/Person'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import FastForwardIcon from '@mui/icons-material/FastForward'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { SCREENPLAY_ELEMENT_LABELS, type ScreenplayElementType } from './ScreenplayExtension'

interface BlockTypeMenuProps {
  editor: Editor | null
  canEdit: boolean
}

/** Body-content element types offered by the picker (title-page-only types are excluded). */
const BLOCK_TYPE_OPTIONS = [
  'action',
  'slugline',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
] as const satisfies readonly ScreenplayElementType[]

const OPTION_ICONS: Record<(typeof BLOCK_TYPE_OPTIONS)[number], React.ReactNode> = {
  action: <NotesIcon fontSize="small" />,
  slugline: <LocalMoviesIcon fontSize="small" />,
  character: <PersonIcon fontSize="small" />,
  parenthetical: <FormatQuoteIcon fontSize="small" />,
  dialogue: <ChatBubbleOutlineIcon fontSize="small" />,
  transition: <FastForwardIcon fontSize="small" />,
}

/**
 * Opened by `ScreenplayExtension`'s Enter handler when the user hits Enter twice in a row,
 * without typing, while left in an empty action block. Anchored to the right of the cursor;
 * picking an option reformats the current (still-empty) line to that element type.
 */
export function BlockTypeMenu({ editor, canEdit }: BlockTypeMenuProps) {
  const anchorPos = useScreenplayEditorStore((s) => s.blockTypeMenuAnchorPos)
  const closeMenu = useScreenplayEditorStore((s) => s.closeBlockTypeMenu)

  const [anchorPosition, setAnchorPosition] = React.useState<{ top: number; left: number } | null>(
    null,
  )

  React.useEffect(() => {
    if (!editor || anchorPos == null) {
      setAnchorPosition(null)
      return
    }
    try {
      const coords = editor.view.coordsAtPos(anchorPos)
      setAnchorPosition({ top: coords.top, left: coords.right + 6 })
    } catch {
      setAnchorPosition(null)
      closeMenu()
    }
  }, [editor, anchorPos, closeMenu])

  if (!editor || !canEdit || anchorPos == null || !anchorPosition) return null

  const handleSelect = (type: ScreenplayElementType) => {
    editor.chain().focus().setElementType(type).run()
    closeMenu()
  }

  const handleClose = () => {
    closeMenu()
    editor.commands.focus()
  }

  return (
    <Menu
      open
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      onClose={handleClose}
      // Deliberately keep DOM focus in the editor (see ScreenplayExtension's Escape/Enter
      // guards) instead of letting the menu grab it via its two independent focus calls
      // (MenuList's own `autoFocus`, and the underlying Modal's FocusTrap `disableAutoFocus`
      // default). Either one alone still fires .focus() without preventScroll, and since it
      // runs before Popper finishes positioning the paper, the browser's default "scroll
      // focused element into view" jumps the page to wherever the unpositioned menu briefly
      // rendered — for this doc, that's up near the title page.
      autoFocus={false}
      disableAutoFocus
      disableEnforceFocus
      MenuListProps={{ dense: true, sx: { minWidth: 200 } }}
    >
      {BLOCK_TYPE_OPTIONS.map((type) => (
        <MenuItem key={type} onClick={() => handleSelect(type)}>
          <ListItemIcon sx={{ minWidth: 32 }}>{OPTION_ICONS[type]}</ListItemIcon>
          <ListItemText>{SCREENPLAY_ELEMENT_LABELS[type]}</ListItemText>
        </MenuItem>
      ))}
    </Menu>
  )
}
