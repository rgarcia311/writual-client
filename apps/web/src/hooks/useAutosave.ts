'use client';

import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { request } from 'graphql-request';
import { GRAPHQL_ENDPOINT } from '../lib/config';
import { SAVE_SCREENPLAY } from '../mutations/ScreenplayMutations';

const DEBOUNCE_MS = 1500;

interface UseAutosaveOptions {
  onPending?: () => void;
  onSaveStart?: () => void;
  onSaveEnd?: (success: boolean) => void;
}

export function useAutosave(
  editor: Editor | null,
  projectId: string | undefined,
  { onPending, onSaveStart, onSaveEnd }: UseAutosaveOptions = {},
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep callbacks in a ref so the effect doesn't re-register on every render
  const onPendingRef = useRef(onPending);
  const onSaveStartRef = useRef(onSaveStart);
  const onSaveEndRef = useRef(onSaveEnd);
  useEffect(() => { onPendingRef.current = onPending; }, [onPending]);
  useEffect(() => { onSaveStartRef.current = onSaveStart; }, [onSaveStart]);
  useEffect(() => { onSaveEndRef.current = onSaveEnd; }, [onSaveEnd]);

  useEffect(() => {
    if (!editor || !projectId) return;

    const handleUpdate = () => {
      onPendingRef.current?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const content = editor.getJSON();
        onSaveStartRef.current?.();
        try {
          await request(GRAPHQL_ENDPOINT, SAVE_SCREENPLAY, { projectId, content });
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
  }, [editor, projectId]);
}
