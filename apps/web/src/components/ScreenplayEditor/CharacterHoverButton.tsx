'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import PersonIcon from '@mui/icons-material/Person'
import type { Node as PMNode } from '@tiptap/pm/model'
import {
  useScreenplayCharacterLookupStore,
  normalizeCharacterCueText,
} from '@/state/screenplayCharacterLookup'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { useScreenplayCharacterPanesStore } from '@/state/screenplayCharacterPanes'

const GLASS_MOSS = '#2D8060'

interface CharacterHoverButtonProps {
  node: PMNode
}

export function CharacterHoverButton({ node }: CharacterHoverButtonProps) {
  const visible = useScreenplayEditorStore((s) => s.characterDetailButtonsVisible)
  const openPane = useScreenplayCharacterPanesStore((s) => s.openPane)

  const cueText = node.textContent.trim()
  const character = useScreenplayCharacterLookupStore((s) =>
    cueText ? s.charactersByName[normalizeCharacterCueText(cueText)] ?? null : null,
  )

  // Only known project characters get a lookup affordance — unmatched cue text renders nothing.
  if (!visible || !character) return null

  return (
    <Box
      component="span"
      className="character-hover-button-gutter"
      contentEditable={false}
      sx={{
        position: 'absolute',
        left: -58,
        top: 2,
        display: 'inline-flex',
        opacity: 0.5,
        zIndex: 2,
        transition: 'opacity 0.15s ease',
        '.script-block:hover &, .script-block:focus-within &, &:hover': { opacity: 1 },
      }}
    >
      <Tooltip title="View character details" disableInteractive>
        <IconButton
          size="small"
          aria-label="View character details"
          onClick={(e) => openPane(character.name, { x: e.clientX, y: e.clientY })}
          sx={{
            width: 22,
            height: 22,
            border: `1.5px solid ${GLASS_MOSS}`,
            color: GLASS_MOSS,
            backgroundColor: 'rgba(45,128,96,0.08)',
            '&:hover': { backgroundColor: GLASS_MOSS, color: '#fff' },
          }}
        >
          <PersonIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
