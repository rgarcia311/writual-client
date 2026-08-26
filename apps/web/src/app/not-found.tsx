import { Box, Typography } from '@mui/material';
import { ButtonLink } from '@/components/ButtonLink';

const SLATE = '#2A2D34';
const SLATE_TEXT = '#FFFFFA';

/**
 * Root `not-found.tsx`, so every unmatched route (and any `notFound()` call that
 * bubbles up to the root) lands here instead of Next's default page. It renders
 * inside `RootLayoutClient`, which keeps the top bar — the logo stays a way home,
 * this is just a dead end in the middle of it.
 *
 * Create Project and settings are hidden here: neither has anything to act on from
 * a dead URL. It is done with a stylesheet rather than a prop or a store flag
 * because the layout renders the bar above this page and cannot know a 404 is
 * coming — the route is arbitrary. A flag set from an effect would let the buttons
 * paint first on a direct hit, which is the common way to reach this page. The
 * `<style>` ships in the same SSR response and unmounts with the page.
 */
export default function NotFound() {
  return (
    <>
      <style>{'[data-app-bar-actions] { display: none !important; }'}</style>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          minHeight: 0,
          width: '100%',
          overflow: 'auto',
          px: 3,
          py: 6,
          textAlign: 'center',
        }}
      >
        {/*
          Clapperboard slate: the striped bar is the clapper, the panel below is the slate.
          Colors are literal rather than palette keys because the genre colors (`crime`)
          only exist on the light theme, and the slate should read the same in both.
        */}
        <Box
          aria-hidden
          sx={{
            width: '100%',
            maxWidth: 420,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: 6,
            mb: 4,
            transform: 'rotate(-2deg)',
          }}
        >
          <Box
            sx={{
              height: 44,
              backgroundColor: SLATE,
              backgroundImage:
                `repeating-linear-gradient(115deg, ${SLATE_TEXT} 0 26px, transparent 26px 52px)`,
              transformOrigin: 'left bottom',
              transform: 'rotate(-4deg)',
              ml: '-4%',
              width: '108%',
            }}
          />
          <Box
            sx={{
              backgroundColor: SLATE,
              color: SLATE_TEXT,
              px: 3,
              py: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              alignItems: 'flex-start',
            }}
          >
            <Typography fontFamily="Merriweather" fontSize={12} letterSpacing={3}>
              SCENE 404
            </Typography>
            <Typography fontFamily="Merriweather" fontSize={12} letterSpacing={3}>
              TAKE ∞
            </Typography>
            <Typography fontFamily="Merriweather" fontSize={12} letterSpacing={3}>
              DIRECTOR: NOBODY
            </Typography>
          </Box>
        </Box>

        <Typography
          fontFamily="Merriweather"
          letterSpacing={5}
          fontSize={28}
          fontWeight={700}
          color="primary"
          sx={{ flexShrink: 0 }}
        >
          Cut!
        </Typography>

        <Typography
          color="primary"
          fontSize={18}
          sx={{ mt: 2, maxWidth: 520, opacity: 0.85 }}
        >
          This page got left on the cutting room floor.
        </Typography>

        <Typography
          color="primary"
          fontSize={15}
          sx={{ mt: 1, maxWidth: 520, opacity: 0.7 }}
        >
          Test audiences hated it, the budget ran out, and the studio quietly wrote
          it off. No reshoots planned.
        </Typography>

        <Box sx={{ mt: 4 }}>
          <ButtonLink href="/projects" variant="contained" color="primary">
            Back to Projects
          </ButtonLink>
        </Box>
      </Box>
    </>
  );
}
