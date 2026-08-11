'use client'

import * as React from 'react'

/**
 * Discrete --xr-back swap on hover, not a CSS transition — WebSpatial doesn't support
 * animating this property, so the value jumps via React state instead of interpolating.
 * Ignored automatically on flat browsers, same as the rest of the --xr-* custom properties.
 */
export function useSpatialHoverLift(restPx: number, hoverPx: number) {
  const [hovered, setHovered] = React.useState(false)

  const hoverHandlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  }

  const xrStyle = {
    '--xr-back': `${hovered ? hoverPx : restPx}px`,
    '--xr-background-material': 'translucent',
  } as React.CSSProperties

  return { hovered, hoverHandlers, xrStyle }
}
