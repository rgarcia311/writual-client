'use client';

import * as React from 'react';
import { useScreenplayCharacterPanesStore } from '@/state/screenplayCharacterPanes';
import { useScreenplayScenePanesStore } from '@/state/screenplayScenePanes';
import { useScreenplayInspirationPanesStore } from '@/state/screenplayInspirationPanes';
import type { AssociationTarget } from '@/components/NoteCard';

export interface PaneAnchor {
  x: number;
  y: number;
}

/**
 * Opens the same floating, drag-anywhere reference panes the screenplay editor uses, so a
 * note's association chip pops its character / scene / inspiration card over the notes grid.
 * The character and scene panes read from the lookup stores hydrated by `useProjectNotes`.
 */
export function useNoteReferencePanes() {
  const openCharacterPane = useScreenplayCharacterPanesStore((s) => s.openPane);
  const openScenePane = useScreenplayScenePanesStore((s) => s.openPane);
  const openInspirationPane = useScreenplayInspirationPanesStore((s) => s.openPane);

  return React.useCallback(
    (target: AssociationTarget, anchor?: PaneAnchor) => {
      if (!target.paneKey.trim()) return;
      if (target.kind === 'character') openCharacterPane(target.paneKey, anchor);
      else if (target.kind === 'scene') openScenePane(target.paneKey, anchor);
      else openInspirationPane(target.paneKey, target.label, anchor);
    },
    [openCharacterPane, openScenePane, openInspirationPane]
  );
}
