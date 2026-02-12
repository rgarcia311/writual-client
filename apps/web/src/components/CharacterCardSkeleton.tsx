'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Avatar from '@mui/material/Avatar';

export const CharacterCardSkeleton: React.FC = () => (
  <Card sx={{ maxWidth: 345, maxHeight: 375 }}>
    <Skeleton variant="rectangular" height={300} />
    <CardHeader
      avatar={<Avatar><Skeleton variant="circular" width={40} height={40} /></Avatar>}
      title={<Skeleton variant="text" width="60%" height={24} />}
      subheader={<Skeleton variant="text" width="40%" height={20} />}
    />
    <CardContent>
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="90%" />
      <Skeleton variant="text" width="70%" />
    </CardContent>
  </Card>
);
