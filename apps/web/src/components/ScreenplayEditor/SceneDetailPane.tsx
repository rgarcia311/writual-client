'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { useScreenplaySceneOutlineStore } from '@/state/screenplaySceneOutline'
import { useScreenplayScenePanesStore } from '@/state/screenplayScenePanes'

const GLASS_INK = '#1c294a'
const GLASS_MOSS = '#2D8060'
const GLASS_MOSS_DARK = '#236348'
const PANE_WIDTH_PX = 400

interface SceneDetailPaneProps {
  paneId: string
}

const OUTLINE_SECTIONS: { key: 'thesis' | 'antithesis' | 'synthesis'; label: string }[] = [
  { key: 'thesis', label: 'Thesis' },
  { key: 'antithesis', label: 'Antithesis' },
  { key: 'synthesis', label: 'Synthesis' },
]

export function SceneDetailPane({ paneId }: SceneDetailPaneProps) {
  const params = useParams<{ id?: string }>()
  const projectId = params?.id

  const pane = useScreenplayScenePanesStore((s) => s.panes[paneId])
  const bringToFront = useScreenplayScenePanesStore((s) => s.bringToFront)
  const closePane = useScreenplayScenePanesStore((s) => s.closePane)
  const updatePanePosition = useScreenplayScenePanesStore((s) => s.updatePanePosition)
  const scene = useScreenplaySceneOutlineStore((s) => s.scenesByHeading[paneId] ?? null)

  const dragOffsetRef = React.useRef<{ dx: number; dy: number } | null>(null)

  if (!pane) return null

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragOffsetRef.current = { dx: e.clientX - pane.x, dy: e.clientY - pane.y }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const offset = dragOffsetRef.current
    if (!offset) return
    updatePanePosition(paneId, e.clientX - offset.dx, e.clientY - offset.dy)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragOffsetRef.current === null) return
    dragOffsetRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <Box
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
      }}
    >
      <Box
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        sx={{
          cursor: 'move',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1.5,
          p: 3,
          pb: 1.5,
        }}
      >
        <Box>
          <Typography
            component="span"
            sx={{ fontFamily: '"Courier Prime", "Courier New", Courier, monospace', fontWeight: 700, fontSize: 18 }}
          >
            {pane.sceneHeading}
          </Typography>
          {scene?.act != null && scene?.step ? (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'rgba(28,41,74,0.58)' }}>
              Outline &middot; Act {scene.act}, Step &ldquo;{scene.step}&rdquo;
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 'none' }}>
          {scene?.number != null && (
            <Chip
              label={`Scene ${scene.number}`}
              size="small"
              sx={{
                fontWeight: 700,
                color: GLASS_MOSS_DARK,
                backgroundColor: 'rgba(45,128,96,0.14)',
                border: '1px solid rgba(45,128,96,0.3)',
              }}
            />
          )}
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
      </Box>

      <Box sx={{ px: 3, pb: 2 }}>
        {scene ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {OUTLINE_SECTIONS.map(({ key, label }) => (
              <Box key={key}>
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
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: GLASS_INK, lineHeight: 1.55 }}>
                  {scene[key]?.trim() || '—'}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'rgba(28,41,74,0.68)' }}>
              This scene heading isn&rsquo;t linked to an Outline scene yet.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(28,41,74,0.68)' }}>
              Add it on the Outline page to see its Thesis, Antithesis and Synthesis here.
            </Typography>
          </Box>
        )}
      </Box>

      {projectId && (
        <Box sx={{ borderTop: '1px solid rgba(28,41,74,0.12)', px: 3, py: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            component={Link}
            href={`/project/${projectId}/outline`}
            variant="contained"
            size="small"
            sx={{ bgcolor: GLASS_MOSS, '&:hover': { bgcolor: GLASS_MOSS_DARK } }}
          >
            View in Outline
          </Button>
        </Box>
      )}
    </Box>
  )
}
