'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import InsightsIcon from '@mui/icons-material/Insights'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import HistoryEduIcon from '@mui/icons-material/HistoryEdu'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import GroupsIcon from '@mui/icons-material/Groups'
import MovieFilterIcon from '@mui/icons-material/MovieFilter'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { useProjectShellContext } from '@/components/ProjectFloat'
import { useScreenplayStatsPanesStore, type ScreenplayStatPaneKey } from '@/state/screenplayStatsPanes'
import { useScreenplayInspirationPanesStore } from '@/state/screenplayInspirationPanes'
import { STAT_PANE_LABELS } from './ProjectStatDetailPane'

interface ScreenplayContextPanesToolbarProps {
  orientation?: 'horizontal' | 'vertical'
}

const STAT_PANE_ORDER: ScreenplayStatPaneKey[] = ['overview', 'logline', 'progress', 'characters', 'scenes', 'deadlines']

const STAT_PANE_ICONS: Record<ScreenplayStatPaneKey, React.ReactNode> = {
  overview: <InfoOutlinedIcon fontSize="small" />,
  logline: <HistoryEduIcon fontSize="small" />,
  progress: <TrendingUpIcon fontSize="small" />,
  characters: <GroupsIcon fontSize="small" />,
  scenes: <MovieFilterIcon fontSize="small" />,
  deadlines: <CalendarTodayIcon fontSize="small" />,
}

/** Own section, separated by a divider, for opening project-stat and inspiration reference
 *  panes — floating glass panels matching the scene/character detail pane treatment. */
export function ScreenplayContextPanesToolbar({
  orientation = 'vertical',
}: ScreenplayContextPanesToolbarProps) {
  const { projectData } = useProjectShellContext()
  const inspirationItems = projectData.inspiration ?? []

  const openStatPane = useScreenplayStatsPanesStore((s) => s.openPane)
  const closeAllStatPanes = useScreenplayStatsPanesStore((s) => s.closeAllPanes)
  const openStatPaneCount = useScreenplayStatsPanesStore((s) => Object.keys(s.panes).length)

  const openInspirationPane = useScreenplayInspirationPanesStore((s) => s.openPane)
  const closeAllInspirationPanes = useScreenplayInspirationPanesStore((s) => s.closeAllPanes)
  const openInspirationPaneCount = useScreenplayInspirationPanesStore((s) => Object.keys(s.panes).length)

  const [statsAnchorEl, setStatsAnchorEl] = React.useState<HTMLElement | null>(null)
  const [inspirationAnchorEl, setInspirationAnchorEl] = React.useState<HTMLElement | null>(null)

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

      <Tooltip title="Open a project stat pane" arrow placement={isVertical ? 'right' : 'bottom'}>
        <IconButton
          size="small"
          aria-label="Open a project stat pane"
          onClick={(e) => setStatsAnchorEl(e.currentTarget)}
          sx={buttonSx}
        >
          <InsightsIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Close all project stat panes" arrow placement={isVertical ? 'right' : 'bottom'}>
        <span>
          <IconButton
            size="small"
            aria-label="Close all project stat panes"
            disabled={openStatPaneCount <= 1}
            onClick={() => closeAllStatPanes()}
            sx={buttonSx}
          >
            <ClearAllIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Menu anchorEl={statsAnchorEl} open={Boolean(statsAnchorEl)} onClose={() => setStatsAnchorEl(null)}>
        {STAT_PANE_ORDER.map((key) => (
          <MenuItem
            key={key}
            onClick={() => {
              openStatPane(key)
              setStatsAnchorEl(null)
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>{STAT_PANE_ICONS[key]}</ListItemIcon>
            <ListItemText>{STAT_PANE_LABELS[key]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Tooltip title="Open an inspiration pane" arrow placement={isVertical ? 'right' : 'bottom'}>
        <IconButton
          size="small"
          aria-label="Open an inspiration pane"
          onClick={(e) => setInspirationAnchorEl(e.currentTarget)}
          sx={buttonSx}
        >
          <LightbulbOutlinedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Close all inspiration panes" arrow placement={isVertical ? 'right' : 'bottom'}>
        <span>
          <IconButton
            size="small"
            aria-label="Close all inspiration panes"
            disabled={openInspirationPaneCount <= 1}
            onClick={() => closeAllInspirationPanes()}
            sx={buttonSx}
          >
            <ClearAllIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={inspirationAnchorEl}
        open={Boolean(inspirationAnchorEl)}
        onClose={() => setInspirationAnchorEl(null)}
      >
        {inspirationItems.length === 0
          ? [
              <MenuItem key="empty" disabled>
                <ListItemText
                  primary="No inspiration items yet"
                  secondary="Add items on the project overview page"
                />
              </MenuItem>,
            ]
          : inspirationItems.map((item) => (
              <MenuItem
                key={item._id}
                onClick={() => {
                  openInspirationPane(item._id, item.title || 'Untitled')
                  setInspirationAnchorEl(null)
                }}
              >
                <ListItemText>{item.title?.trim() || 'Untitled'}</ListItemText>
              </MenuItem>
            ))}
      </Menu>
    </Box>
  )
}
