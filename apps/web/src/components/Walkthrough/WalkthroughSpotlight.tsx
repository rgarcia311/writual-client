'use client';

import * as React from 'react';
import Box from '@mui/material/Box';

export interface WalkthroughSpotlightProps {
  /** Viewport box to leave uncovered. Null dims the whole screen (welcome / finish cards). */
  rect: DOMRect | null;
  padding?: number;
}

const SCRIM = 'rgba(8, 10, 16, 0.62)';
const RADIUS = 10;

/**
 * Dims the page around the current target.
 *
 * Built from four panels framing the target rather than one sheet with a cut-out, because the
 * hole has to stay genuinely clickable — the interaction-gated steps depend on the user being
 * able to press the very button the tour is pointing at.
 *
 * The panels swallow clicks without ending the tour. A step that asks the user to click something
 * would be far too easy to lose to a stray click on the dimmed page; leaving is the X button or
 * Escape, both of which are deliberate.
 */
export function WalkthroughSpotlight({ rect, padding = 8 }: WalkthroughSpotlightProps) {
  const panel = { position: 'fixed' as const, bgcolor: SCRIM };

  if (!rect) {
    return <Box sx={{ ...panel, inset: 0 }} />;
  }

  const top = Math.max(0, rect.top - padding);
  const left = Math.max(0, rect.left - padding);
  const right = Math.min(window.innerWidth, rect.right + padding);
  const bottom = Math.min(window.innerHeight, rect.bottom + padding);

  return (
    <>
      <Box sx={{ ...panel, top: 0, left: 0, right: 0, height: top }} />
      <Box sx={{ ...panel, top: bottom, left: 0, right: 0, bottom: 0 }} />
      <Box sx={{ ...panel, top, left: 0, width: left, height: bottom - top }} />
      <Box sx={{ ...panel, top, left: right, right: 0, height: bottom - top }} />
      {/* Ring around the live element. Non-interactive so clicks reach what it is highlighting. */}
      <Box
        sx={{
          position: 'fixed',
          top,
          left,
          width: right - left,
          height: bottom - top,
          borderRadius: `${RADIUS}px`,
          border: 2,
          borderColor: 'primary.main',
          boxShadow: '0 0 0 4px rgba(255,255,255,0.16)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
