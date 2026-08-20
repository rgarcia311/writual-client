"use server";

import { revalidatePath } from "next/cache";
import { serverAuthRequest } from "@/lib/serverAuthRequest";

const NOTE_FIELDS = `
  _id
  projectId
  title
  category
  content
  incorporated
  shouldIncorporate
  association { kind targetId label }
  createdAt
  updatedAt
`;

const CREATE_NOTE_MUTATION = `
  mutation CreateNote($projectId: String!, $input: CreateNoteInput!) {
    createNote(projectId: $projectId, input: $input) {
      ${NOTE_FIELDS}
    }
  }
`;

const UPDATE_NOTE_MUTATION = `
  mutation UpdateNote($noteId: String!, $input: UpdateNoteInput!) {
    updateNote(noteId: $noteId, input: $input) {
      ${NOTE_FIELDS}
    }
  }
`;

const DELETE_NOTE_MUTATION = `
  mutation DeleteNote($noteId: String!) {
    deleteNote(noteId: $noteId) {
      deleted
      projectId
    }
  }
`;

export interface NoteAssociationPayload {
  kind: "none" | "character" | "scene" | "inspiration";
  targetId?: string | null;
  label?: string | null;
}

export interface NotePayload {
  title?: string;
  category?: string;
  /** Rich text as HTML. */
  content?: string;
  incorporated?: boolean;
  shouldIncorporate?: boolean;
  association?: NoteAssociationPayload;
}

function revalidateNotePaths(projectId: string) {
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/notes`);
}

export async function createNote(projectId: string, payload: NotePayload) {
  const result = await serverAuthRequest<{ createNote: any }>(CREATE_NOTE_MUTATION, {
    projectId,
    input: payload,
  });
  revalidateNotePaths(projectId);
  return result.createNote;
}

/** Partial update: only the keys present on `payload` are written. */
export async function updateNote(noteId: string, payload: NotePayload) {
  const result = await serverAuthRequest<{ updateNote: any }>(UPDATE_NOTE_MUTATION, {
    noteId,
    input: payload,
  });
  const projectId = result.updateNote?.projectId;
  if (projectId) revalidateNotePaths(projectId);
  return result.updateNote;
}

export async function deleteNote(noteId: string) {
  const result = await serverAuthRequest<{
    deleteNote: { deleted: boolean; projectId?: string };
  }>(DELETE_NOTE_MUTATION, { noteId });
  if (result.deleteNote.deleted && result.deleteNote.projectId) {
    revalidateNotePaths(result.deleteNote.projectId);
  }
  return result.deleteNote.deleted;
}
