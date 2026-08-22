'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useUserProfileStore } from '@/state/user';
import { useWalkthroughStore } from '@/state/walkthrough';
import { useWalkthroughDismissed } from '@/hooks/useWalkthroughDismissed';
import { WalkthroughOverlay } from './WalkthroughOverlay';

/** Where a fresh sign-in lands; the tour greets the user there rather than mid-project. */
const LOGIN_LANDING_ROUTE = /^\/projects\/?$/;

/**
 * Decides when the intro walkthrough runs and owns the "don't show this again" flag.
 *
 * Mounted once in the root layout. It starts the tour for a signed-in user whose account has not
 * dismissed it yet, and otherwise stays out of the way — a manual replay from Settings goes
 * through the same store and renders the same overlay.
 */
export function WalkthroughProvider() {
  const pathname = usePathname();
  const userId = useUserProfileStore((s) => s.userProfile?.user ?? null);
  const active = useWalkthroughStore((s) => s.active);
  const start = useWalkthroughStore((s) => s.start);
  const stop = useWalkthroughStore((s) => s.stop);
  const { dismissed, setDismissed, canPersist } = useWalkthroughDismissed();

  // One auto-start per signed-in session. Closing the tour without ticking the box leaves the
  // account flag alone — it returns on the next login, but not on the next route change.
  const autoStartedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!userId) {
      autoStartedFor.current = null;
      return;
    }
    if (autoStartedFor.current === userId) return;
    // `undefined` means the profile is still optimistic; waiting for the server copy avoids
    // flashing the tour at a returning user who already turned it off.
    if (dismissed !== false) return;
    if (!pathname || !LOGIN_LANDING_ROUTE.test(pathname)) return;

    autoStartedFor.current = userId;
    start();
  }, [userId, dismissed, pathname, start]);

  // Signing out closes anything still on screen.
  React.useEffect(() => {
    if (!userId && active) stop();
  }, [userId, active, stop]);

  const handleFinish = React.useCallback(
    (outcome: 'completed' | 'closed') => {
      stop();
      // Reaching the end counts as having seen it; closing part-way does not, so the tour is
      // there again next login unless the box was ticked.
      if (outcome === 'completed' && canPersist && dismissed !== true) setDismissed(true);
    },
    [stop, canPersist, dismissed, setDismissed],
  );

  if (!active) return null;

  return (
    <WalkthroughOverlay
      onFinish={handleFinish}
      dontShowAgain={dismissed === true}
      onDontShowAgainChange={setDismissed}
    />
  );
}
