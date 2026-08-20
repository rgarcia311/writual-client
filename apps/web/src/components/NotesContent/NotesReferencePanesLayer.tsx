'use client';

import * as React from 'react';
import { ScreenplayCharacterPanesLayer } from '@/components/ScreenplayEditor/ScreenplayCharacterPanesLayer';
import { ScreenplayScenePanesLayer } from '@/components/ScreenplayEditor/ScreenplayScenePanesLayer';
import { ScreenplayInspirationPanesLayer } from '@/components/ScreenplayEditor/ScreenplayInspirationPanesLayer';

/**
 * Hosts the character / scene / inspiration reference panes on the Notes page. The layers
 * themselves are shared with the screenplay editor (they portal to `document.body` and clear
 * their panes on unmount); only the trigger — a note's association chip — differs here.
 */
export function NotesReferencePanesLayer() {
  return (
    <>
      <ScreenplayCharacterPanesLayer />
      <ScreenplayScenePanesLayer />
      <ScreenplayInspirationPanesLayer />
    </>
  );
}
