import { create } from 'zustand';

export interface SceneVersion {
  sceneHeading?: string;
  version?: number;
  step?: string;
  act?: number;
  thesis?: string;
  antithesis?: string;
  synthesis?: string;
}

export interface ProjectScene {
  _id: string;
  activeVersion?: number;
  lockedVersion?: number | null;
  versions?: SceneVersion[];
}

export interface ProjectSceneOutline {
  _id: string;
  sceneHeading: string;
  number?: number;
  /** Active version's number, for parity with SceneCard's version label in the 2D app. */
  version?: number;
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

export function getActiveVersion(scene: ProjectScene) {
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
        version: version?.version,
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
