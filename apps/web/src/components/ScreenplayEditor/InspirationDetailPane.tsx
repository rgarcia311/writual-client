'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { useProjectShellContext } from '@/components/ProjectFloat'
import { useScreenplayInspirationPanesStore } from '@/state/screenplayInspirationPanes'
import { useIsSpatialEnvironment } from '@/hooks/useIsSpatialEnvironment'

const GLASS_INK = '#1c294a'
const GLASS_MOSS = '#2D8060'
const GLASS_MOSS_DARK = '#236348'
const PANE_WIDTH_PX = 320
/** Pixels of real depth per stacking step; tune against the PICO headset. */
const XR_BACK_STEP_PX = 24

interface InspirationDetailPaneProps {
  paneId: string
}

export function InspirationDetailPane({ paneId }: InspirationDetailPaneProps) {
  const params = useParams<{ id?: string }>()
  const projectId = params?.id
  const isSpatial = useIsSpatialEnvironment()

  const pane = useScreenplayInspirationPanesStore((s) => s.panes[paneId])
  const bringToFront = useScreenplayInspirationPanesStore((s) => s.bringToFront)
  const closePane = useScreenplayInspirationPanesStore((s) => s.closePane)
  const updatePanePosition = useScreenplayInspirationPanesStore((s) => s.updatePanePosition)

  const { projectData } = useProjectShellContext()
  const item = projectData.inspiration?.find((i) => i._id === paneId) ?? null

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

  const title = item?.title?.trim() || pane.title || 'Untitled'

  return (
    <Box
      enable-xr=""
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
          px: 3,
          pt: 2,
          pb: item ? 0 : 1.5,
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{title}</Typography>
        <IconButton
          aria-label="Close"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            closePane(paneId)
          }}
          size="small"
          sx={{ color: GLASS_INK, backgroundColor: 'rgba(28,41,74,0.08)', flex: 'none' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {item ? (
        <Box sx={{ px: 3, pt: 1.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {item.image ? (
            <Box
              component="img"
              src={item.image}
              alt={title}
              sx={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 1.5, display: 'block' }}
            />
          ) : item.video ? (
            <Box sx={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 1.5, overflow: 'hidden' }}>
              <Box
                component="iframe"
                src={item.video}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                sx={{ border: 0, width: '100%', height: '100%' }}
              />
            </Box>
          ) : null}

          {item.note ? (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: GLASS_INK, lineHeight: 1.55 }}>
              {item.note}
            </Typography>
          ) : null}

          {item.links && item.links.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {item.links.map((link, idx) => (
                <Typography
                  key={`${item._id}-link-${idx}`}
                  variant="caption"
                  component="a"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: GLASS_MOSS_DARK, textDecoration: 'underline', wordBreak: 'break-all' }}
                >
                  {link}
                </Typography>
              ))}
            </Box>
          ) : null}
        </Box>
      ) : (
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(28,41,74,0.68)' }}>
            This inspiration item is no longer available.
          </Typography>
        </Box>
      )}

      {projectId && (
        <Box sx={{ borderTop: '1px solid rgba(28,41,74,0.12)', px: 3, py: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            component={Link}
            href={`/project/${projectId}`}
            variant="contained"
            size="small"
            sx={{ bgcolor: GLASS_MOSS, '&:hover': { bgcolor: GLASS_MOSS_DARK } }}
          >
            View in Inspiration
          </Button>
        </Box>
      )}
    </Box>
  )
}
