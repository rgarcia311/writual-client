import type { ProjectCharacterLookup } from '@/state/screenplayCharacterLookup';
import type { ProjectScene, SceneVersion } from '@/state/screenplaySceneOutline';
import type { AssociationTarget } from '@/components/NoteCard';

/** The slice of an inspiration item the notes page needs to offer it as a target. */
export interface InspirationLookupItem {
  _id: string;
  title?: string | null;
}

/**
 * Same active-version rule as `useScreenplaySceneOutlineStore.setScenes`, so the heading we
 * derive here keys the identical entry that `SceneDetailPane` looks up.
 */
function activeSceneVersion(scene: ProjectScene): SceneVersion | undefined {
  const idx = Math.max(0, (scene.activeVersion ?? 1) - 1);
  return scene.versions?.[idx] ?? scene.versions?.[0];
}

/** Characters first, then scenes in script order, then inspiration items. */
export function buildAssociationTargets(input: {
  characters: ProjectCharacterLookup[];
  scenes: ProjectScene[];
  inspiration: InspirationLookupItem[];
}): AssociationTarget[] {
  const characters: AssociationTarget[] = input.characters
    .map((character, index) => {
      const name = (character.name ?? '').trim();
      return {
        id: String(character._id ?? ''),
        kind: 'character' as const,
        label: name || `Character ${index + 1}`,
        paneKey: name,
      };
    })
    .filter((target) => target.id.length > 0 && target.paneKey.length > 0);

  const scenes: AssociationTarget[] = input.scenes
    .map((scene, index) => {
      const heading = (activeSceneVersion(scene)?.sceneHeading ?? '').trim();
      const number = index + 1;
      return {
        id: String(scene._id ?? ''),
        kind: 'scene' as const,
        // Number first so the picker, chip and "by association" ordering all read in script order.
        label: heading ? `${number}. ${heading}` : `Scene ${number}`,
        paneKey: heading,
        sceneNumber: number,
      };
    })
    .filter((target) => target.id.length > 0);

  const inspiration: AssociationTarget[] = input.inspiration
    .map((item, index) => ({
      id: String(item._id ?? ''),
      kind: 'inspiration' as const,
      label: item.title?.trim() || `Inspiration ${index + 1}`,
      // Inspiration panes are keyed by item _id, not by display text.
      paneKey: String(item._id ?? ''),
    }))
    .filter((target) => target.id.length > 0);

  return [...characters, ...scenes, ...inspiration];
}

export function indexTargetsById(targets: AssociationTarget[]): Map<string, AssociationTarget> {
  return new Map(targets.map((target) => [target.id, target]));
}
