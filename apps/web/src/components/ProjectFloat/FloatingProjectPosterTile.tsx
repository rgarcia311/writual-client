'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';
import { FloatingStatSurface } from './FloatingStatSurface';

export interface FloatingProjectPosterTileProps {
  coverImage: string;
  title: string;
  isLoading?: boolean;
}

export function FloatingProjectPosterTile({
  coverImage,
  title,
  isLoading = false,
}: FloatingProjectPosterTileProps) {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [coverImage]);

  const imageSrc = coverImage?.trim() && !imageError ? coverImage : '/default-film-poster.png';

  if (isLoading) {
    return (
      <FloatingStatSurface variant="poster" className="project-float-poster-tile">
        <ProjectStat floatSurface compact>
          <Skeleton
            variant="rectangular"
            className="project-float-poster-tile__image"
            sx={{ borderRadius: 1 }}
          />
        </ProjectStat>
      </FloatingStatSurface>
    );
  }

  return (
    <FloatingStatSurface variant="poster" className="project-float-poster-tile">
      <ProjectStat floatSurface compact>
        <Box
          component="img"
          className="project-float-poster-tile__image"
          src={imageSrc}
          alt={`${title} cover`}
          onError={() => setImageError(true)}
        />
      </ProjectStat>
    </FloatingStatSurface>
  );
}
