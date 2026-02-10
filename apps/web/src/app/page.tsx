'use client';

import * as React from 'react';
import Image from 'next/image';
import { Box, Button, Container, Paper, Typography, useTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import { AppLogo } from '@/components/AppLogo';
import { useEffect, useState } from 'react';
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";
import { verifyAndLogin } from './actions/auth';
import { useUserProfileStore } from '@/state/user';
import GoogleIcon from '@mui/icons-material/Google';
import '@fontsource/varela-round';


export default function LandingPage() {
  const theme = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);

  const handleSignIn = () => {
    const provider = new GoogleAuthProvider();
    try {
      signInWithPopup(auth, provider).then((result) => {
        const userProfile = {
          user: result.user.uid,
          displayName: result.user.displayName,
          email: result.user.email,
        }
        setUserProfile(userProfile);
        result.user.getIdToken().then((idToken) => {
          verifyAndLogin(idToken).then((verifyResult) => {
            if (verifyResult?.status === "success") {
              router.push('/projects');
            }
            if (verifyResult?.error) {
              console.error("Sign-in verification failed:", verifyResult.error);
            }
          });
        });
      
        
      });
     
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  return (
    <Box
      sx={{
        overflow: 'hidden',
        padding: 1,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '100%',
        height: 'calc(100vh - 16px)',
        minHeight: 0,
        boxSizing: 'border-box',
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Top hero band */}
      <Box
        sx={{
          flex: '0 0 auto',
          flexShrink: 0,
          padding: 2,
          color: '#fff',
          background: 'linear-gradient(180deg, #13263c 0%, #0f2236 50%, #0c1b2d 100%)',
          borderRadius: 2,
          height: 300
        }}
      >
        <Container maxWidth={false} disableGutters sx={{ width: '100%', mx: 'auto', borderRadius: 2, display: 'flex', justifyContent: 
          'center', alignItems: 'center', alignContent: 'center', height: '100%'
          }}>

          <Box sx={{ position: 'absolute', top: 25, left: 25, display: 'flex', alignItems: 'center', gap: 1, opacity: 0.9 }}>
            <AppLogo size={45} color='secondary'/>
          </Box>

          <Box sx={{  display: 'flex', justifyContent: 'center', flexDirection: 'column', width: 'max-content', borderRadius: 2, textAlign: 'center' }}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 400,
                fontFamily: 'Garamond',
                letterSpacing: 3,
                fontSize: { xs: 34, sm: 42, md: 56 },
                lineHeight: 1.05,
              }}
            >
              Craft Your Masterpiece
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Varela Round',
                mt: 1.5,
                opacity: 0.9,
                fontSize: { xs: 14, sm: 16, md: 18 },
                maxWidth: 720,
                mx: 'auto',
              }}
            >
              The professional platform for narrative development.
              <br />
              Plan, collaborate, and create.
            </Typography>
          </Box>

        </Container>
      </Box>

      {/* Lower content */}
      <Container
        maxWidth={false}
        disableGutters
        sx={{
          flex: 1,
          minHeight: 0,
          maxWidth: '100%',
          mx: 'auto',
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 3 },
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 420px) 1fr' },
            gap: { xs: 3, md: 5 },
            alignItems: 'center',
            height: '100%',
            minHeight: 0,
          }}
        >
          {/* Left: sign in */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              width: '100%',
              maxWidth: 500,
              minHeight: 0,
              pr: { md: 2 },
            }}
          >
            <Typography
              variant="h4"
              sx={{ fontFamily: 'Garamond', letterSpacing: 2, fontWeight: 800, lineHeight: 1.05, mb: 1.5, fontSize: { xs: 28, md: 32 } }}
            >
              Where Structure
              <br />
              Meets Inspiration
            </Typography>

            <Typography sx={{ color: theme.palette.text.secondary, mb: 3, maxWidth: 360, fontFamily: 'Varela Round' }}>
              Capture your ideas, shape your story, and iterate with clarity—everything in one place.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, maxWidth: 280 }}>
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
                  //boxShadow: '0 8px 18px rgba(0,0,0,0.08)',
                  '&:hover': { backgroundColor: '#f5f6f7' },
                  fontSize: 16
                }}
              >
                Sign in with Google
              </Button>
            </Box>
          </Box>

          {/* Right: product preview - only on md+, contained so no overflow */}
          <Paper elevation={1}
            sx={{
              display: { xs: 'none', md: 'flex' },
              position: 'relative',
              borderRadius: 3,
              overflow: 'hidden',
              background: 'linear-gradient(180deg, #fbf6ea 0%, #f4efe4 100%)',
              height: '100%',
              minHeight: 0,
              maxWidth: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', height: '100%' }}>
              <Image
                src="/laptop-splash.png"
                alt="Writual app screenshot (top)"
                height={620}
                width={970}
                style={{ objectFit: 'contain' }}
              />
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

