import { Box, Typography } from '@mui/material';
import { Projects } from '@/components/Projects';
export default function ProjectsPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography
        fontFamily={'Merriweather'}
        letterSpacing={5}
        fontSize={28}
        fontWeight={700}
        color="primary"
      >
        Projects
      </Typography>
      <Projects />
    </Box>
  );
}
