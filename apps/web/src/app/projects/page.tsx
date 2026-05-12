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
      <Typography
        fontFamily={'Merriweather'}
        letterSpacing={5}
        fontSize={28}
        fontWeight={700}
        color="primary"
        sx={{ flexShrink: 0 }}
      >
        Projects
      </Typography>
      <Projects />
    </Box>
  );
}
