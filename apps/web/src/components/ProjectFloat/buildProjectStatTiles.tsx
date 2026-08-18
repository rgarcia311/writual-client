'use client';

import * as React from 'react';
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';
import { ProjectProgressStat } from '@/components/ProjectCard/stats/ProjectProgressStat';
import { CharacterSceneCountStat } from '@/components/ProjectCard/stats/CharacterSceneCountStat';
import { SceneIntExtAltStat } from '@/components/ProjectCard/stats/SceneIntExtAltStat';
import { DeadlineTrackingTile } from './DeadlineTrackingTile';
import type { ProjectStatTileData } from './useProjectShellData';

export type ProjectStatTileKey = 'progress' | 'characters' | 'scenes' | 'deadlines';

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
