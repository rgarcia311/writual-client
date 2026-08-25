/**
 * Spacing between a tab strip and the content it switches.
 *
 * One value for every page with tabs above cards — the projects list, the characters grid, the
 * outline — so the seam reads the same everywhere. See
 * `.cursor/rules/tabs-content-spacing.mdc`.
 */

/** MUI spacing units (theme.spacing(2) = 16px). */
export const TABS_CONTENT_GAP = 2;

/** Drop-in `sx` for the tab strip itself. */
export const TABS_CONTENT_GAP_SX = { mb: TABS_CONTENT_GAP } as const;
