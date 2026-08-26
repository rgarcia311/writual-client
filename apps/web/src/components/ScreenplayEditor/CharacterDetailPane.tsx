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
import { CharacterImageCarousel } from '@/components/CharacterImageCarousel'
import { useScreenplayCharacterLookupStore } from '@/state/screenplayCharacterLookup'
import { useScreenplayCharacterPanesStore } from '@/state/screenplayCharacterPanes'
import { useIsSpatialEnvironment } from '@/hooks/useIsSpatialEnvironment'

const GLASS_INK = '#1c294a'
const GLASS_MOSS = '#2D8060'
const GLASS_MOSS_DARK = '#236348'
const DEFAULT_CHARACTER_IMAGE = '/default-character-image.png'
const PANE_WIDTH_PX = 340
/** Pixels of real depth per stacking step; tune against the PICO headset. */
const XR_BACK_STEP_PX = 24

interface CharacterDetailPaneProps {
  paneId: string
}

const DETAIL_SECTIONS: { key: 'bio' | 'want' | 'need'; label: string }[] = [
  { key: 'bio', label: 'Bio' },
  { key: 'want', label: 'Want' },
  { key: 'need', label: 'Need' },
]

/** Maps a raw gender string to M / F / X, or '' when absent. */
function abbreviateGender(gender: unknown): string {
  if (!gender || typeof gender !== 'string') return ''
  const lower = gender.trim().toLowerCase()
  if (lower === 'male' || lower === 'm') return 'M'
  if (lower === 'female' || lower === 'f') return 'F'
  if (lower === '') return ''
  return 'X'
}

export function CharacterDetailPane({ paneId }: CharacterDetailPaneProps) {
  const params = useParams<{ id?: string }>()
  const projectId = params?.id
  const isSpatial = useIsSpatialEnvironment()

  const pane = useScreenplayCharacterPanesStore((s) => s.panes[paneId])
  const bringToFront = useScreenplayCharacterPanesStore((s) => s.bringToFront)
  const closePane = useScreenplayCharacterPanesStore((s) => s.closePane)
  const updatePanePosition = useScreenplayCharacterPanesStore((s) => s.updatePanePosition)
  const character = useScreenplayCharacterLookupStore((s) => s.charactersByName[paneId] ?? null)

  const dragOffsetRef = React.useRef<{ dx: number; dy: number } | null>(null)

  if (!pane) return null

  const activeVersion = character?.lockedVersion ?? character?.activeVersion ?? 1
  const detail =
    character?.details?.find((d) => d.version === activeVersion) ?? character?.details?.[0]
  // Characters saved before multi-image support carry only `imageUrl`, which reads as a one-image
  // gallery; anything longer gets arrows and dots from the carousel.
  const gallery = (character?.imageUrls ?? []).filter((url) => typeof url === 'string' && url.trim())
  const primaryImage = character?.imageUrl?.trim()
  const images = gallery.length ? gallery : primaryImage ? [primaryImage] : []
  const genderAbbrev = abbreviateGender(detail?.gender)
  const badgeLabel = [detail?.age, genderAbbrev].filter(Boolean).join(' ')

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
          // Real depth stacking on spatial platforms; automatically ignored on flat browsers,
          // where the zIndex above still does the job.
          '--xr-back': `${pane.zIndex * XR_BACK_STEP_PX}px`,
          // Replaces the manual backdrop-filter glass effect above with native translucent
          // material on spatial platforms; the sx backdropFilter is the flat-browser fallback.
          '--xr-background-material': 'translucent',
        } as React.CSSProperties
      }
    >
      <Box
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        sx={{ cursor: 'move', userSelect: 'none' }}
      >
        <Box sx={{ position: 'relative' }}>
          <CharacterImageCarousel
            images={images}
            fallbackSrc={DEFAULT_CHARACTER_IMAGE}
            alt={pane.characterName ? `${pane.characterName} character` : 'Character'}
            height="260px"
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
              // Above the carousel's arrows and dot strip.
              zIndex: 3,
              color: '#fff',
              backgroundColor: 'rgba(28,41,74,0.45)',
              '&:hover': { backgroundColor: 'rgba(28,41,74,0.65)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box
          sx={{
            px: 3,
            pt: 2,
            pb: 0.5,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{pane.characterName || 'Unknown'}</Typography>
          {badgeLabel && (
            <Chip
              label={badgeLabel}
              size="small"
              sx={{
                flex: 'none',
                fontWeight: 700,
                color: GLASS_MOSS_DARK,
                backgroundColor: 'rgba(45,128,96,0.14)',
                border: '1px solid rgba(45,128,96,0.3)',
              }}
            />
          )}
        </Box>
      </Box>

      <Box sx={{ px: 3, pt: 1, pb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {DETAIL_SECTIONS.map(({ key, label }) => (
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
                {detail?.[key]?.trim() || '—'}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {projectId && (
        <Box sx={{ borderTop: '1px solid rgba(28,41,74,0.12)', px: 3, py: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            component={Link}
            href={`/project/${projectId}/characters`}
            variant="contained"
            size="small"
            sx={{ bgcolor: GLASS_MOSS, '&:hover': { bgcolor: GLASS_MOSS_DARK } }}
          >
            View in Characters
          </Button>
        </Box>
      )}
    </Box>
  )
}
