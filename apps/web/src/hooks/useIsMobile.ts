'use client'

import useMediaQuery from '@mui/material/useMediaQuery'
import { MOBILE_MEDIA_QUERY } from '@/lib/breakpoints'

export { MOBILE_MAX_WIDTH_PX, MOBILE_MEDIA_QUERY, DESKTOP_MEDIA_QUERY } from '@/lib/breakpoints'

/**
 * SSR-safe: the server has no viewport, so the first render always reports desktop and the hook
 * flips after hydration. Callers must stay renderable in both states — never gate data fetching
 * or hook order on this value, and prefer a CSS media query wherever markup need not differ.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY, { defaultMatches: false })
}
