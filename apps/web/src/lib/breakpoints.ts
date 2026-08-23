/**
 * Shared responsive breakpoints.
 *
 * No `'use client'` here on purpose: these are plain constants, so async server components
 * (e.g. the landing page) can interpolate them into `sx` without pulling a client module
 * into the server graph. `hooks/useIsMobile.ts` re-exports them for client callers.
 *
 * Kept in sync with `styles/mobileLayout.css` — change both together.
 */

/** Phones and small tablets in portrait; below MUI's `md`, above its `sm`. */
export const MOBILE_MAX_WIDTH_PX = 767.95;

export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

/** Complement of {@link MOBILE_MEDIA_QUERY} — the width at which desktop chrome takes over. */
export const DESKTOP_MEDIA_QUERY = `(min-width: ${MOBILE_MAX_WIDTH_PX + 0.05}px)`;
