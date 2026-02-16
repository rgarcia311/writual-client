import type { SxProps, Theme } from '@mui/material/styles';

/** Base flat accordion: no shadow, no :before line, no expanded margin */
export const accordionFlat: SxProps<Theme> = {
  boxShadow: 'none',
  overflow: 'visible',
  '&:before': { display: 'none' },
  '&.Mui-expanded': { margin: 0 },
};

/**
 * Bordered accordion summary/panel style (border, radius, optional background).
 * Use for Act, Unassigned, or step headers and bordered AccordionDetails.
 */
export function getAccordionSummaryBordered(
  theme: Theme,
  options?: { backgroundColor?: 'default' | 'paper' }
): SxProps<Theme> {
  const bg = options?.backgroundColor ?? 'default';
  return {
    border: '1px solid',
    borderColor: theme.palette.divider,
    borderRadius: '8px',
    mb: 1,
    ...(bg === 'default' && { backgroundColor: theme.palette.background.default }),
    ...(bg === 'paper' && { backgroundColor: theme.palette.background.paper }),
  };
}

/** Bordered accordion details panel (border, radius). */
export function getAccordionDetailsBordered(theme: Theme): SxProps<Theme> {
  return {
    border: '1px solid',
    borderColor: theme.palette.divider,
    borderRadius: '8px',
  };
}
