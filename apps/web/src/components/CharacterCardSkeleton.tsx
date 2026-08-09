'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Avatar from '@mui/material/Avatar';

interface CharacterCardSkeletonProps {
  gridTile?: boolean;
}

export const CharacterCardSkeleton: React.FC<CharacterCardSkeletonProps> = ({ gridTile = false }) => (
  <Card
    className={gridTile ? 'character-card--grid' : undefined}
    sx={{
      // <PROTECTED> — character card dimensions; see .cursor/rules/character-card-dimensions.mdc
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
      // </PROTECTED>
      borderRadius: 'var(--project-float-radius, 12px)',
      overflow: 'hidden',
    }}
  >
    <Skeleton
      variant="rectangular"
      height={gridTile ? 'var(--character-card-media-height, 240px)' : 300}
    />
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
