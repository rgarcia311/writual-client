'use client';

import * as React from 'react';
import Paper from '@mui/material/Paper';

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
      className={`project-float-surface ${variantClass} ${className ?? ''}`.trim()}
      sx={{
        borderRadius: 'var(--project-float-radius, 12px)',
        overflow: variant === 'poster' ? 'hidden' : 'visible',
        p: 'var(--project-float-stat-surface-padding, 4px)',
        ...(variant === 'stat'
          ? { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }
          : {}),
      }}
    >
      {children}
    </Paper>
  );
}
