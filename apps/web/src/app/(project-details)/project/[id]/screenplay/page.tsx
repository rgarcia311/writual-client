import { Box, Typography } from '@mui/material';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';

export default async function ScreenplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return (
    <ProjectDetailsLayout>
      <Typography variant="h6" fontWeight={600}>
        Screenplay
      </Typography>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: 40 }}
        >
          Coming Soon
        </Typography>
      </Box>
    </ProjectDetailsLayout>
  );
}
