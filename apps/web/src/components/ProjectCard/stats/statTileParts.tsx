'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { ProgressItem } from '../../../utils/progress';

/**
 * Shared pieces and type scale for the project stat tiles. Compact tiles are legible rather than
 * miniature: the type stays readable and the card scrolls when the content outgrows it (hero cards
 * are pinned to the poster's height — see `--project-float-hero-card-height`).
 */
export const TILE_HEADING_SIZE = '0.95rem';
export const TILE_VALUE_SIZE = '0.78rem';
export const TILE_LABEL_SIZE = '0.68rem';
export const TILE_META_SIZE = '0.66rem';

/** Slim bar — tall enough for the 0.78rem label, short enough not to dominate the tile. */
export const PAGES_BAR_HEIGHT_PX = 18;

/**
 * Header row: tile title plus an optional trailing icon. The class is the hook floating stat cards
 * use to pin the header while the card body scrolls (see `projectDetailsFloat.css`).
 */
export function TileHeading({
  title,
  icon,
  compact,
}: {
  title: string;
  icon?: React.ReactNode;
  compact: boolean;
}) {
  return (
    <Box
      className="stat-tile-heading"
      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, fontSize: compact ? TILE_HEADING_SIZE : undefined }}
      >
        {title}
      </Typography>
      {icon}
    </Box>
  );
}

export interface StatGridCellProps {
  label: string;
  value: string;
  /** Palette color for the value line; defaults to primary text. */
  valueColor?: string;
  /** Secondary line under the value (e.g. whole-section lock state). */
  meta?: string;
  /** Small leading glyph on the value line. */
  icon?: React.ReactNode;
  compact: boolean;
}

/** One cell of the two-column stat grid: label, value, and an optional meta line. */
export function StatGridCell({
  label,
  value,
  valueColor,
  meta,
  icon,
  compact,
}: StatGridCellProps) {
  return (
    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.15 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: compact ? TILE_LABEL_SIZE : undefined,
          lineHeight: 1.25,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, minWidth: 0 }}>
        {icon}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: compact ? TILE_VALUE_SIZE : undefined,
            lineHeight: 1.3,
            color: valueColor ?? 'text.primary',
            minWidth: 0,
          }}
        >
          {value}
        </Typography>
      </Box>
      {meta ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: compact ? TILE_META_SIZE : undefined, lineHeight: 1.25 }}
        >
          {meta}
        </Typography>
      ) : null}
    </Box>
  );
}

function ProgressMiniDot({
  status,
  fillRatio,
  compact,
}: {
  status: ProgressItem['status'];
  /** 0–1 partial fill for an in-progress dot; null/undefined fills it solid. */
  fillRatio?: number | null;
  compact: boolean;
}) {
  const theme = useTheme();
  const dim = compact ? theme.spacing(1.75) : theme.spacing(2);
  const fill =
    status === 'complete'
      ? theme.palette.success.main
      : status === 'partial'
        ? theme.palette.warning.main
        : 'transparent';
  const border =
    status === 'empty'
      ? `2px solid ${theme.palette.text.disabled}`
      : status === 'complete'
        ? 'none'
        : `2px solid ${theme.palette.warning.dark}`;

  // Fills from the bottom up, like a gauge, for a dot with a known completion share.
  const ratio =
    status === 'partial' && fillRatio != null && Number.isFinite(fillRatio)
      ? Math.min(1, Math.max(0, fillRatio))
      : null;
  const pctFilled = ratio != null ? Math.round(ratio * 100) : null;

  return (
    <Box
      sx={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        backgroundColor: pctFilled != null ? 'transparent' : fill,
        backgroundImage:
          pctFilled != null
            ? `linear-gradient(to top, ${fill} 0 ${pctFilled}%, transparent ${pctFilled}% 100%)`
            : 'none',
        border,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * The labelled dot row. Spans the tile's full width: every item flexes and `min-width: auto`
 * (default) keeps each label on one line, so the row spreads edge to edge without truncating.
 * Wrapping is the fallback on a narrow tile — a second row beats a clipped label or a scrollbar.
 */
export function DevelopmentProgressDots({
  progress,
  screenplayProgressRatio = null,
  compact,
}: {
  progress: ProgressItem[];
  /** 0–1 share of the target page count that is written; partially fills the Screenplay dot. */
  screenplayProgressRatio?: number | null;
  compact: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.5 : 0.75 }}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, fontSize: compact ? TILE_VALUE_SIZE : undefined }}
      >
        Development Progress:
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          columnGap: compact ? 0.35 : 1,
          rowGap: compact ? 0.75 : 1,
          width: '100%',
        }}
      >
        {progress.map((item) => (
          <Box
            key={item.label}
            sx={{
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: compact ? 0.4 : 0.35,
            }}
          >
            <ProgressMiniDot
              status={item.status}
              fillRatio={item.label === 'Screenplay' ? screenplayProgressRatio : null}
              compact={compact}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                fontSize: compact ? '0.7rem' : '0.72rem',
              }}
            >
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Pages-against-target bar. The label is drawn twice — once over the track and once clipped to the
 * fill — so it stays centered on the bar and legible on both sides of the fill edge at any
 * percentage. The inner copy is widened back to the bar's width (100/pct) to keep the copies aligned.
 */
export function PagesProgressBar({
  label,
  percent,
  compact,
}: {
  label: string;
  percent: number;
  compact: boolean;
}) {
  const theme = useTheme();
  const pct = Math.min(100, Math.max(0, percent));
  const trackBg = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.14 : 0.08);

  const labelSx = {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 'auto',
    width: '100%',
    px: compact ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: compact ? TILE_VALUE_SIZE : undefined,
    // The track clips its overflow, so the label rides a line box no taller than the bar.
    lineHeight: 1,
    whiteSpace: 'nowrap' as const,
    boxSizing: 'border-box' as const,
  };

  return (
    <Box
      sx={{
        position: 'relative',
        flexShrink: 0,
        height: `${PAGES_BAR_HEIGHT_PX}px`,
        borderRadius: 2,
        bgcolor: trackBg,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          bgcolor: theme.palette.success.main,
          borderRadius: 2,
          zIndex: 0,
        }}
      />
      <Typography
        variant="caption"
        sx={{ ...labelSx, color: theme.palette.getContrastText(trackBg), zIndex: 1 }}
      >
        {label}
      </Typography>
      {pct > 0 ? (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${pct}%`,
            overflow: 'hidden',
            zIndex: 2,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              ...labelSx,
              width: `${(100 / pct) * 100}%`,
              color: theme.palette.success.contrastText,
              textShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.35)}`,
            }}
          >
            {label}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
