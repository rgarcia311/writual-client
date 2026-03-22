'use client';

import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { request } from 'graphql-request';
import { GRAPHQL_ENDPOINT } from '../lib/config';
import { SAVE_SCREENPLAY } from '../mutations/ScreenplayMutations';

const DEBOUNCE_MS = 1500;

export function useAutosave(editor: Editor | null, projectId: string | undefined) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editor || !projectId) return;

    const handleUpdate = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const content = editor.getJSON();
        try {
          await request(GRAPHQL_ENDPOINT, SAVE_SCREENPLAY, { projectId, content });
        } catch (e) {
          console.error('[useAutosave] save failed', e);
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
