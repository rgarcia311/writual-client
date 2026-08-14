'use client';

import React from 'react';
import { Button, CircularProgress, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from 'firebase/auth';
import { verifyAndLogin } from '../../app/actions/auth';
import { useUserProfileStore } from '@/state/user';
import GoogleIcon from '@mui/icons-material/Google';
import { authRequest } from '@/lib/authRequest';
import { FINALIZE_SIGNUP } from '@/mutations/ShareMutations';
import { useSpatialRuntime } from '@/hooks/useIsSpatialEnvironment';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

/**
 * Popup sign-in cannot work inside a WebSpatial runtime. The SDK's SceneManager replaces
 * `window.open` (see `hijackWindowOpen` in @webspatial/core-sdk) and passes through only
 * `_self`/`_parent`/`_top`; Firebase opens its auth popup with `_blank`, so the call is routed
 * into `openSpatialSceneSync()` and returns a spatial-scene handle instead of a real popup
 * WindowProxy. Firebase then polls `popup.closed`, which is `undefined` on that object and
 * therefore never truthy — so `signInWithPopup` neither resolves nor rejects and the UI hangs
 * on "Verifying account…" forever.
 *
 * Redirect sign-in is a top-level navigation, so it never touches `window.open`. This is also
 * the generally-recommended flow for installed PWAs, hence keying on standalone too.
 */

/** Hard stop so a wedged auth handshake surfaces as an error instead of an endless spinner. */
const SIGN_IN_TIMEOUT_MS = 90_000

export function LandingSignIn() {
  const router = useRouter();
  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  // A redirect sign-in completes on the *next* page load, so the pending result has to be
  // claimed before the button is usable — otherwise a returning user sees "Sign in" again.
  const [checkingRedirect, setCheckingRedirect] = React.useState(true);

  const { isSpatial } = useSpatialRuntime();
  const { isStandalone } = useInstallPrompt();
  const mustUseRedirect = isSpatial || isStandalone;

  /** Shared post-authentication pipeline, identical for the popup and redirect paths. */
  const completeSignIn = React.useCallback(
    async (user: User) => {
      setUserProfile({
        user: user.uid,
        name: null,
        displayName: user.displayName,
        email: user.email,
        tier: 'beta-access' as const,
        settings: { colorMode: 'dark' as const },
      });

      const idToken = await user.getIdToken();
      const verifyResult = await verifyAndLogin(idToken);

      if (verifyResult?.status !== 'success') {
        throw new Error(verifyResult?.error ?? 'Verification failed');
      }

      try {
        await authRequest(FINALIZE_SIGNUP);
      } catch (err) {
        console.error('Failed to finalize signup:', err);
      }
      router.replace('/projects');
    },
    [router, setUserProfile],
  );

  // Claim a sign-in that was started by signInWithRedirect before we navigated away.
  React.useEffect(() => {
    let cancelled = false;

    getRedirectResult(getFirebaseAuth())
      .then(async (result) => {
        if (cancelled || !result) return;
        setIsSigningIn(true);
        await completeSignIn(result.user);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Redirect sign-in error:', err);
        setErrorMsg('Sign-in failed. Please try again.');
        setIsSigningIn(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingRedirect(false);
      });

    return () => {
      cancelled = true;
    };
  }, [completeSignIn]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    const provider = new GoogleAuthProvider();

    // Navigates away; the effect above finishes the job when we come back.
    if (mustUseRedirect) {
      try {
        await signInWithRedirect(getFirebaseAuth(), provider);
      } catch (err) {
        console.error('Redirect sign-in error:', err);
        setErrorMsg('Sign-in failed. Please try again.');
        setIsSigningIn(false);
      }
      return;
    }

    const timeout = setTimeout(() => {
      setErrorMsg('Sign-in timed out. Please try again.');
      setIsSigningIn(false);
    }, SIGN_IN_TIMEOUT_MS);

    try {
      const result = await signInWithPopup(getFirebaseAuth(), provider);
      await completeSignIn(result.user);
    } catch (err: any) {
      // User closed the popup or another popup error
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.error('Sign-in error:', err);
        setErrorMsg('Sign-in failed. Please try again.');
      }
      setIsSigningIn(false);
    } finally {
      clearTimeout(timeout);
    }
  };

  return (
    <>
      <Button
        onClick={() => void handleSignIn()}
        disabled={isSigningIn || checkingRedirect}
        startIcon={isSigningIn ? <CircularProgress size={18} sx={{ color: '#2d2d2d' }} /> : <GoogleIcon />}
        variant="contained"
        fullWidth
        sx={{
          textTransform: 'none',
          justifyContent: 'flex-start',
          px: 2,
          py: 1.25,
          borderRadius: 999,
          backgroundColor: '#ffffff',
          color: '#2d2d2d',
          width: 300,
          opacity: isSigningIn ? 0.5 : 1,
          '&:hover': { backgroundColor: '#f5f6f7' },
          '&.Mui-disabled': { backgroundColor: '#ffffff', color: '#2d2d2d' },
          fontSize: 16,
        }}
      >
        {isSigningIn ? 'Verifying account...' : 'Sign in with Google'}
      </Button>
      {errorMsg && (
        <Typography variant="caption" sx={{ color: 'error.main', mt: 1 }}>
          {errorMsg}
        </Typography>
      )}
    </>
  );
}