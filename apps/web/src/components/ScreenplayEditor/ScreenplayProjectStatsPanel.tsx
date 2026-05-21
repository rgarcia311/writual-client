'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { FloatingProjectPosterTile } from '@/components/ProjectFloat/FloatingProjectPosterTile';
import { FloatingProjectInfoTile } from '@/components/ProjectFloat/FloatingProjectInfoTile';
import { FloatingProjectStat } from '@/components/ProjectFloat/FloatingProjectStat';
import { useProjectShellContext } from '@/components/ProjectFloat/ProjectShellDataContext';
import type { ProjectStatTileKey } from '@/components/ProjectFloat/buildProjectStatTiles';
import { FloatingStatSurface } from '@/components/ProjectFloat/FloatingStatSurface';
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';
import '@/styles/screenplayWorkspace.css';

const SCREENPLAY_STAT_KEYS: ProjectStatTileKey[] = ['scenes', 'progress', 'glance'];

function TrackingStatSkeleton() {
  return (
    <FloatingStatSurface className="project-float-tracking-stat">
      <ProjectStat floatSurface compact>
        <Skeleton variant="rectangular" height="100%" sx={{ minHeight: 160, borderRadius: 1 }} />
      </ProjectStat>
    </FloatingStatSurface>
  );
}

function ProjectTilesSkeleton() {
  return (
    <>
      <FloatingStatSurface variant="poster" className="project-float-poster-tile">
        <ProjectStat floatSurface compact>
          <Skeleton variant="rectangular" sx={{ minHeight: 200, borderRadius: 1 }} />
        </ProjectStat>
      </FloatingStatSurface>
      <FloatingStatSurface variant="info" className="project-float-info-tile">
        <ProjectStat floatSurface compact>
          <Skeleton variant="rectangular" sx={{ minHeight: 160, borderRadius: 1 }} />
        </ProjectStat>
      </FloatingStatSurface>
    </>
  );
}

export interface ScreenplayProjectStatsPanelProps {
  projectId: string;
}

/**
 * Vertical column for the Screenplay side panel "Project Stats" tab:
 * poster, project details, then scene / progress / glance stats.
 */
export function ScreenplayProjectStatsPanel({ projectId }: ScreenplayProjectStatsPanelProps) {
  const {
    projectId: shellProjectId,
    projectData,
    isLoading,
    isError,
    statTileData,
    openEdit,
    handleDelete,
  } = useProjectShellContext();

  const coverImage = projectData.poster?.trim()
    ? projectData.poster
    : '/default-film-poster.png';

  const author =
    projectData.displayName ?? projectData.email ?? projectData.user ?? 'TBD';

  if (shellProjectId && shellProjectId !== projectId) {
    return null;
  }

  if (isLoading) {
    return (
      <Box className="screenplay-project-stats-panel" role="region" aria-label="Project stats">
        <Box className="screenplay-project-stats-panel__project-tiles">
          <ProjectTilesSkeleton />
        </Box>
        {SCREENPLAY_STAT_KEYS.map((key) => (
          <TrackingStatSkeleton key={key} />
        ))}
      </Box>
    );
  }

  if (isError) {
    return (
      <Box
        className="screenplay-project-stats-panel screenplay-inspiration-panel__error"
        role="region"
        aria-label="Project stats"
      >
        <Typography variant="caption" color="text.secondary">
          Could not load project stats. Try again later.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="screenplay-project-stats-panel" role="region" aria-label="Project stats">
      <Box className="screenplay-project-stats-panel__project-tiles">
        <FloatingProjectPosterTile
          coverImage={coverImage}
          title={projectData.title}
          isLoading={false}
        />
        <FloatingProjectInfoTile
          title={projectData.title}
          author={author}
          genre={projectData.genre}
          logline={projectData.logline}
          projectTypeLabel={projectData.type}
          projectId={shellProjectId}
          isLoading={false}
          onEditClick={openEdit}
          onDelete={handleDelete}
        />
      </Box>
      {SCREENPLAY_STAT_KEYS.map((statKey) => (
        <FloatingProjectStat
          key={statKey}
          statKey={statKey}
          statTileData={statTileData}
          className="project-float-tracking-stat"
        />
      ))}
    </Box>
  );
}
