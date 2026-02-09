'use client';

import * as React from 'react';
import Image from 'next/image';
import { Box, Button, Container, Typography, useTheme } from '@mui/material';
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

  const setUserStore = useUserProfileStore((s) => s.setUser);

  const handleSignIn = () => {
    const provider = new GoogleAuthProvider();
    try {
      signInWithPopup(auth, provider).then((result) => {
        setUserStore(result.user);
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
    <Box sx={{ overflowY: 'hidden', padding: 1, display: 'flex', flexDirection: 'column', width: '100vw', minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
      {/* Top hero band */}
      <Box
        sx={{
          maxWidth: '100%',
          flex: .40,
          padding: 2,
          color: '#fff',
          background: 'linear-gradient(180deg, #13263c 0%, #0f2236 50%, #0c1b2d 100%)',
          borderBottomLeftRadius: { xs: 0, md: 10 },
          borderBottomRightRadius: { xs: 0, md: 10 },
        }}
      >
        <Container maxWidth={false} disableGutters sx={{ width: '100%', minHeight: '100%', mx: 'auto' }}>
          <Box sx={{ position: 'absolute', top: 25, left: 25, display: 'flex', alignItems: 'center', gap: 1, opacity: 0.9 }}>
            <AppLogo size={45}color='secondary' logoPath='/logo_original.png' />
          </Box>

          <Box sx={{  mt: { xs: 5, md: 7 }, textAlign: 'center' }}>
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
      <Container maxWidth={false} disableGutters sx={{ flex: 1, maxWidth: "100%", mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '420px 1fr' },
            gap: { xs: 3, md: 5 },
            alignItems: 'center',
          }}
        >
          {/* Left: sign in */}
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'left', width: 500, height: 500, pr: { md: 2 } }}>
        

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
                  boxShadow: '0 8px 18px rgba(0,0,0,0.08)',
                  '&:hover': { backgroundColor: '#f5f6f7' },
                }}
              >
                Sign in with Google
              </Button>

              
            </Box>
          </Box>

          {/* Right: product preview */}
          <Box
            sx={{
              position: 'absolute',
              right: 100,
              bottom: 50,
              borderRadius: 3,
              overflow: 'hidden',
              background: 'linear-gradient(180deg, #fbf6ea 0%, #f4efe4 100%)',
              border: '1px solid rgba(30, 41, 59, 0.08)',
              boxShadow: '0 18px 48px rgba(15, 23, 42, 0.10)',
              minHeight: { xs: 340, md: 700 },
              width: 1100
            }}
          >
            <Box sx={{ position: 'absolute', inset: 0, p: { xs: 2.5, md: 3 } }}>
              {/* Screenshot cluster */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: { xs: 20, md: 26 },
                    left: { xs: 18, md: 30 },
                    width: { xs: '72%', md: '64%' },
                    height: { xs: 150, md: 180 },
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: '#fff',
                    border: '1px solid rgba(15, 23, 42, 0.16)',
                    boxShadow: '0 12px 26px rgba(0,0,0,0.10)',
                  }}
                >
                  <Image
                    src="/images/landing/top-screenshot.svg"
                    alt="Writual app screenshot (top)"
                    fill
                    sizes="(max-width: 900px) 70vw, 520px"
                    style={{ objectFit: 'cover' }}
                    priority
                  />
                </Box>

                <Box
                  sx={{
                    position: 'absolute',
                    bottom: { xs: 26, md: 34 },
                    left: { xs: 86, md: 140 },
                    width: { xs: '58%', md: '54%' },
                    height: { xs: 160, md: 190 },
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: '#fff',
                    border: '1px solid rgba(15, 23, 42, 0.16)',
                    boxShadow: '0 12px 26px rgba(0,0,0,0.10)',
                  }}
                >
                  <Image
                    src="/images/landing/bottom-screenshot.svg"
                    alt="Writual app screenshot (bottom)"
                    fill
                    sizes="(max-width: 900px) 60vw, 460px"
                    style={{ objectFit: 'cover' }}
                    priority
                  />
                </Box>

                {/* Labels */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: { xs: 42, md: 58 },
                    right: { xs: 14, md: 26 },
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: '#7b4b3a',
                    fontWeight: 800,
                    opacity: 0.92,
                  }}
                >
                  <Typography sx={{ fontWeight: 800 }}>Structure</Typography>
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    left: { xs: 18, md: 30 },
                    bottom: { xs: 46, md: 64 },
                    color: '#7b4b3a',
                  }}
                >
                  <Typography sx={{ fontWeight: 800 }}>Develop</Typography>
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    right: { xs: 18, md: 30 },
                    bottom: { xs: 82, md: 108 },
                    color: '#7b4b3a',
                  }}
                >
                  <Typography sx={{ fontWeight: 800 }}>Refine</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

