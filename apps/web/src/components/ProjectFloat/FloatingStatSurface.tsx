'use client';

import * as React from 'react';
import Paper from '@mui/material/Paper';

/** Pixels of real depth these surfaces sit in front of page content on spatial platforms. */
const XR_STAT_SURFACE_BACK_PX = 12;

export interface FloatingStatSurfaceProps {
  children: React.ReactNode;
  className?: string;
  /** Narrow poster tile vs standard stat width */
  variant?: 'stat' | 'poster' | 'info';
}

export function FloatingStatSurface({
  children,
  className,
  variant = 'stat',
}: FloatingStatSurfaceProps) {
  const variantClass =
    variant === 'poster'
      ? 'project-float-poster-anchor'
      : variant === 'info'
        ? 'project-float-info-anchor'
        : 'project-float-stat-anchor';

  return (
    <Paper
      elevation={2}
      enable-xr
      className={`project-float-surface ${variantClass} ${className ?? ''}`.trim()}
      sx={{
        position: 'relative',
        borderRadius: 'var(--project-float-radius, 12px)',
        overflow: variant === 'poster' ? 'hidden' : 'visible',
        p: 'var(--project-float-stat-surface-padding, 4px)',
        ...(variant === 'stat'
          ? { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }
          : {}),
      }}
      style={
        {
          '--xr-back': `${XR_STAT_SURFACE_BACK_PX}px`,
          '--xr-background-material': 'translucent',
        } as React.CSSProperties
      }
    >
      {children}
    </Paper>
  );
}
