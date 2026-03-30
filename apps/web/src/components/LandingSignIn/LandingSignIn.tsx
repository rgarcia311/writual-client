'use client';

import React from 'react';
import { Button, CircularProgress, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { verifyAndLogin } from '../../app/actions/auth';
import { useUserProfileStore } from '@/state/user';
import GoogleIcon from '@mui/icons-material/Google';
import { authRequest } from '@/lib/authRequest';
import { FINALIZE_SIGNUP } from '@/mutations/ShareMutations';

export function LandingSignIn() {
  const router = useRouter();
  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleSignIn = () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    const provider = new GoogleAuthProvider();

    signInWithPopup(auth, provider)
      .then((result) => {
        const userProfile = {
          user: result.user.uid,
          name: null,
          displayName: result.user.displayName,
          email: result.user.email,
          tier: 'beta-access' as const,
          settings: { colorMode: 'dark' as const },
        };
        setUserProfile(userProfile);

        React.startTransition(async () => {
          try {
            const idToken = await result.user.getIdToken();
            const verifyResult = await verifyAndLogin(idToken);

            if (verifyResult?.status === 'success') {
              try {
                await authRequest(FINALIZE_SIGNUP);
              } catch (err) {
                console.error('Failed to finalize signup:', err);
              }
              router.replace('/projects');
            } else {
              throw new Error(verifyResult?.error ?? 'Verification failed');
            }
          } catch (err) {
            console.error('Sign-in error:', err);
            setErrorMsg('Sign-in failed. Please try again.');
            setIsSigningIn(false);
          }
        });
      })
      .catch((err) => {
        // User closed the popup or another popup error
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
          console.error('Popup error:', err);
          setErrorMsg('Sign-in failed. Please try again.');
        }
        setIsSigningIn(false);
      });
  };

  return (
    <>
      <Button
        onClick={handleSignIn}
        disabled={isSigningIn}
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