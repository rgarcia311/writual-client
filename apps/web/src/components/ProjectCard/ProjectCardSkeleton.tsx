'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

export const ProjectCardSkeleton: React.FC = () => (
  <Card
    elevation={1}
    sx={{
      display: 'flex',
      width: 570,
      minHeight: 280,
      borderRadius: 2,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden',
    }}
  >
    <Skeleton
      variant="rectangular"
      sx={{ width: 185, height: 280, flexShrink: 0, borderRadius: 2, m: 1, mr: 0 }}
    />
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, p: 2, pt: 2 }}>
      <CardContent sx={{ flex: 1, minHeight: 0, p: 0, '&:last-child': { pb: 0 } }}>
        <Skeleton variant="text" width="70%" height={28} />
        <Skeleton variant="text" width="40%" height={20} sx={{ mt: 1 }} />
        <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1.5 }} />
        <Skeleton variant="text" width="90%" height={20} sx={{ mt: 0.5 }} />
        <Skeleton variant="text" width="60%" height={20} sx={{ mt: 0.5 }} />
        <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1.5 }} />
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Skeleton variant="text" width={36} height={12} />
              <Skeleton variant="circular" width={12} height={12} />
            </Box>
          ))}
        </Box>
      </CardContent>
      <CardActions sx={{ flexShrink: 0, px: 0, pb: 0, pt: 1 }}>
        <Skeleton variant="rounded" width={120} height={32} />
      </CardActions>
    </Box>
  </Card>
);
