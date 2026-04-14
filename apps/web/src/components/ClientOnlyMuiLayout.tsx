'use client';

import * as React from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { request } from 'graphql-request';
import { getFirebaseAuth } from '@/lib/firebase';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { ME_QUERY } from '@/queries/UserQueries';
import { useUserProfileStore } from '@/state/user';
import { verifyAndLogin } from '@/app/actions/auth';

/**
 * Renders children only after mount. Use in root layout to avoid MUI/Emotion
 * hydration mismatch (server vs client style injection order).
 *
 * Also hosts the global Firebase auth state listener that hydrates the Zustand
 * user store (including tier) on every page load and login/logout event.
 */
export function ClientOnlyMuiLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);

  React.useEffect(() => {
    setMounted(true);

    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (!firebaseUser) {
        setUserProfile(null);
        return;
      }

      const idToken = await firebaseUser.getIdToken();

      verifyAndLogin(idToken).catch(() => {});

      // Set immediately — full beta-access optimistically, no flicker
      setUserProfile({
        user: firebaseUser.uid,
        name: null,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        tier: 'beta-access',
        settings: { colorMode: 'dark' },
      });

      // Sync with DB — updates tier/settings/name with confirmed values
      try {
        const data: any = await request(
          GRAPHQL_ENDPOINT,
          ME_QUERY,
          { displayName: firebaseUser.displayName, name: firebaseUser.displayName },
          { Authorization: `Bearer ${idToken}` }
        );
        setUserProfile({
          user: firebaseUser.uid,
          name: data.me.name,
          displayName: data.me.displayName ?? firebaseUser.displayName,
          email: firebaseUser.email,
          tier: data.me.tier,
          settings: data.me.settings,
        });
      } catch {
        // optimistic state remains — user keeps beta-access
      }
    });

    return () => unsubscribe();
  }, [setUserProfile]);

  if (!mounted) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '100vw',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      />
    );
  }
  return <>{children}</>;
}
