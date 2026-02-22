"use server";

import { revalidatePath } from "next/cache";
import {
  createCharacter as createCharacterService,
  updateCharacter as updateCharacterService,
  deleteCharacter as deleteCharacterService,
  type CreateCharacterPayload,
  type UpdateCharacterPayload,
} from "../../../../api/src/services/CharacterService";
import { toPlainObject } from "../../utils/toPlainObject";

export async function createCharacter(projectId: string, payload: CreateCharacterPayload) {
  const character = await createCharacterService(projectId, payload);
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/characters`);
  return toPlainObject(character);
}

export async function updateCharacter(characterId: string, payload: UpdateCharacterPayload) {
  const character = await updateCharacterService(characterId, payload);
  if (character && (character as any).projectId) {
    const projectId = (character as any).projectId.toString?.() ?? (character as any).projectId;
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/project/${projectId}/characters`);
  }
  return toPlainObject(character);
}

export async function deleteCharacter(characterId: string) {
  const result = await deleteCharacterService(characterId);
  if (result.deleted && result.projectId) {
    revalidatePath(`/project/${result.projectId}`);
    revalidatePath(`/project/${result.projectId}/characters`);
  }
  return result.deleted;
}
