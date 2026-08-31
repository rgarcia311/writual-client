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

/** Matches the Project Details card's title (`subtitle1`, 1rem) so every hero card reads alike. */
export const TILE_HEADING_SIZE = '1rem';
/**
 * 12pt (16px) floor — nothing on a stat card prints smaller than this, compact or not. The tiles
 * are a fixed height either way (`--project-float-hero-card-height`), so type that no longer fits
 * scrolls inside the tile rather than growing the card.
 */
export const TILE_MIN_SIZE = '1rem';
export const TILE_VALUE_SIZE = TILE_MIN_SIZE;
export const TILE_LABEL_SIZE = TILE_MIN_SIZE;
export const TILE_META_SIZE = TILE_MIN_SIZE;

/** Slim bar — tall enough for the 16px label, short enough not to dominate the tile. */
export const PAGES_BAR_HEIGHT_PX = 22;

/**
 * The tiles share one spacing rhythm so their rows line up with each other across a card row: the
 * heading sits at the same height in every card, and what follows starts at the same offset under
 * it. Individual tiles pick from these rather than choosing their own values.
 */

/** Between a tile's heading and its content, and between the blocks of content under it. */
export const tileStackGap = (compact: boolean) => (compact ? 0.5 : 1);

/** Between repeated rows inside a block — list items, grid rows. Tighter than the block gap. */
export const tileRowGap = (compact: boolean) => (compact ? 0.5 : 0.75);

/**
 * The trailing glyph in a tile heading. One size for all of them: an outsized icon would push its
 * own card's heading taller than the rest and put that card's content a row out of step.
 */
export const tileIconSx = (compact: boolean) => ({
  fontSize: compact ? 18 : 22,
  color: 'text.secondary' as const,
});

/**
 * The root stack a stat tile is built on: a fixed header holding the title, and the tile's content
 * in a scroller under it. The header is outside that scroller, so it cannot move — however long
 * the content runs, and wherever the reader has scrolled to, the title stays where it is.
 *
 * Horizontal inset sits on the two halves rather than on this stack, so that a row painting a
 * background (the next deadline, a hovered row) can bleed out past the text into the scroller's
 * own padding instead of overflowing it and being clipped. There is no vertical inset: the card's
 * own padding is the top gap, which is what puts every tile's heading on the same line.
 */
export function StatTileStack({
  compact,
  heading,
  children,
}: {
  compact: boolean;
  /** The tile's title row — a `TileHeading`. Held out of the scroller. */
  heading: React.ReactNode;
  children: React.ReactNode;
}) {
  const gap = tileStackGap(compact);
  const inset = compact ? 0.5 : 0;

  return (
    <Box
      className="stat-tile"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        gap,
      }}
    >
      <Box className="stat-tile__header" sx={{ flexShrink: 0, minWidth: 0, px: inset }}>
        {heading}
      </Box>
      {/* `min-height: 0` is what lets this shrink below its content and scroll rather than pushing
          the tile taller; vertical only, so a wide row still wraps or clips as it did before. */}
      <Box
        className="stat-tile__body"
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          px: inset,
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          display: 'flex',
          flexDirection: 'column',
          gap,
          // Content keeps its own height and scrolls; without this a flex child would be squeezed
          // to fit the body instead, and the tile would silently compress rather than scroll.
          '& > *': { flexShrink: 0 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/**
 * Header row: tile title plus an optional trailing icon. Goes in `StatTileStack`'s `heading` slot,
 * which is what keeps it out of the scrolling half of the tile.
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
      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          fontSize: TILE_HEADING_SIZE,
          lineHeight: compact ? 1.25 : undefined,
        }}
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
          fontSize: TILE_LABEL_SIZE,
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
            fontSize: TILE_VALUE_SIZE,
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
          sx={{ fontSize: TILE_META_SIZE, lineHeight: 1.25 }}
        >
          {meta}
        </Typography>
      ) : null}
    </Box>
  );
}

/** One development-phase dot. Shared by the stat tile row and the breadcrumb-bar row. */
export function ProgressMiniDot({
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
    fontSize: TILE_VALUE_SIZE,
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
