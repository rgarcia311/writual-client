'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import type { Node as PMNode } from '@tiptap/pm/model'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { useScreenplayScenePanesStore } from '@/state/screenplayScenePanes'

const GLASS_MOSS = '#2D8060'

interface SceneOutlineButtonProps {
  node: PMNode
}

export function SceneOutlineButton({ node }: SceneOutlineButtonProps) {
  const visible = useScreenplayEditorStore((s) => s.sceneDetailButtonsVisible)
  const openPane = useScreenplayScenePanesStore((s) => s.openPane)

  const headingText = node.textContent.trim()

  if (!visible) return null

  return (
    <Box
      component="span"
      className="scene-outline-button-gutter"
      contentEditable={false}
      sx={{
        position: 'absolute',
        left: -58,
        top: 2,
        display: 'inline-flex',
        textTransform: 'none',
        opacity: 0.5,
        zIndex: 2,
        transition: 'opacity 0.15s ease',
        '.script-block:hover &, .script-block:focus-within &, &:hover': { opacity: 1 },
      }}
    >
      <Tooltip title="View scene outline" disableInteractive>
        <IconButton
          size="small"
          aria-label="View scene outline"
          onClick={(e) => openPane(headingText || 'Untitled scene', { x: e.clientX, y: e.clientY })}
          sx={{
            width: 22,
            height: 22,
            border: `1.5px solid ${GLASS_MOSS}`,
            color: GLASS_MOSS,
            backgroundColor: 'rgba(45,128,96,0.08)',
            '&:hover': { backgroundColor: GLASS_MOSS, color: '#fff' },
          }}
        >
          <Box
            component="svg"
            viewBox="0 0 24 24"
            sx={{ width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' }}
          >
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M6 6l1.7 1.7M16.3 16.3 18 18M18 6l-1.7 1.7M7.7 16.3 6 18" />
          </Box>
        </IconButton>
      </Tooltip>
    </Box>
  )
}
