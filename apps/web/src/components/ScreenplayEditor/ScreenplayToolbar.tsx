'use client'

import * as React from 'react'
import {
  Box,
  Divider,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { SCREENPLAY_ELEMENT_LABELS, type ScreenplayElementType } from './ScreenplayExtension'
import {
  BODY_ELEMENT_ORDER,
  ELEMENT_ICONS,
  ElementTooltipContent,
  TITLE_PAGE_ELEMENT_ORDER,
} from './WritualEditor'
import { TITLE_PAGE_ELEMENT_TYPES } from './screenplaySeedDoc'
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
  const isOnTitlePage = TITLE_PAGE_ELEMENT_TYPES.has(activeType)

  const renderButton = (type: ScreenplayElementType, disabled: boolean) => (
    <Tooltip
      key={type}
      title={disabled ? 'Only available on the title page' : <ElementTooltipContent type={type} />}
      arrow
      placement={isVertical ? 'right' : 'bottom'}
    >
      <span>
        <ToggleButton
          value={type}
          disabled={disabled}
          aria-label={SCREENPLAY_ELEMENT_LABELS[type]}
          sx={{
            // <PROTECTED>
            gap: isVertical ? 0 : 0.5,
            px: isVertical ? 0.75 : 1.25,
            py: isVertical ? 0.75 : 0.5,
            textTransform: 'none',
            fontSize: '0.7rem',
            fontWeight: activeType === type ? 700 : 400,
            lineHeight: 1.2,
            minWidth: 0,
            // </PROTECTED>
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
  )

  return (
    <ToggleButtonGroup
      value={activeType}
      exclusive
      onChange={(_, newType) => { if (newType) setElementTypeFn(newType) }}
      size="small"
      orientation={orientation}
      aria-label="screenplay element type"
    >
      {TITLE_PAGE_ELEMENT_ORDER.map((type) => renderButton(type, !isOnTitlePage))}
      <Divider orientation={isVertical ? 'horizontal' : 'vertical'} flexItem sx={{ my: isVertical ? 0.5 : 1, mx: isVertical ? 1 : 0.5 }} />
      {BODY_ELEMENT_ORDER.map((type) => renderButton(type, false))}
    </ToggleButtonGroup>
  )
}
