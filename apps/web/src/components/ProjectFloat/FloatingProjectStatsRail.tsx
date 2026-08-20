'use client';

import * as React from 'react';
import Skeleton from '@mui/material/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_TRACKING_STATS_QUERY } from '@/queries/CharacterQueries';
import { FloatingProjectStat } from './FloatingProjectStat';
import { ALL_PROJECT_STAT_TILE_KEYS } from './buildProjectStatTiles';
import type { ProjectStatTileKey } from './buildProjectStatTiles';
import { computeProjectStatTileData } from './computeProjectStatTileData';
import { useScreenplayLivePagesStore } from '@/state/screenplayLivePages';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { FloatingStatSurface } from './FloatingStatSurface';
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';

const endpoint = GRAPHQL_ENDPOINT;

export interface FloatingProjectStatsRailProps {
  projectId: string;
  statKeys?: ProjectStatTileKey[];
}

function TrackingStatSkeleton() {
  return (
    <FloatingStatSurface className="project-float-tracking-stat">
      <ProjectStat floatSurface compact>
        <Skeleton variant="rectangular" height="100%" sx={{ minHeight: 160, borderRadius: 1 }} />
      </ProjectStat>
    </FloatingStatSurface>
  );
}

export function FloatingProjectStatsRail({
  projectId,
  statKeys = ALL_PROJECT_STAT_TILE_KEYS,
}: FloatingProjectStatsRailProps) {
  // The user can hide every tile on a page; skip the fetch rather than render an empty rail.
  const hasVisibleStats = statKeys.length > 0;
  const liveBodyPages = useScreenplayLivePagesStore((s) =>
    projectId && s.projectId === projectId ? s.liveBodyPages : null,
  );

  const fetchTrackingStats = React.useCallback(async () => {
    const { userProfile } = useUserProfileStore.getState();
    const variables = { input: { user: userProfile?.user, _id: projectId } };
    return request<{ getProjectData: Array<Record<string, unknown>> }>(
      endpoint,
      PROJECT_TRACKING_STATS_QUERY,
      variables,
    );
  }, [projectId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-tracking-stats', projectId],
    queryFn: fetchTrackingStats,
    enabled: Boolean(projectId) && hasVisibleStats,
  });

  const project = data?.getProjectData?.[0];

  const statTileData = React.useMemo(() => {
    if (!project) return null;
    return computeProjectStatTileData(
      project as Parameters<typeof computeProjectStatTileData>[0],
      liveBodyPages,
    );
  }, [project, liveBodyPages]);

  if (!hasVisibleStats) {
    return null;
  }

  if (isLoading) {
    return (
      <>
        {statKeys.map((key) => (
          <TrackingStatSkeleton key={key} />
        ))}
      </>
    );
  }

  if (isError || !statTileData) {
    return null;
  }

  return (
    <>
      {statKeys.map((statKey) => (
        <FloatingProjectStat
          key={statKey}
          statKey={statKey}
          statTileData={statTileData}
          className="project-float-tracking-stat"
        />
      ))}
    </>
  );
}
