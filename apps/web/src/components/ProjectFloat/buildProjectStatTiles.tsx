'use client';

import * as React from 'react';
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';
import { ProjectProgressStat } from '@/components/ProjectCard/stats/ProjectProgressStat';
import { CharacterSceneCountStat } from '@/components/ProjectCard/stats/CharacterSceneCountStat';
import { SceneIntExtAltStat } from '@/components/ProjectCard/stats/SceneIntExtAltStat';
import { DeadlineTrackingTile } from './DeadlineTrackingTile';
import { LoglineHistoryTile } from './LoglineHistoryTile';
import type { ProjectStatTileData } from './useProjectShellData';

export type ProjectHeroCardKey = 'poster' | 'details';

export type ProjectRailStatKey = 'logline' | 'progress' | 'characters' | 'scenes' | 'deadlines';

/** Everything the per-page card picker can show or hide: the two hero cards plus the stat tiles. */
export type ProjectStatTileKey = ProjectHeroCardKey | ProjectRailStatKey;

/** Hero cards — rendered by `FloatingProjectHero`, not by the stat rail. */
export const PROJECT_HERO_CARD_KEYS: ProjectHeroCardKey[] = ['poster', 'details'];

/** Tiles the stat rail knows how to build (see `buildProjectStatTiles`). */
export const PROJECT_RAIL_STAT_KEYS: ProjectRailStatKey[] = [
  'logline',
  'progress',
  'characters',
  'scenes',
  'deadlines',
];

/** Canonical card order — also the order cards render in, regardless of how they were selected. */
export const ALL_PROJECT_STAT_TILE_KEYS: ProjectStatTileKey[] = [
  ...PROJECT_HERO_CARD_KEYS,
  ...PROJECT_RAIL_STAT_KEYS,
];

/** Menu labels for the per-page tile picker; matches `STAT_PANE_LABELS` on the screenplay panes. */
export const PROJECT_STAT_TILE_LABELS: Record<ProjectStatTileKey, string> = {
  poster: 'Poster',
  details: 'Project Details',
  logline: 'Logline History',
  progress: 'Project Progress',
  characters: 'Characters',
  scenes: 'Scenes',
  deadlines: 'Deadline Tracking',
};

/** True for the two hero cards, which the shell shows/hides instead of the rail. */
export function isHeroCardKey(key: ProjectStatTileKey): key is ProjectHeroCardKey {
  return (PROJECT_HERO_CARD_KEYS as ProjectStatTileKey[]).includes(key);
}

/** Project pages that render a stat rail; the key each page's saved tile choice is stored under. */
export type ProjectStatPageKey = 'overview' | 'characters' | 'notes' | 'outline' | 'chat';

export interface ProjectStatTileEntry {
  key: ProjectRailStatKey;
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
    currentLogline,
    loglineHistory,
    loglineAccess,
  } = data;

  return [
    {
      key: 'logline',
      node: (
        <ProjectStat compact floatSurface>
          <LoglineHistoryTile
            compact
            versions={loglineHistory}
            currentLogline={currentLogline}
            access={loglineAccess}
            projectId={projectRef.id}
          />
        </ProjectStat>
      ),
    },
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
