'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import { SET_WALKTHROUGH_DISMISSED } from '@/mutations/UserMutations';
import { useUserProfileStore } from '@/state/user';

export interface UseWalkthroughDismissedResult {
  /**
   * True once the user has turned the walkthrough off, false when it should still greet them, and
   * `undefined` while the profile is optimistic and the server copy has not arrived yet.
   */
  dismissed: boolean | undefined;
  /** Writes the flag to the user document and mirrors it into the local profile. */
  setDismissed: (value: boolean) => void;
  /** No signed-in user — nothing to save against. */
  canPersist: boolean;
}

/**
 * The `settings.walkthroughDismissed` flag on the user document: the single answer to whether the
 * intro walkthrough greets this account on login. Stored server-side rather than in localStorage
 * so turning it off follows the user to any browser they sign in from.
 */
export function useWalkthroughDismissed(): UseWalkthroughDismissedResult {
  const userId = useUserProfileStore((s) => s.userProfile?.user ?? null);
  const dismissed = useUserProfileStore((s) => s.userProfile?.settings?.walkthroughDismissed);
  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);

  const writeLocal = React.useCallback(
    (value: boolean) => {
      const { userProfile } = useUserProfileStore.getState();
      if (!userProfile) return;
      setUserProfile({
        ...userProfile,
        settings: { ...userProfile.settings, walkthroughDismissed: value },
      });
    },
    [setUserProfile],
  );

  const { mutate } = useMutation({
    mutationFn: (value: boolean) =>
      authRequest<{ setWalkthroughDismissed: boolean }>(SET_WALKTHROUGH_DISMISSED, {
        dismissed: value,
      }),
  });

  const setDismissed = React.useCallback(
    (value: boolean) => {
      if (!userId) return;
      const previous = useUserProfileStore.getState().userProfile?.settings?.walkthroughDismissed;
      // Painted straight away — the checkbox must not lag behind the click — and rolled back if
      // the write never lands, so the flag can't read as saved when it isn't.
      writeLocal(value);
      mutate(value, {
        onError: (error) => {
          console.error('[useWalkthroughDismissed] failed to save walkthrough preference', error);
          if (previous !== undefined) writeLocal(previous);
        },
      });
    },
    [userId, writeLocal, mutate],
  );

  return { dismissed, setDismissed, canPersist: Boolean(userId) };
}
