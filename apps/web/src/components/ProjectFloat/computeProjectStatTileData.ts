import type { Project } from '@/interfaces/project';
import { computeProjectProgress, computeWritingTrackerStatus } from '../../utils/progress';
import { deriveScreenplayPresenceStats } from '../../utils/projectScreenplayStats';
import type { ProjectStatTileData } from './useProjectShellData';

type ProjectForStats = Parameters<typeof computeProjectProgress>[0] & {
  writingTracker?: Project['writingTracker'];
  progressTrackingEnabled?: boolean;
  screenplay?: { versions?: Array<{ content?: unknown }> };
  characters?: Array<{ name?: string | null; imageUrl?: string | null }>;
};

export function computeProjectStatTileData(
  project: ProjectForStats,
  liveBodyPages: number | null | undefined,
): ProjectStatTileData {
  const writingTracker = project.writingTracker ?? null;
  const progressTrackingEnabled =
    (project.progressTrackingEnabled ?? false) || Boolean(writingTracker?.enabled);

  const writingTrackerStatus = computeWritingTrackerStatus(writingTracker, {
    liveEditorBodyPages: liveBodyPages ?? undefined,
  });

  const progress = computeProjectProgress(project);

  const screenplayJson = project.screenplay?.versions?.[0]?.content ?? null;

  const characterRoster = (
    (project.characters ?? []) as Array<{ name?: string | null; imageUrl?: string | null }>
  )
    .map((c) => ({
      name: (c?.name ?? '').trim(),
      imageUrl: c?.imageUrl ?? null,
    }))
    .filter((c) => c.name.length > 0);

  let screenplayPresence: ReturnType<typeof deriveScreenplayPresenceStats> | null = null;
  if (screenplayJson != null) {
    try {
      screenplayPresence = deriveScreenplayPresenceStats(
        screenplayJson,
        characterRoster.map((c) => c.name),
      );
    } catch {
      screenplayPresence = null;
    }
  }

  const topCharactersByScenes = screenplayPresence
    ? [...screenplayPresence.characterSceneCounts]
        .sort((a, b) => b.sceneCount - a.sceneCount || a.display.localeCompare(b.display))
        .slice(0, 3)
        .map((row) => ({
          name: row.display,
          sceneCount: row.sceneCount,
          imageUrl:
            characterRoster.find((c) => c.name.toUpperCase() === row.normalized)?.imageUrl ?? null,
        }))
    : [];

  return {
    progress,
    writingTracker,
    writingTrackerStatus,
    progressTrackingEnabled,
    topCharactersByScenes,
    screenplayPresence,
    characterRosterLength: characterRoster.length,
  };
}
