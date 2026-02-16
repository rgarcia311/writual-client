'use client';

import { Button } from '@mui/material';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { verifyAndLogin } from '../../app/actions/auth';
import { useUserProfileStore } from '@/state/user';
import GoogleIcon from '@mui/icons-material/Google';

export function LandingSignIn() {
  const router = useRouter();
  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);

  const handleSignIn = () => {
    const provider = new GoogleAuthProvider();
    try {
      signInWithPopup(auth, provider).then((result) => {
        const userProfile = {
          user: result.user.uid,
          displayName: result.user.displayName,
          email: result.user.email,
        };
        setUserProfile(userProfile);
        result.user.getIdToken().then((idToken) => {
          verifyAndLogin(idToken).then((verifyResult) => {
            if (verifyResult?.status === 'success') {
              router.push('/projects');
            }
            if (verifyResult?.error) {
              console.error(
                'Sign-in verification failed:',
                verifyResult.error
              );
            }
          });
        });
      });
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  return (
    <Button
      onClick={handleSignIn}
      startIcon={<GoogleIcon />}
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
        '&:hover': { backgroundColor: '#f5f6f7' },
        fontSize: 16,
      }}
    >
      Sign in with Google
    </Button>
  );
}
