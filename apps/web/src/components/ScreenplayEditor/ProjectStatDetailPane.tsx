'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { useProjectShellContext, buildProjectStatTiles } from '@/components/ProjectFloat'
import { useScreenplayStatsPanesStore, type ScreenplayStatPaneKey } from '@/state/screenplayStatsPanes'
import { toTitleCase } from 'utils/stringFormatting'
import { useIsSpatialEnvironment } from '@/hooks/useIsSpatialEnvironment'

const GLASS_INK = '#1c294a'
const GLASS_MOSS = '#2D8060'
const GLASS_MOSS_DARK = '#236348'
const PANE_WIDTH_PX = 300
/** Pixels of real depth per stacking step; tune against the PICO headset. */
const XR_BACK_STEP_PX = 24

export const STAT_PANE_LABELS: Record<ScreenplayStatPaneKey, string> = {
  overview: 'Overview',
  logline: 'Logline History',
  progress: 'Project Progress',
  characters: 'Characters',
  scenes: 'Scenes',
  deadlines: 'Deadline Tracking',
}

interface ProjectStatDetailPaneProps {
  paneId: ScreenplayStatPaneKey
}

export function ProjectStatDetailPane({ paneId }: ProjectStatDetailPaneProps) {
  const params = useParams<{ id?: string }>()
  const projectId = params?.id
  const isSpatial = useIsSpatialEnvironment()

  const pane = useScreenplayStatsPanesStore((s) => s.panes[paneId])
  const bringToFront = useScreenplayStatsPanesStore((s) => s.bringToFront)
  const closePane = useScreenplayStatsPanesStore((s) => s.closePane)
  const updatePanePosition = useScreenplayStatsPanesStore((s) => s.updatePanePosition)

  const { projectData, statTileData, isLoading } = useProjectShellContext()

  const dragOffsetRef = React.useRef<{ dx: number; dy: number } | null>(null)

  if (!pane) return null

  // Native spatial drag takes over on-device; the manual pointer-drag reposition
  // logic below only runs for flat-browser mouse/touch.
  const handlePointerDown = isSpatial
    ? undefined
    : (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        dragOffsetRef.current = { dx: e.clientX - pane.x, dy: e.clientY - pane.y }
      }

  const handlePointerMove = isSpatial
    ? undefined
    : (e: React.PointerEvent<HTMLDivElement>) => {
        const offset = dragOffsetRef.current
        if (!offset) return
        updatePanePosition(paneId, e.clientX - offset.dx, e.clientY - offset.dy)
      }

  const endDrag = isSpatial
    ? undefined
    : (e: React.PointerEvent<HTMLDivElement>) => {
        if (dragOffsetRef.current === null) return
        dragOffsetRef.current = null
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      }

  const statNode =
    paneId === 'overview' ? null : buildProjectStatTiles(statTileData).find((t) => t.key === paneId)?.node ?? null

  return (
    <Box
      enable-xr
      onPointerDown={() => bringToFront(paneId)}
      sx={{
        position: 'fixed',
        left: pane.x,
        top: pane.y,
        zIndex: pane.zIndex,
        width: PANE_WIDTH_PX,
        backgroundColor: 'rgba(245, 242, 232, 0.32)',
        backdropFilter: 'blur(24px) saturate(150%)',
        WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        border: '1px solid rgba(255,255,255,0.4)',
        boxShadow: '0 8px 32px rgba(28, 41, 74, 0.3), inset 0 1px 0 rgba(255,255,255,0.4)',
        borderRadius: 3,
        color: GLASS_INK,
        overflow: 'hidden',
      }}
      style={
        {
          '--xr-back': `${pane.zIndex * XR_BACK_STEP_PX}px`,
          '--xr-background-material': 'translucent',
        } as React.CSSProperties
      }
    >
      {paneId === 'overview' ? (
        <Box
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          sx={{ cursor: 'move', userSelect: 'none' }}
        >
          <Box sx={{ position: 'relative' }}>
            <Box
              component="img"
              src={projectData.poster?.trim() ? projectData.poster : '/default-film-poster.png'}
              alt={`${projectData.title || 'Project'} cover`}
              draggable={false}
              sx={{ width: '100%', height: 220, objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
            />
            <IconButton
              aria-label="Close"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                closePane(paneId)
              }}
              size="small"
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                color: '#fff',
                backgroundColor: 'rgba(28,41,74,0.45)',
                '&:hover': { backgroundColor: 'rgba(28,41,74,0.65)' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ px: 3, pt: 2, pb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
              {projectData.title || 'Untitled Project'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(28,41,74,0.68)' }}>
              by {toTitleCase(projectData.displayName || projectData.email || projectData.user || 'TBD')}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          sx={{
            cursor: 'move',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 2.5,
            pt: 2,
            pb: 1,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{STAT_PANE_LABELS[paneId]}</Typography>
          <IconButton
            aria-label="Close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              closePane(paneId)
            }}
            size="small"
            sx={{ color: GLASS_INK, backgroundColor: 'rgba(28,41,74,0.08)' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Box sx={{ px: 2.5, pb: 2 }}>
        {paneId === 'overview' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography
                component="span"
                sx={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: GLASS_MOSS_DARK,
                  mb: 0.5,
                }}
              >
                Genre
              </Typography>
              <Typography variant="body2" sx={{ color: GLASS_INK }}>
                {projectData.genre?.trim() || '—'}
              </Typography>
            </Box>
            <Box>
              <Typography
                component="span"
                sx={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: GLASS_MOSS_DARK,
                  mb: 0.5,
                }}
              >
                Logline
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: GLASS_INK, lineHeight: 1.55 }}>
                {projectData.logline?.trim() || '—'}
              </Typography>
            </Box>
          </Box>
        ) : isLoading ? (
          <Typography variant="body2" sx={{ color: 'rgba(28,41,74,0.68)' }}>
            Loading…
          </Typography>
        ) : (
          <Box sx={{ '& .MuiTypography-root': { color: GLASS_INK } }}>{statNode}</Box>
        )}
      </Box>

      {projectId && (
        <Box sx={{ borderTop: '1px solid rgba(28,41,74,0.12)', px: 2.5, py: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            component={Link}
            href={`/project/${projectId}`}
            variant="contained"
            size="small"
            sx={{ bgcolor: GLASS_MOSS, '&:hover': { bgcolor: GLASS_MOSS_DARK } }}
          >
            View Project
          </Button>
        </Box>
      )}
    </Box>
  )
}
