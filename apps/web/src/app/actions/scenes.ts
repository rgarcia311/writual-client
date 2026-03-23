"use server";

import { revalidatePath } from "next/cache";
import {
  createScene as createSceneService,
  updateScene as updateSceneService,
  deleteScene as deleteSceneService,
  type CreateScenePayload,
  type UpdateScenePayload,
} from "../../../../api/src/services/SceneService";
import { toPlainObject } from "../../utils/toPlainObject";

export async function createScene(projectId: string, payload: CreateScenePayload) {
  const scene = await createSceneService(projectId, payload);
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/outline`);
  revalidatePath(`/project/${projectId}/treatment`);
  return toPlainObject(scene);
}

export async function updateScene(sceneId: string, payload: UpdateScenePayload) {
  const scene = await updateSceneService(sceneId, payload);
  if (scene && (scene as any).projectId) {
    const projectId = (scene as any).projectId.toString?.() ?? (scene as any).projectId;
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/project/${projectId}/outline`);
    revalidatePath(`/project/${projectId}/treatment`);
  }
  return toPlainObject(scene);
}

export async function deleteScene(sceneId: string) {
  const result = await deleteSceneService(sceneId);
  if (result.deleted && result.projectId) {
    revalidatePath(`/project/${result.projectId}`);
    revalidatePath(`/project/${result.projectId}/outline`);
    revalidatePath(`/project/${result.projectId}/treatment`);
  }
  return result.deleted;
}
