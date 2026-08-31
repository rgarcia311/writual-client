'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useScratchPadStore } from '@/state/scratchPad';
import { ScratchPadPane } from './ScratchPadPane';

interface ScratchPadLayerProps {
  projectId: string;
}

/**
 * Portals the pad to `document.body` so it floats free of the project shell's scrolling and
 * transformed subtrees (the screenplay paper's zoom would otherwise rescale it).
 */
export function ScratchPadLayer({ projectId }: ScratchPadLayerProps) {
  const openProjectId = useScratchPadStore((s) => s.openProjectId);
  // The open flag is rehydrated from sessionStorage after mount; rendering only once mounted
  // keeps the server and first client paint identical.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted || typeof document === 'undefined') return null;
  if (!projectId || openProjectId !== projectId) return null;

  return createPortal(<ScratchPadPane projectId={projectId} />, document.body);
}
