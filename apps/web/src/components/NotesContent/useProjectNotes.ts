'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_NOTES_QUERY } from '@/queries/NoteQueries';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { useScreenplayCharacterLookupStore } from '@/state/screenplayCharacterLookup';
import { useScreenplaySceneOutlineStore } from '@/state/screenplaySceneOutline';
import type { ProjectCharacterLookup } from '@/state/screenplayCharacterLookup';
import type { ProjectScene } from '@/state/screenplaySceneOutline';
import {
  createNote as createNoteAction,
  updateNote as updateNoteAction,
  deleteNote as deleteNoteAction,
  type NotePayload,
} from '../../app/actions/notes';
import { toNote, type AssociationTarget, type Note } from '@/components/NoteCard';
import type { NewNoteValues } from '@/components/NewNoteForm';
import {
  buildAssociationTargets,
  indexTargetsById,
  type InspirationLookupItem,
} from './associationTargets';

/** Turns form values into the mutation payload, dropping association fields when unlinked. */
export function valuesToPayload(values: NewNoteValues): NotePayload {
  const linked = values.associationKind !== 'none' && Boolean(values.associationTargetId);
  return {
    title: values.title.trim(),
    category: values.category.trim(),
    content: values.content,
    incorporated: values.shouldIncorporate ? values.incorporated : false,
    shouldIncorporate: values.shouldIncorporate,
    association: linked
      ? {
          kind: values.associationKind,
          targetId: values.associationTargetId,
          label: values.associationLabel,
        }
      : { kind: 'none', targetId: null, label: null },
  };
}

interface UseProjectNotesOptions {
  projectId: string;
  onError: (message: string) => void;
}

/**
 * Data + mutations for the Notes page. All mutations invalidate and refetch the
 * notes query so the grid stays in step with the server.
 */
export function useProjectNotes({ projectId, onError }: UseProjectNotesOptions) {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ['project-notes', projectId], [projectId]);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const user = useUserProfileStore.getState().userProfile?.user;
      return request(GRAPHQL_ENDPOINT, PROJECT_NOTES_QUERY, { input: { user, _id: projectId } });
    },
    enabled: Boolean(projectId),
  }) as { data?: { getProjectData?: Array<Record<string, unknown>> }; isLoading: boolean };

  const project = data?.getProjectData?.[0];

  const notes: Note[] = React.useMemo(
    () => ((project?.notes as Array<Record<string, unknown>> | undefined) ?? []).map(toNote),
    [project]
  );

  const characters = React.useMemo(
    () => (project?.characters as ProjectCharacterLookup[] | undefined) ?? [],
    [project]
  );
  const scenes = React.useMemo(
    () => (project?.scenes as ProjectScene[] | undefined) ?? [],
    [project]
  );
  const inspiration = React.useMemo(
    () => (project?.inspiration as InspirationLookupItem[] | undefined) ?? [],
    [project]
  );

  // The character/scene reference panes read from the same lookup stores the screenplay
  // editor fills, so hydrate them here to make those panes work on the Notes page too.
  const setCharacterLookup = useScreenplayCharacterLookupStore((s) => s.setCharacters);
  const setSceneOutlineLookup = useScreenplaySceneOutlineStore((s) => s.setScenes);
  React.useEffect(() => {
    setCharacterLookup(characters);
  }, [characters, setCharacterLookup]);
  React.useEffect(() => {
    setSceneOutlineLookup(scenes);
  }, [scenes, setSceneOutlineLookup]);

  const categoryOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const note of notes) {
      const category = note.category.trim();
      if (category) seen.add(category);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  const associationTargets: AssociationTarget[] = React.useMemo(
    () => buildAssociationTargets({ characters, scenes, inspiration }),
    [characters, scenes, inspiration]
  );

  const associationTargetsById = React.useMemo(
    () => indexTargetsById(associationTargets),
    [associationTargets]
  );

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.refetchQueries({ queryKey });
  }, [queryClient, queryKey]);

  const createMutation = useMutation({
    mutationFn: (values: NewNoteValues) => createNoteAction(projectId, valuesToPayload(values)),
    onSuccess: refresh,
    onError: (err: { message?: string }) => onError(err?.message || 'Failed to create note.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ noteId, payload }: { noteId: string; payload: NotePayload }) =>
      updateNoteAction(noteId, payload),
    onSuccess: refresh,
    onError: (err: { message?: string }) => onError(err?.message || 'Failed to update note.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteNoteAction(noteId),
    onSuccess: refresh,
    onError: (err: { message?: string }) => onError(err?.message || 'Failed to delete note.'),
  });

  return {
    notes,
    categoryOptions,
    associationTargets,
    associationTargetsById,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
