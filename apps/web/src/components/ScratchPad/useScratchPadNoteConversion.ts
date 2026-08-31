'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNote } from '../../app/actions/notes';
import { valuesToPayload } from '@/components/NotesContent/useProjectNotes';
import { BLANK_NOTE_VALUES, type NewNoteValues } from '@/components/NewNoteForm';

interface UseScratchPadNoteConversionOptions {
  projectId: string;
  /** Scratch pad HTML, used as the new note's body. */
  content: string;
}

/**
 * Drives "convert to note": opens the standard note form pre-filled with the pad's HTML as the
 * body, then writes it through the same server action the Notes page uses and refreshes that
 * page's query so the new note is there when the user navigates to it.
 */
export function useScratchPadNoteConversion({
  projectId,
  content,
}: UseScratchPadNoteConversionOptions) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [alert, setAlert] = React.useState<{ message: string; severity: 'success' | 'error' } | null>(
    null
  );

  const initialValues: NewNoteValues = React.useMemo(
    () => ({ ...BLANK_NOTE_VALUES, content }),
    [content]
  );

  const mutation = useMutation({
    mutationFn: (values: NewNoteValues) => createNote(projectId, valuesToPayload(values)),
    onSuccess: async () => {
      setFormOpen(false);
      // The pad keeps its content: the user decides when to clear it, and the note is a copy.
      setAlert({ message: 'Scratch pad saved as a note.', severity: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
    },
    onError: (err: { message?: string }) =>
      setAlert({ message: err?.message || 'Failed to create note.', severity: 'error' }),
  });

  return {
    formOpen,
    openForm: () => setFormOpen(true),
    closeForm: () => setFormOpen(false),
    initialValues,
    submit: (values: NewNoteValues) => mutation.mutate(values),
    submitting: mutation.isPending,
    alert,
    dismissAlert: () => setAlert(null),
  };
}
