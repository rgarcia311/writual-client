'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import Tooltip from '@mui/material/Tooltip'
import PersonIcon from '@mui/icons-material/Person'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { useScreenplayScenePanesStore } from '@/state/screenplayScenePanes'
import { useScreenplayCharacterPanesStore } from '@/state/screenplayCharacterPanes'

interface ScreenplayDetailTogglesToolbarProps {
  orientation?: 'horizontal' | 'vertical'
}

/** Matches the "target" icon used by `SceneOutlineButton`'s gutter affordance. */
function SceneDetailIcon() {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      sx={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' }}
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M6 6l1.7 1.7M16.3 16.3 18 18M18 6l-1.7 1.7M7.7 16.3 6 18" />
    </Box>
  )
}

/** Own section, separated by a divider, for toggling the scene-outline and character-detail
 *  hover buttons that appear on slugline / character-cue blocks in the screenplay body. */
export function ScreenplayDetailTogglesToolbar({
  orientation = 'vertical',
}: ScreenplayDetailTogglesToolbarProps) {
  const sceneDetailButtonsVisible = useScreenplayEditorStore((s) => s.sceneDetailButtonsVisible)
  const characterDetailButtonsVisible = useScreenplayEditorStore((s) => s.characterDetailButtonsVisible)
  const toggleSceneDetailButtons = useScreenplayEditorStore((s) => s.toggleSceneDetailButtons)
  const toggleCharacterDetailButtons = useScreenplayEditorStore((s) => s.toggleCharacterDetailButtons)
  const openScenePaneCount = useScreenplayScenePanesStore((s) => Object.keys(s.panes).length)
  const closeAllScenePanes = useScreenplayScenePanesStore((s) => s.closeAllPanes)
  const openCharacterPaneCount = useScreenplayCharacterPanesStore((s) => Object.keys(s.panes).length)
  const closeAllCharacterPanes = useScreenplayCharacterPanesStore((s) => s.closeAllPanes)

  const isVertical = orientation === 'vertical'

  const buttonSx = {
    gap: isVertical ? 0 : 0.5,
    px: isVertical ? 0.75 : 1.25,
    py: isVertical ? 0.75 : 0.5,
    minWidth: 0,
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        gap: isVertical ? 0.5 : 1,
      }}
    >
      <Divider
        orientation={isVertical ? 'horizontal' : 'vertical'}
        flexItem
        sx={{ my: isVertical ? 0.5 : 1, mx: isVertical ? 1 : 0.5 }}
      />

      <Tooltip
        title={sceneDetailButtonsVisible ? 'Hide scene detail buttons' : 'Show scene detail buttons'}
        arrow
        placement={isVertical ? 'right' : 'bottom'}
      >
        <ToggleButton
          value="scene-details"
          selected={sceneDetailButtonsVisible}
          onChange={toggleSceneDetailButtons}
          size="small"
          aria-label="Toggle scene detail buttons"
          sx={buttonSx}
        >
          <SceneDetailIcon />
        </ToggleButton>
      </Tooltip>

      <Tooltip title="Close all scene detail panes" arrow placement={isVertical ? 'right' : 'bottom'}>
        <span>
          <IconButton
            size="small"
            aria-label="Close all scene detail panes"
            disabled={openScenePaneCount <= 1}
            onClick={closeAllScenePanes}
            sx={buttonSx}
          >
            <ClearAllIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip
        title={characterDetailButtonsVisible ? 'Hide character detail buttons' : 'Show character detail buttons'}
        arrow
        placement={isVertical ? 'right' : 'bottom'}
      >
        <ToggleButton
          value="character-details"
          selected={characterDetailButtonsVisible}
          onChange={toggleCharacterDetailButtons}
          size="small"
          aria-label="Toggle character detail buttons"
          sx={buttonSx}
        >
          <PersonIcon sx={{ fontSize: 15 }} />
        </ToggleButton>
      </Tooltip>

      <Tooltip title="Close all character detail panes" arrow placement={isVertical ? 'right' : 'bottom'}>
        <span>
          <IconButton
            size="small"
            aria-label="Close all character detail panes"
            disabled={openCharacterPaneCount <= 1}
            onClick={closeAllCharacterPanes}
            sx={buttonSx}
          >
            <ClearAllIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  )
}
