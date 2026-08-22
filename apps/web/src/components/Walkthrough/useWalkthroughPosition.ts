'use client';

import * as React from 'react';
import { computePosition, flip, shift, offset, type Placement } from '@floating-ui/dom';

export interface CardPosition {
  top: number;
  left: number;
}

const VIEWPORT_MARGIN = 12;
const TARGET_GAP = 14;

/**
 * Places the tour card beside the spotlit rect, flipping and sliding it to stay on screen.
 * With no rect (welcome / finish) the card is centred instead.
 */
export function useWalkthroughPosition(
  rect: DOMRect | null,
  placement: Placement | undefined,
  cardElement: HTMLElement | null,
): CardPosition | null {
  const [position, setPosition] = React.useState<CardPosition | null>(null);

  React.useEffect(() => {
    if (!cardElement) return;

    let cancelled = false;

    if (!rect) {
      const { width, height } = cardElement.getBoundingClientRect();
      setPosition({
        top: Math.max(VIEWPORT_MARGIN, (window.innerHeight - height) / 2),
        left: Math.max(VIEWPORT_MARGIN, (window.innerWidth - width) / 2),
      });
      return;
    }

    // floating-ui works from a rect, so the spotlit box is handed over as a virtual reference
    // instead of the element itself — the caller already keeps that rect current.
    const virtualReference = {
      getBoundingClientRect: () => rect,
    };

    computePosition(virtualReference, cardElement, {
      strategy: 'fixed',
      placement: placement ?? 'bottom',
      middleware: [
        offset(TARGET_GAP),
        flip({ padding: VIEWPORT_MARGIN }),
        shift({ padding: VIEWPORT_MARGIN }),
      ],
    }).then(({ x, y }) => {
      if (!cancelled) setPosition({ top: y, left: x });
    });

    return () => {
      cancelled = true;
    };
  }, [rect, placement, cardElement]);

  return position;
}
