'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import type { Project } from '@/interfaces/project';
import { FloatingProjectPosterTile } from './FloatingProjectPosterTile';
import { FloatingProjectInfoTile } from './FloatingProjectInfoTile';
import { FloatingProjectStatsRail } from './FloatingProjectStatsRail';
import type { ProjectStatTileKey } from './buildProjectStatTiles';

export interface FloatingProjectHeroProps {
  projectData: Project;
  projectId: string;
  isLoading: boolean;
  showFloatStatsRail?: boolean;
  floatStatsRailKeys?: ProjectStatTileKey[];
  floatContentOverlay?: boolean;
  /** Hero sits in the flow as a band above the content instead of floating over it. */
  heroInFlow?: boolean;
  onEditClick: () => void;
  onDelete: () => void;
}

export function FloatingProjectHero({
  projectData,
  projectId,
  isLoading,
  showFloatStatsRail = false,
  floatStatsRailKeys,
  floatContentOverlay = false,
  heroInFlow = false,
  onEditClick,
  onDelete,
}: FloatingProjectHeroProps) {
  const coverImage = projectData.poster?.trim()
    ? projectData.poster
    : '/default-film-poster.png';

  const author =
    projectData.displayName ?? projectData.email ?? projectData.user ?? 'TBD';

  const heroClassName = [
    'project-float-hero',
    showFloatStatsRail && floatContentOverlay ? 'project-float-hero--with-stats' : '',
    heroInFlow ? 'project-float-hero--fluid' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Box className={heroClassName} role="region" aria-label="Project summary">
      <FloatingProjectPosterTile
        coverImage={coverImage}
        title={projectData.title}
        isLoading={isLoading}
      />
      <FloatingProjectInfoTile
        title={projectData.title}
        author={author}
        genre={projectData.genre}
        logline={projectData.logline}
        projectTypeLabel={projectData.type}
        projectId={projectId}
        isLoading={isLoading}
        onEditClick={onEditClick}
        onDelete={onDelete}
      />
      {showFloatStatsRail ? (
        <FloatingProjectStatsRail projectId={projectId} statKeys={floatStatsRailKeys} />
      ) : null}
    </Box>
  );
}
