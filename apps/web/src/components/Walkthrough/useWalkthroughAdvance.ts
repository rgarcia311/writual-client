'use client';

import * as React from 'react';
import type { WalkthroughAction } from './types';

function exists(selector: string): boolean {
  return document.querySelector(selector) != null;
}

/**
 * Watches for the result of the interaction a step asked for and calls `onAdvance` once it lands.
 *
 * This is what makes the tour able to explain UI that only exists after a click: the "ask" step
 * hands control back to the user, and the moment the route changes or the new element mounts, the
 * next step is already pointing at it.
 */
export function useWalkthroughAdvance(
  action: WalkthroughAction | undefined,
  pathname: string | null,
  onAdvance: () => void,
): void {
  // Kept in a ref so the watcher effect isn't torn down and rebuilt on every parent render.
  const advanceRef = React.useRef(onAdvance);
  advanceRef.current = onAdvance;

  const navigateRoute = action?.type === 'navigate' ? action.route : null;
  const appearSelector = action?.type === 'appear' ? action.selector : null;
  const disappearSelector = action?.type === 'disappear' ? action.selector : null;

  // Navigation: the step is only satisfied by a path *change*, so the route the user is standing
  // on when the step opens can't immediately fulfil it. The entry path is latched during render
  // for the current action, before any effect can observe a change.
  const armedFor = React.useRef<RegExp | null>(null);
  const entryPathname = React.useRef<string | null>(null);
  if (navigateRoute !== armedFor.current) {
    armedFor.current = navigateRoute;
    entryPathname.current = pathname;
  }

  React.useEffect(() => {
    if (!navigateRoute || !pathname) return;
    if (pathname === entryPathname.current) return;
    if (navigateRoute.test(pathname)) advanceRef.current();
  }, [navigateRoute, pathname]);

  // Appearance / disappearance of a node. `disappear` arms only after the node has been seen, so
  // a step can't self-complete during the frame before its dialog has mounted.
  React.useEffect(() => {
    const selector = appearSelector ?? disappearSelector;
    if (!selector) return;

    let seen = false;
    let done = false;

    const check = () => {
      if (done) return;
      const present = exists(selector);
      if (appearSelector && present) {
        done = true;
        advanceRef.current();
        return;
      }
      if (disappearSelector) {
        if (present) seen = true;
        else if (seen) {
          done = true;
          advanceRef.current();
        }
      }
    };

    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(check, 200);

    return () => {
      done = true;
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [appearSelector, disappearSelector]);
}
