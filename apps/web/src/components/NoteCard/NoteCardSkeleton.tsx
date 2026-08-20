'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';

interface NoteCardSkeletonProps {
  gridTile?: boolean;
}

export const NoteCardSkeleton: React.FC<NoteCardSkeletonProps> = ({ gridTile = false }) => (
  <Card
    className={gridTile ? 'note-card--grid' : undefined}
    sx={{
      ...(gridTile
        ? {
            width: 'var(--character-card-width, 305px)',
            maxWidth: 'var(--character-card-width, 305px)',
            height: 'var(--character-card-height, 390px)',
            maxHeight: 'var(--character-card-height, 390px)',
            flex: '0 0 auto',
          }
        : {
            height: 'var(--character-card-height, 390px)',
            maxHeight: 'var(--character-card-height, 390px)',
          }),
      borderRadius: 'var(--project-float-radius, 12px)',
      overflow: 'hidden',
    }}
  >
    <CardHeader
      title={<Skeleton variant="text" width="70%" height={28} />}
      subheader={<Skeleton variant="rounded" width={120} height={22} />}
    />
    <CardContent>
      {['100%', '95%', '90%', '80%', '60%'].map((width, i) => (
        <Skeleton key={i} variant="text" width={width} />
      ))}
    </CardContent>
  </Card>
);
