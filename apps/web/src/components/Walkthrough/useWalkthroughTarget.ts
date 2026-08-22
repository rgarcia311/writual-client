'use client';

import * as React from 'react';
import { TARGET_RESOLVE_TIMEOUT_MS } from './types';

export type TargetStatus = 'pending' | 'found' | 'missing';

export interface WalkthroughTarget {
  element: HTMLElement | null;
  /** Viewport-relative box of `element`, refreshed while it scrolls or resizes. */
  rect: DOMRect | null;
  status: TargetStatus;
}

const NO_TARGET: WalkthroughTarget = { element: null, rect: null, status: 'missing' };

/** Ignore an element that is present but not actually painted — a hidden tab panel, say. */
function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function query(selector: string): HTMLElement | null {
  const found = document.querySelector<HTMLElement>(selector);
  return found && isVisible(found) ? found : null;
}

/**
 * Resolves a step's target selector to a live element and keeps its rect current.
 *
 * The element is often not in the DOM the instant a step begins — the page may still be
 * fetching, or a route transition may be in flight — so this watches for it and only reports
 * `missing` after {@link TARGET_RESOLVE_TIMEOUT_MS}. Callers treat `missing` as "skip this step",
 * which is what lets the same script serve an account with no projects yet.
 */
export function useWalkthroughTarget(selector: string | undefined): WalkthroughTarget {
  const [element, setElement] = React.useState<HTMLElement | null>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [timedOut, setTimedOut] = React.useState(false);

  // Find the element, then keep watching: re-renders can swap the node out from under us.
  React.useEffect(() => {
    if (!selector) {
      setElement(null);
      setTimedOut(false);
      return;
    }

    setElement(null);
    setRect(null);
    setTimedOut(false);

    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const next = query(selector);
      setElement((current) => (current === next ? current : next));
    };

    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    // MutationObserver misses a node that becomes visible through CSS alone (a tab switching
    // from `hidden`), so a slow interval backs it up.
    const interval = window.setInterval(check, 250);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [selector]);

  // The miss clock runs only while nothing is resolved, and restarts every time the element comes
  // back. A target that merely re-mounts mid-render therefore never reads as gone — only one that
  // stays absent for the whole grace period does.
  React.useEffect(() => {
    if (!selector || element) {
      setTimedOut(false);
      return;
    }
    const timeout = window.setTimeout(() => setTimedOut(true), TARGET_RESOLVE_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [selector, element]);

  // Bring the target into view once, then track its box for as long as it is the target.
  React.useEffect(() => {
    if (!element) {
      setRect(null);
      return;
    }

    element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });

    let frame = 0;
    let previous = '';
    // Polling on rAF rather than listening for scroll/resize: the spotlight has to stay glued to
    // targets that move for reasons no event reports — a sidebar collapsing, a dialog animating
    // in, content loading above them. The write is skipped unless the box actually changed.
    const track = () => {
      const next = element.getBoundingClientRect();
      const key = `${next.top},${next.left},${next.width},${next.height}`;
      if (key !== previous) {
        previous = key;
        setRect(next);
      }
      frame = window.requestAnimationFrame(track);
    };
    track();

    return () => window.cancelAnimationFrame(frame);
  }, [element]);

  if (!selector) return NO_TARGET;
  if (element && rect) return { element, rect, status: 'found' };
  return { element: null, rect: null, status: timedOut ? 'missing' : 'pending' };
}
