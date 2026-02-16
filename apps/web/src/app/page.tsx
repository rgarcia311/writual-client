import Image from 'next/image';
import { Box, Container, Paper, Typography } from '@mui/material';
import { AppLogo } from '@/components/AppLogo';
import { LandingSignIn } from '@/components/LandingSignIn/LandingSignIn';
import '@fontsource/varela-round';

export default function LandingPage() {
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
        backgroundColor: 'background.default',
      }}
    >
      {/* Top hero band */}
      <Box
        sx={{
          flex: '0 0 auto',
          flexShrink: 0,
          padding: 2,
          color: '#fff',
          background:
            'linear-gradient(180deg, #13263c 0%, #0f2236 50%, #0c1b2d 100%)',
          borderRadius: 2,
          height: 300,
        }}
      >
        <Container
          maxWidth={false}
          disableGutters
          sx={{
            width: '100%',
            mx: 'auto',
            borderRadius: 2,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            alignContent: 'center',
            height: '100%',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 25,
              left: 25,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              opacity: 0.9,
            }}
          >
            <AppLogo size={45} color="secondary" />
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              flexDirection: 'column',
              width: 'max-content',
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
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
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
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
              sx={{
                fontFamily: 'Garamond',
                letterSpacing: 2,
                fontWeight: 800,
                lineHeight: 1.05,
                mb: 1.5,
                fontSize: { xs: 28, md: 32 },
              }}
            >
              Where Structure
              <br />
              Meets Inspiration
            </Typography>

            <Typography
              sx={{
                color: 'text.secondary',
                mb: 3,
                maxWidth: 360,
                fontFamily: 'Varela Round',
              }}
            >
              Capture your ideas, shape your story, and iterate with
              clarity—everything in one place.
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                maxWidth: 280,
              }}
            >
              <LandingSignIn />
            </Box>
          </Box>

          {/* Right: product preview - only on md+, contained so no overflow */}
          <Paper
            elevation={1}
            sx={{
              display: { xs: 'none', md: 'flex' },
              position: 'relative',
              borderRadius: 3,
              overflow: 'hidden',
              background:
                'linear-gradient(180deg, #fbf6ea 0%, #f4efe4 100%)',
              height: '100%',
              minHeight: 0,
              maxWidth: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }}
            >
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
