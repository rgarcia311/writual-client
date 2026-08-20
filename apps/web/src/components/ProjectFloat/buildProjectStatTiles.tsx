'use client';

import * as React from 'react';
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';
import { ProjectProgressStat } from '@/components/ProjectCard/stats/ProjectProgressStat';
import { CharacterSceneCountStat } from '@/components/ProjectCard/stats/CharacterSceneCountStat';
import { SceneIntExtAltStat } from '@/components/ProjectCard/stats/SceneIntExtAltStat';
import { DeadlineTrackingTile } from './DeadlineTrackingTile';
import type { ProjectStatTileData } from './useProjectShellData';

export type ProjectStatTileKey = 'progress' | 'characters' | 'scenes' | 'deadlines';

/** Canonical tile order — also the order tiles render in, regardless of how they were selected. */
export const ALL_PROJECT_STAT_TILE_KEYS: ProjectStatTileKey[] = [
  'progress',
  'characters',
  'scenes',
  'deadlines',
];

/** Menu labels for the per-page tile picker; matches `STAT_PANE_LABELS` on the screenplay panes. */
export const PROJECT_STAT_TILE_LABELS: Record<ProjectStatTileKey, string> = {
  progress: 'Project Progress',
  characters: 'Characters',
  scenes: 'Scenes',
  deadlines: 'Deadline Tracking',
};

/** Project pages that render a stat rail; the key each page's saved tile choice is stored under. */
export type ProjectStatPageKey = 'overview' | 'characters' | 'notes' | 'outline' | 'chat';

export interface ProjectStatTileEntry {
  key: ProjectStatTileKey;
  node: React.ReactNode;
}

export function buildProjectStatTiles(data: ProjectStatTileData): ProjectStatTileEntry[] {
  const {
    progress,
    developmentLocks,
    draftDeadlines,
    projectRef,
    writingTracker,
    writingTrackerStatus,
    topCharactersByScenes,
    screenplayPresence,
    characterRosterLength,
  } = data;

  return [
    {
      key: 'progress',
      node: (
        <ProjectStat compact floatSurface>
          <ProjectProgressStat
            compact
            progress={progress}
            development={developmentLocks}
            tracker={writingTracker ?? null}
            status={writingTrackerStatus}
          />
        </ProjectStat>
      ),
    },
    {
      key: 'characters',
      node: (
        <ProjectStat compact floatSurface>
          <CharacterSceneCountStat
            compact
            topCharacters={topCharactersByScenes}
            totalCharacters={characterRosterLength}
          />
        </ProjectStat>
      ),
    },
    {
      key: 'scenes',
      node: (
        <ProjectStat compact floatSurface>
          <SceneIntExtAltStat
            compact
            totalScenes={screenplayPresence?.scenes.length ?? 0}
            intCount={screenplayPresence?.intSceneWeight ?? 0}
            extCount={screenplayPresence?.extSceneWeight ?? 0}
            scenesWithAlts={screenplayPresence?.scenesWithAlts ?? []}
          />
        </ProjectStat>
      ),
    },
    {
      key: 'deadlines',
      node: (
        <ProjectStat compact floatSurface>
          <DeadlineTrackingTile
            compact
            deadlines={draftDeadlines}
            tracker={writingTracker ?? null}
            project={projectRef}
          />
        </ProjectStat>
      ),
    },
  ];
}
