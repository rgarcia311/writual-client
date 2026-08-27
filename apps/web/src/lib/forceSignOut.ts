'use client';

import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { logout } from '@/app/actions/auth';
import { useUserProfileStore } from '@/state/user';

let signingOut = false;

/**
 * Tears down a session the server has rejected: drops the Firebase session, clears the
 * persisted profile, deletes the auth cookies, and lands the user back on the home page.
 *
 * Navigation is a full page load rather than `router.replace`, because the cookies are what
 * the server renders from — a client-side navigation would keep the already-rendered authed
 * tree (and its stale data) mounted. The cookies are deleted *before* navigating, otherwise
 * `/` would immediately `redirect('/projects')` off the `user-id` cookie and bounce the user
 * straight back into the app they were just signed out of.
 */
export async function forceSignOut(): Promise<void> {
  // The id-token listener fires again as Firebase signs out, so without this a rejected
  // session could re-enter here mid-teardown.
  if (signingOut) return;
  signingOut = true;

  try {
    await signOut(getFirebaseAuth());
  } catch {
    // Best effort — the cookies cleared below are what actually gate the server.
  }

  useUserProfileStore.getState().setUserProfile(null);

  try {
    await logout();
  } catch {
    // Same: still navigate, so the user is not left inside an app they cannot use.
  }

  if (typeof window !== 'undefined') {
    window.location.replace('/');
  }
}
