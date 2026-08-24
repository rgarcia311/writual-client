"use server";

import { revalidatePath } from "next/cache";
import { serverAuthRequest } from "@/lib/serverAuthRequest";

const CREATE_CHARACTER_MUTATION = `
  mutation CreateCharacter($projectId: String!, $input: CreateCharacterInput!) {
    createCharacter(projectId: $projectId, input: $input) {
      _id
      projectId
      name
      imageUrl
      activeVersion
      lockedVersion
      details { version name gender age bio need want }
    }
  }
`;

const UPDATE_CHARACTER_MUTATION = `
  mutation UpdateCharacter($characterId: String!, $input: UpdateCharacterInput!) {
    updateCharacter(characterId: $characterId, input: $input) {
      _id
      projectId
      name
      imageUrl
      activeVersion
      lockedVersion
      details { version name gender age bio need want }
    }
  }
`;

const DELETE_CHARACTER_MUTATION = `
  mutation DeleteCharacter($characterId: String!) {
    deleteCharacter(characterId: $characterId) {
      deleted
      projectId
    }
  }
`;

export async function createCharacter(
  projectId: string,
  payload: {
    imageUrl?: string;
    details?: any[];
    activeVersion?: number;
    lockedVersion?: number;
    /** Tab the card belongs to; omit for the project's primary screenplay document. */
    screenplayDocumentId?: string | null;
  }
) {
  const result = await serverAuthRequest<{ createCharacter: any }>(
    CREATE_CHARACTER_MUTATION,
    {
      projectId,
      input: {
        imageUrl: payload.imageUrl,
        details: payload.details,
        activeVersion: payload.activeVersion,
        lockedVersion: payload.lockedVersion,
        screenplayDocumentId: payload.screenplayDocumentId ?? undefined,
      },
    }
  );
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/characters`);
  return result.createCharacter;
}

export async function updateCharacter(
  characterId: string,
  payload: {
    imageUrl?: string;
    newVersion?: boolean;
    details?: any[];
    activeVersion?: number;
    lockedVersion?: number | null;
  }
) {
  const result = await serverAuthRequest<{ updateCharacter: any }>(
    UPDATE_CHARACTER_MUTATION,
    {
      characterId,
      input: {
        imageUrl: payload.imageUrl,
        newVersion: payload.newVersion,
        details: payload.details,
        activeVersion: payload.activeVersion,
        lockedVersion:
          payload.lockedVersion === null ? undefined : payload.lockedVersion,
      },
    }
  );
  const projectId = result.updateCharacter?.projectId;
  if (projectId) {
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/project/${projectId}/characters`);
  }
  return result.updateCharacter;
}

export async function deleteCharacter(characterId: string) {
  const result = await serverAuthRequest<{
    deleteCharacter: { deleted: boolean; projectId?: string };
  }>(DELETE_CHARACTER_MUTATION, { characterId });
  if (result.deleteCharacter.deleted && result.deleteCharacter.projectId) {
    const projectId = result.deleteCharacter.projectId;
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/project/${projectId}/characters`);
  }
  return result.deleteCharacter.deleted;
}

const REORDER_CHARACTERS_MUTATION = `
  mutation ReorderCharacters($projectId: String!, $characterIds: [String!]!) {
    reorderCharacters(projectId: $projectId, characterIds: $characterIds) {
      _id
    }
  }
`;

/**
 * Persists a new card order for the characters the user can currently see.
 *
 * `characterIds` is the visible tab's cast in its new order; the server keeps characters on other
 * screenplay tabs in place, so a partial list is expected rather than the whole project.
 */
export async function reorderCharacters(projectId: string, characterIds: string[]) {
  const result = await serverAuthRequest<{ reorderCharacters: Array<{ _id: string }> | null }>(
    REORDER_CHARACTERS_MUTATION,
    { projectId, characterIds }
  );
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/characters`);
  return result.reorderCharacters ?? [];
}
