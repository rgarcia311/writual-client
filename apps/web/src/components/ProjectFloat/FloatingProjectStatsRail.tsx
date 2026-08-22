'use client';

import * as React from 'react';
import Skeleton from '@mui/material/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_TRACKING_STATS_QUERY } from '@/queries/CharacterQueries';
import { FloatingProjectStat } from './FloatingProjectStat';
import { PROJECT_RAIL_STAT_KEYS } from './buildProjectStatTiles';
import type { ProjectRailStatKey, ProjectStatTileKey } from './buildProjectStatTiles';
import { computeProjectStatTileData } from './computeProjectStatTileData';
import { useScreenplayLivePagesStore } from '@/state/screenplayLivePages';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { FloatingStatSurface } from './FloatingStatSurface';
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';

const endpoint = GRAPHQL_ENDPOINT;

export interface FloatingProjectStatsRailProps {
  projectId: string;
  /** Selected cards for the page; hero-card keys are ignored here (the hero renders those). */
  statKeys?: ProjectStatTileKey[];
}

/** Deadline Tracking gives up width before the other tiles do; see `projectDetailsFloat.css`. */
function statClassName(statKey: ProjectRailStatKey): string {
  return `project-float-tracking-stat project-float-tracking-stat--${statKey}`;
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
  statKeys = PROJECT_RAIL_STAT_KEYS,
}: FloatingProjectStatsRailProps) {
  // Canonical order, hero cards dropped: the rail only builds the tiles it owns.
  const railKeys = React.useMemo(
    () => PROJECT_RAIL_STAT_KEYS.filter((key) => statKeys.includes(key)),
    [statKeys],
  );
  // The user can hide every tile on a page; skip the fetch rather than render an empty rail.
  const hasVisibleStats = railKeys.length > 0;
  const liveBodyPages = useScreenplayLivePagesStore((s) =>
    projectId && s.projectId === projectId ? s.liveBodyPages : null,
  );
  const viewerUid = useUserProfileStore((s) => s.userProfile?.user ?? null);

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
      viewerUid,
    );
  }, [project, liveBodyPages, viewerUid]);

  if (!hasVisibleStats) {
    return null;
  }

  if (isLoading) {
    return (
      <>
        {railKeys.map((key) => (
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
      {railKeys.map((statKey) => (
        <FloatingProjectStat
          key={statKey}
          statKey={statKey}
          statTileData={statTileData}
          className={statClassName(statKey)}
        />
      ))}
    </>
  );
}
