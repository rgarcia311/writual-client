import { Box, Typography } from '@mui/material';
import { Projects } from '@/components/Projects';
export default function ProjectsPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/*
        The AR entry point lives here as well as on the project-detail pages: with the
        Projects pane now available for the whole session, `/projects` is a sensible place to
        start one from — and it's the only route where the pane opens expanded.
      */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Typography
          fontFamily={'Merriweather'}
          letterSpacing={5}
          fontSize={28}
          fontWeight={700}
          color="primary"
        >
          Projects
        </Typography>
      </Box>
      <Projects />
    </Box>
  );
}
