"use server";

// #region agent log
fetch('http://127.0.0.1:7243/ingest/e25f859c-d7ba-44eb-86e1-bc11ced01386',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scenes.ts:module',message:'scenes server action module loading',data:{},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
// #endregion
import { revalidatePath } from "next/cache";
import {
  createScene as createSceneService,
  updateScene as updateSceneService,
  deleteScene as deleteSceneService,
  type CreateScenePayload,
  type UpdateScenePayload,
} from "../../../../api/src/services/ProjectDataService";

/** Return a plain object so Server Action result can be passed to Client Components. */
function toPlainObject(doc: unknown): unknown {
  if (doc == null) return doc;
  if (typeof (doc as { toObject?: () => object }).toObject === "function") {
    return (doc as { toObject: () => object }).toObject();
  }
  return JSON.parse(JSON.stringify(doc));
}

// #region agent log
fetch('http://127.0.0.1:7243/ingest/e25f859c-d7ba-44eb-86e1-bc11ced01386',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scenes.ts:module',message:'scenes module loaded (after ProjectDataService import)',data:{},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
// #endregion
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
