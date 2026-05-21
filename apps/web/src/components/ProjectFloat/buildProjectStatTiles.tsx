'use client';

import * as React from 'react';
import Typography from '@mui/material/Typography';
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';
import { ScreenplayProgressStat } from '@/components/ProjectCard/stats/ScreenplayProgressStat';
import { CharacterSceneCountStat } from '@/components/ProjectCard/stats/CharacterSceneCountStat';
import { SceneIntExtAltStat } from '@/components/ProjectCard/stats/SceneIntExtAltStat';
import { ProjectAtAGlanceStat } from '@/components/ProjectCard/stats/ProjectAtAGlanceStat';
import type { ProjectStatTileData } from './useProjectShellData';

export type ProjectStatTileKey = 'progress' | 'characters' | 'scenes' | 'glance';

export interface ProjectStatTileEntry {
  key: ProjectStatTileKey;
  node: React.ReactNode;
}

export function buildProjectStatTiles(data: ProjectStatTileData): ProjectStatTileEntry[] {
  const {
    progress,
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
          {writingTracker?.enabled && writingTracker ? (
            <ScreenplayProgressStat
              compact
              tracker={writingTracker}
              status={writingTrackerStatus}
            />
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Enable writing tracking to view screenplay pacing, drafts, and deadlines.
            </Typography>
          )}
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
      key: 'glance',
      node: (
        <ProjectStat compact floatSurface>
          <ProjectAtAGlanceStat
            compact
            progress={progress}
            trackerEnabled={Boolean(writingTracker?.enabled)}
            trackerStatus={writingTracker?.enabled ? writingTrackerStatus : null}
          />
        </ProjectStat>
      ),
    },
  ];
}
