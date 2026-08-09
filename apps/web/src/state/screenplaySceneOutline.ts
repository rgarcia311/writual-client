import { create } from 'zustand';
import type { ProjectScene } from '@/components/ScreenplayEditor/ScreenplaySidePanel';

export interface ProjectSceneOutline {
  _id: string;
  sceneHeading: string;
  number?: number;
  act?: number;
  step?: string;
  thesis?: string;
  antithesis?: string;
  synthesis?: string;
}

interface ScreenplaySceneOutlineState {
  /** Keyed by normalizeSceneHeadingText(sceneHeading) for O(1) lookup from the gutter button. */
  scenesByHeading: Record<string, ProjectSceneOutline>;
  setScenes: (scenes: ProjectScene[]) => void;
}

/** Scene headings are matched by text (no persisted doc-to-scene id), so both sides normalize the same way. */
export function normalizeSceneHeadingText(text: string): string {
  return text.trim().toUpperCase();
}

function getActiveVersion(scene: ProjectScene) {
  const idx = Math.max(0, (scene.activeVersion ?? 1) - 1);
  return scene.versions?.[idx] ?? scene.versions?.[0];
}

export const useScreenplaySceneOutlineStore = create<ScreenplaySceneOutlineState>()((set) => ({
  scenesByHeading: {},
  setScenes: (scenes) => {
    const scenesByHeading: Record<string, ProjectSceneOutline> = {};
    scenes.forEach((scene, index) => {
      const version = getActiveVersion(scene);
      const heading = (version?.sceneHeading ?? '').trim();
      if (!heading) return;
      scenesByHeading[normalizeSceneHeadingText(heading)] = {
        _id: scene._id,
        sceneHeading: heading,
        number: index + 1,
        act: version?.act,
        step: version?.step,
        thesis: version?.thesis,
        antithesis: version?.antithesis,
        synthesis: version?.synthesis,
      };
    });
    set({ scenesByHeading });
  },
}));
