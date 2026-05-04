'use client'

import * as React from 'react'
import {
  Box,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { SCREENPLAY_ELEMENT_LABELS } from './ScreenplayExtension'
import {
  ELEMENT_ICONS,
  ELEMENT_ORDER,
  ElementTooltipContent,
} from './WritualEditor'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'

interface ScreenplayToolbarProps {
  orientation?: 'horizontal' | 'vertical'
}

export function ScreenplayToolbar({ orientation = 'horizontal' }: ScreenplayToolbarProps) {
  const activeType = useScreenplayEditorStore((s) => s.activeType)
  const canEdit = useScreenplayEditorStore((s) => s.canEdit)
  const setElementTypeFn = useScreenplayEditorStore((s) => s.setElementTypeFn)

  if (!canEdit || !setElementTypeFn) return null

  const isVertical = orientation === 'vertical'

  return (
    <ToggleButtonGroup
      value={activeType}
      exclusive
      onChange={(_, newType) => { if (newType) setElementTypeFn(newType) }}
      size="small"
      orientation={orientation}
      aria-label="screenplay element type"
    >
      {ELEMENT_ORDER.map((type) => (
        <Tooltip
          key={type}
          title={<ElementTooltipContent type={type} />}
          arrow
          placement={isVertical ? 'right' : 'bottom'}
        >
          <span>
            <ToggleButton
              value={type}
              aria-label={SCREENPLAY_ELEMENT_LABELS[type]}
              sx={{
                gap: isVertical ? 0 : 0.5,
                px: isVertical ? 0.75 : 1.25,
                py: isVertical ? 0.75 : 0.5,
                textTransform: 'none',
                fontSize: '0.7rem',
                fontWeight: activeType === type ? 700 : 400,
                lineHeight: 1.2,
                minWidth: 0,
              }}
            >
              {ELEMENT_ICONS[type]}
              {!isVertical && (
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {SCREENPLAY_ELEMENT_LABELS[type]}
                </Box>
              )}
            </ToggleButton>
          </span>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  )
}
