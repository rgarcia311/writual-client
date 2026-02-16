import type { SxProps, Theme } from '@mui/material/styles';

/** Single-line truncation with ellipsis */
export const singleLineTruncate: SxProps<Theme> = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/**
 * Multi-line truncation with ellipsis after N lines (webkit).
 * Use for block elements (e.g. Typography, Box).
 */
export function multiLineTruncate(lineClamp: number): SxProps<Theme> {
  return {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: lineClamp,
    WebkitBoxOrient: 'vertical' as const,
  };
}
