'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/core'
import type { ResolvedPos } from 'prosemirror-model'
import { Box, Button, Chip, Paper, Popper, Tooltip } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useUserProfileStore } from '@/state/user'
import { TIER_RANK } from '@/types/tier'
import type { BlockVersion } from './ScreenplayExtension'

interface BlockAltsToolbarProps {
  editor: Editor | null
  canEdit: boolean
  userId: string | undefined
}

function findEnclosingBlock(
  $pos: ResolvedPos,
): { node: ReturnType<ResolvedPos['node']>; versions: BlockVersion[] } | null {
  for (let d = $pos.depth; d >= 0; d--) {
    const n = $pos.node(d)
    if (n.type.name === 'scriptBlock') {
      return { node: n, versions: n.attrs.versions ?? [] }
    }
  }
  return null
}

export function BlockAltsToolbar({ editor, canEdit, userId }: BlockAltsToolbarProps) {
  const userTier = useUserProfileStore((s) => s.userProfile?.tier ?? 'spec')
  const belowIndie = TIER_RANK[userTier] < TIER_RANK['indie']
  const MAX_ALTS = userTier === 'greenlit' || userTier === 'beta-access' ? 10 : 5

  // Virtual anchor element for the Popper — updated on every selection change
  const [anchorEl, setAnchorEl] = React.useState<{
    getBoundingClientRect: () => DOMRect
  } | null>(null)
  const [visible, setVisible] = React.useState(false)
  const [selectionState, setSelectionState] = React.useState<{
    versions: BlockVersion[]
    node: ReturnType<ResolvedPos['node']> | null
  }>({ versions: [], node: null })

  React.useEffect(() => {
    if (!editor || !canEdit) return

    const sync = () => {
      const { $from, $to, empty } = editor.state.selection

      if (empty) {
        setVisible(false)
        setAnchorEl(null)
        return
      }

      const fromResult = findEnclosingBlock($from)
      if (!fromResult) { setVisible(false); setAnchorEl(null); return }

      const toResult = findEnclosingBlock($to)
      if (!toResult || toResult.node !== fromResult.node) {
        setVisible(false)
        setAnchorEl(null)
        return
      }

      // Build a virtual element from the selection's bounding rect
      try {
        const start = editor.view.coordsAtPos($from.pos)
        const end = editor.view.coordsAtPos($to.pos)
        const top = Math.min(start.top, end.top)
        const left = Math.min(start.left, end.left)
        const right = Math.max(start.right, end.right)
        const bottom = Math.max(start.bottom, end.bottom)

        setAnchorEl({
          getBoundingClientRect: () =>
            DOMRect.fromRect({ x: left, y: top, width: right - left, height: bottom - top }),
        })
        setSelectionState({ versions: fromResult.versions, node: fromResult.node })
        setVisible(true)
      } catch {
        setVisible(false)
        setAnchorEl(null)
      }
    }

    editor.on('selectionUpdate', sync)
    editor.on('update', sync)
    sync()

    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('update', sync)
    }
  }, [editor, canEdit])

  if (!canEdit || !editor) return null
  if (!visible || !anchorEl) return null

  const { versions, node } = selectionState
  const atCap = (versions.length - 1) >= MAX_ALTS
  const blockEmpty = (() => {
    if (!node) return true
    const raw = node.content.toJSON() as Array<{ text?: string }> | null
    return (raw ?? []).map((n) => n.text ?? '').join('').trim() === ''
  })()

  const isDisabled = !userId || belowIndie || atCap || blockEmpty

  let tooltipText = ''
  if (belowIndie) tooltipText = 'Upgrade to Indie to use Alts.'
  else if (atCap) tooltipText = 'Maximum alts reached for your tier.'
  else if (blockEmpty) tooltipText = 'Add content to create an alt.'

  const altCount = versions.length > 1 ? versions.length - 1 : 0

  return (
    <Popper
      open
      anchorEl={anchorEl as any}
      placement="top-start"
      modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      sx={{ zIndex: 'tooltip' }}
    >
      <Paper elevation={3} sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper' }}>
        <Tooltip title={tooltipText} disableHoverListener={!isDisabled}>
          <span>
            <Button
              size="small"
              startIcon={<ContentCopyIcon />}
              disabled={isDisabled}
              onClick={() => userId && editor.commands.createBlockVersion(userId)}
            >
              Create Alt
            </Button>
          </span>
        </Tooltip>
        {altCount > 0 && (
          <Chip
            label={`${altCount}/${MAX_ALTS} alts`}
            size="small"
            variant="outlined"
          />
        )}
      </Paper>
    </Popper>
  )
}
