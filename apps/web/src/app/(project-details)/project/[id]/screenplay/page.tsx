'use client';

import { Box, Typography } from '@mui/material';
import { useParams } from 'next/navigation';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';

export default function ScreenplayPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <ProjectDetailsLayout>
      <Typography variant="h6" fontWeight={600}>Screenplay</Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 40 }}>Coming Soon</Typography>
      </Box>
    </ProjectDetailsLayout>
  );
}
