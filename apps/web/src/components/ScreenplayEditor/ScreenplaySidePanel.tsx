import * as React from 'react'
import {
  Box,
  ButtonBase,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import InsightsIcon from '@mui/icons-material/Insights'
import { ScreenplayInspirationPanel } from './ScreenplayInspirationPanel'
import { ScreenplayProjectStatsPanel } from './ScreenplayProjectStatsPanel'
import '@/styles/screenplayWorkspace.css'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SceneVersion {
  sceneHeading?: string
  version?: number
  step?: string
  act?: number
  thesis?: string
  antithesis?: string
  synthesis?: string
}

export interface ProjectScene {
  _id: string
  activeVersion?: number
  lockedVersion?: number | null
  versions?: SceneVersion[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Vertical tab rail on the left edge of the screenplay area. */
const SIDE_PANEL_TABS_W_PX = 35

export type ScreenplaySidePanelTab = 'inspiration' | 'stats'

const SIDE_PANEL_TABS: ReadonlyArray<{
  id: ScreenplaySidePanelTab
  label: string
  Icon: typeof LightbulbOutlinedIcon
}> = [
  { id: 'inspiration', label: 'Inspiration', Icon: LightbulbOutlinedIcon },
  { id: 'stats', label: 'Stats', Icon: InsightsIcon },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScreenplaySidePanelProps {
  /** Controls the outer wrapper's flex proportion (true = expanded list shares row width). */
  navigatorSplitProportions: boolean
  sidePanelTab: ScreenplaySidePanelTab
  onTabChange: (tab: ScreenplaySidePanelTab) => void
  sidePanelExpanded: boolean
  onExpandedChange: (expanded: boolean) => void
  projectId: string | undefined
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScreenplaySidePanel({
  navigatorSplitProportions,
  sidePanelTab,
  onTabChange,
  sidePanelExpanded,
  onExpandedChange,
  projectId,
}: ScreenplaySidePanelProps) {
  const theme = useTheme()
  const usesFixedWidthPanel = sidePanelTab === 'stats' || sidePanelTab === 'inspiration'
  const contentPanelClassName =
    sidePanelTab === 'stats'
      ? 'screenplay-side-panel-content--stats'
      : sidePanelTab === 'inspiration'
        ? 'screenplay-side-panel-content--inspiration'
        : undefined

  return (
    <Box
      className={
        navigatorSplitProportions
          ? 'screenplay-side-panel'
          : 'screenplay-side-panel screenplay-side-panel--compact'
      }
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignSelf: 'stretch',
        height: '100%',
        flex: navigatorSplitProportions ? '1 1 0%' : '0 1 auto',
        minHeight: 0,
        minWidth: 0,
        overflowX: 'visible',
        overflowY: 'hidden',
      }}
    >
      {/* ── Tab rail ──────────────────────────────────────────────────── */}
      <Box
        sx={{
          width: SIDE_PANEL_TABS_W_PX,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          alignSelf: 'stretch',
          minHeight: 0,
          boxSizing: 'border-box',
          bgcolor: 'transparent',
        }}
      >
        <Box
          role="tablist"
          aria-label="Screenplay side panel"
          aria-orientation="vertical"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            py: 1.25,
            pl: 0,
            pr: 0.5,
            gap: 0.75,
            minHeight: 0,
          }}
        >
          {SIDE_PANEL_TABS.map(({ id, label, Icon }) => {
            const selected = sidePanelTab === id
            return (
              <ButtonBase
                key={id}
                role="tab"
                aria-selected={selected}
                aria-label={id === 'stats' ? 'Project Stats' : label}
                id={`screenplay-side-tab-${id}`}
                onClick={() => onTabChange(id)}
                focusRipple
                sx={{
                  flex: 1,
                  minHeight: 56,
                  maxHeight: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '0 12px 12px 0',
                  color: 'text.primary',
                  bgcolor: selected ? 'background.default' : 'transparent',
                  border: (t) => `1px solid ${t.palette.divider}`,
                  boxShadow: 'none',
                  transition: (t) =>
                    t.transitions.create(['background-color', 'color'], {
                      duration: t.transitions.duration.shorter,
                    }),
                  '&:hover': {
                    bgcolor: selected ? 'background.default' : 'action.hover',
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    py: 0.5,
                  }}
                >
                  <Icon sx={{ fontSize: 18, color: selected ? 'text.primary' : 'text.secondary' }} />
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      letterSpacing: 0.2,
                      lineHeight: 1.1,
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      fontSize: '0.68rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
              </ButtonBase>
            )
          })}
        </Box>

        {/* ── Expand / collapse toggle ──────────────────────────────── */}
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            py: 1,
          }}
        >
          {sidePanelExpanded ? (
            <Tooltip title="Hide list">
              <IconButton
                size="small"
                onClick={() => onExpandedChange(false)}
                aria-label="Hide list"
                aria-expanded
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Show list">
              <IconButton
                size="small"
                onClick={() => onExpandedChange(true)}
                aria-label="Show list"
                aria-expanded={false}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* ── Expanded list panel ───────────────────────────────────────── */}
      {sidePanelExpanded && (
        <Paper
          className={['screenplay-side-panel-content', 'screenplay-navigator', contentPanelClassName]
            .filter(Boolean)
            .join(' ')}
          elevation={0}
          sx={{
            flex: '1 1 0',
            height: '100%',
            minHeight: 0,
            minWidth: 0,
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            bgcolor: 'background.default',
            backgroundImage: 'none',
            border: 'none',
            borderRadius: '0 var(--app-sidenav-radius, 10px) var(--app-sidenav-radius, 10px) 0',
            boxShadow: 'none',
            overflow: 'hidden',
            transition: theme.transitions.create(['box-shadow', 'border-color'], {
              duration: theme.transitions.duration.shorter,
            }),
          }}
        >
          <Box
            className="screenplay-side-panel-content__scroll"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              bgcolor: 'background.default',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {sidePanelTab === 'stats' && projectId ? (
              <ScreenplayProjectStatsPanel projectId={projectId} />
            ) : null}

            {sidePanelTab === 'inspiration' && projectId ? (
              <ScreenplayInspirationPanel projectId={projectId} />
            ) : null}
          </Box>
        </Paper>
      )}
    </Box>
  )
}
