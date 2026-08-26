import Image from 'next/image';
import { Box, Container, Paper, Typography } from '@mui/material';
import { AppLogo } from '@/components/AppLogo';
import { LandingSignIn } from '@/components/LandingSignIn/LandingSignIn';
import { PricingTiers } from '@/components/PricingTiers';
import MuiLink from '@mui/material/Link';
import '@fontsource/varela-round';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MOBILE_MEDIA_QUERY } from '@/lib/breakpoints';

export default async function LandingPage() {
  const cookieStore = await cookies();
  if (cookieStore.get('user-id')) {
    redirect('/projects');
  }
  return (
    <Box
      sx={{
        // Fixed outer frame. The scrolling happens in the child below, not here, so the sticky
        // hero can pin flush to the scrollport instead of leaving this frame's padding as a gap
        // that scrolling content shows through.
        padding: 1,
        pb: 0,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '100%',
        // Only the 8px top padding is left to subtract now that the bottom is gone.
        height: 'calc(100vh - 8px)',
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
        backgroundColor: 'background.default',
        [`@media ${MOBILE_MEDIA_QUERY}`]: {
          height: 'calc(100dvh - 8px)',
        },
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollBehavior: 'smooth',
        }}
      >
        {/* First screen. Sticky is bounded by its own parent's box, so this wrapper is what makes
            the hero unpin: it holds only the hero and the content meant to slide under it, and once
            its bottom edge reaches the top the tier section below pushes the hero off. No
            `overflow` here — a clipping ancestor would cancel the sticky positioning entirely. */}
        <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Top hero band — pinned until the wrapper above runs out. */}
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              // Above the tier cards, whose featured card raises itself to 2.
              zIndex: 10,
              flexShrink: 0,
              padding: 2,
              color: '#fff',
              background:
                'linear-gradient(180deg, #13263c 0%, #0f2236 50%, #0c1b2d 100%)',
              borderRadius: 2,
              height: { xs: 200, sm: 300 },
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
              flexShrink: 0,
              // What `flex: 1` used to resolve to: the viewport minus the frame's 8px top padding
              // and the 300px hero. Auto on phones, where the hero is shorter and this stacks.
              height: { xs: 'auto', sm: 'calc(100vh - 308px)' },
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
                  {/* Plain hash link rather than a click handler, so this stays a server
                      component and the jump still works with JavaScript disabled. */}
                  <MuiLink
                    href="#pricing"
                    color="primary"
                    underline="hover"
                    sx={{ fontSize: 14, alignSelf: 'flex-start' }}
                  >
                    Don&apos;t have an account? Sign up
                  </MuiLink>
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

        {/* Signed-in visitors never reach this far — the cookie check above redirects them first. */}
        <Box id="pricing" sx={{ flexShrink: 0, scrollMarginTop: 0 }}>
          <PricingTiers />
        </Box>
      </Box>
    </Box>
  );
}
