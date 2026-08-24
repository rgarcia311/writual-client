'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import type { Project } from '@/interfaces/project';
import { FloatingProjectPosterTile } from './FloatingProjectPosterTile';
import { FloatingProjectInfoTile } from './FloatingProjectInfoTile';
import { FloatingProjectStatsRail } from './FloatingProjectStatsRail';
import { PROJECT_RAIL_STAT_KEYS } from './buildProjectStatTiles';
import type { ProjectStatTileKey } from './buildProjectStatTiles';

export interface FloatingProjectHeroProps {
  projectData: Project;
  projectId: string;
  isLoading: boolean;
  showFloatStatsRail?: boolean;
  floatStatsRailKeys?: ProjectStatTileKey[];
  floatContentOverlay?: boolean;
  /** Poster card visibility — hidden when the user unchecks it in the card picker. */
  showPoster?: boolean;
  /** Project Details card visibility — hidden when the user unchecks it in the card picker. */
  showDetails?: boolean;
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
  showPoster = true,
  showDetails = true,
  onEditClick,
  onDelete,
}: FloatingProjectHeroProps) {
  const coverImage = projectData.poster?.trim()
    ? projectData.poster
    : '/default-film-poster.png';

  const author =
    projectData.displayName ?? projectData.email ?? projectData.user ?? 'TBD';

  const railKeys = floatStatsRailKeys ?? PROJECT_RAIL_STAT_KEYS;
  const hasRailTiles =
    showFloatStatsRail && PROJECT_RAIL_STAT_KEYS.some((key) => railKeys.includes(key));

  // Every card on the row can be hidden; drop the row itself rather than leave an empty band.
  if (!showPoster && !showDetails && !hasRailTiles) {
    return null;
  }

  const heroClassName = [
    'project-float-hero',
    showFloatStatsRail && floatContentOverlay ? 'project-float-hero--with-stats' : '',
    showFloatStatsRail && !floatContentOverlay ? 'project-float-hero--fluid' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Box className={heroClassName} role="region" aria-label="Project summary" data-tour="project-hero">
      {showPoster ? (
        <FloatingProjectPosterTile
          coverImage={coverImage}
          title={projectData.title}
          isLoading={isLoading}
        />
      ) : null}
      {showDetails ? (
        <FloatingProjectInfoTile
          title={projectData.title}
          author={author}
          genre={projectData.genre}
          logline={projectData.logline}
          projectTypeLabel={projectData.type}
          timePeriod={projectData.timePeriod}
          similarProjects={projectData.similarProjects}
          projectId={projectId}
          isLoading={isLoading}
          onEditClick={onEditClick}
          onDelete={onDelete}
        />
      ) : null}
      {showFloatStatsRail ? (
        <FloatingProjectStatsRail projectId={projectId} statKeys={floatStatsRailKeys} />
      ) : null}
    </Box>
  );
}
