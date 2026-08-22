'use client';

import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { authRequest } from '@/lib/authRequest';
import { SAVE_SCREENPLAY } from '../mutations/ScreenplayMutations';

const DEBOUNCE_MS = 1500;

interface UseAutosaveOptions {
  enabled?: boolean;
  /** Screenplay document being edited. Omit to save into the project's primary document. */
  documentId?: string | null;
  onPending?: () => void;
  onSaveStart?: () => void;
  onSaveEnd?: (success: boolean) => void;
  /** When set (and finite), persisted with save for writing-tracker page totals. */
  estimatePageCount?: () => number | null;
}

export function useAutosave(
  editor: Editor | null,
  projectId: string | undefined,
  { enabled = true, documentId, onPending, onSaveStart, onSaveEnd, estimatePageCount }: UseAutosaveOptions = {},
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep callbacks in a ref so the effect doesn't re-register on every render
  const onPendingRef = useRef(onPending);
  const onSaveStartRef = useRef(onSaveStart);
  const onSaveEndRef = useRef(onSaveEnd);
  const estimatePageCountRef = useRef(estimatePageCount);
  useEffect(() => { onPendingRef.current = onPending; }, [onPending]);
  useEffect(() => { onSaveStartRef.current = onSaveStart; }, [onSaveStart]);
  useEffect(() => { onSaveEndRef.current = onSaveEnd; }, [onSaveEnd]);
  useEffect(() => { estimatePageCountRef.current = estimatePageCount; }, [estimatePageCount]);

  useEffect(() => {
    if (!editor || !projectId || !enabled) return;

    const handleUpdate = () => {
      onPendingRef.current?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const content = editor.getJSON();
        const rawEstimate = estimatePageCountRef.current?.() ?? null;
        const rounded =
          rawEstimate != null && Number.isFinite(rawEstimate)
            ? Math.round(Number(rawEstimate))
            : null;
        onSaveStartRef.current?.();
        try {
          await authRequest(SAVE_SCREENPLAY, {
            projectId,
            ...(documentId ? { documentId } : {}),
            content,
            ...(rounded != null ? { estimatedPageCount: rounded } : {}),
          });
          onSaveEndRef.current?.(true);
        } catch (e) {
          console.error('[useAutosave] save failed', e);
          onSaveEndRef.current?.(false);
        }
      }, DEBOUNCE_MS);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, projectId, documentId, enabled]);
}
