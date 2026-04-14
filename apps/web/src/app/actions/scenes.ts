"use server";

import { revalidatePath } from "next/cache";
import { serverAuthRequest } from "@/lib/serverAuthRequest";

const CREATE_SCENE_MUTATION = `
  mutation CreateScene($projectId: String!, $input: CreateSceneInput!) {
    createScene(projectId: $projectId, input: $input) {
      _id
      projectId
      activeVersion
      lockedVersion
      versions { version sceneHeading act step thesis antithesis synthesis synopsis }
    }
  }
`;

const UPDATE_SCENE_MUTATION = `
  mutation UpdateScene($sceneId: String!, $input: UpdateSceneInput!) {
    updateScene(sceneId: $sceneId, input: $input) {
      _id
      projectId
      activeVersion
      lockedVersion
      versions { version sceneHeading act step thesis antithesis synthesis synopsis }
    }
  }
`;

const DELETE_SCENE_MUTATION = `
  mutation DeleteScene($sceneId: String!) {
    deleteScene(sceneId: $sceneId) {
      deleted
      projectId
    }
  }
`;

export async function createScene(
  projectId: string,
  payload: {
    versions?: any[];
    activeVersion?: number;
    lockedVersion?: number;
    newVersion?: boolean;
    newScene?: boolean;
  }
) {
  const result = await serverAuthRequest<{ createScene: any }>(
    CREATE_SCENE_MUTATION,
    {
      projectId,
      input: {
        versions: payload.versions ?? [],
        activeVersion: payload.activeVersion,
        lockedVersion: payload.lockedVersion,
        newVersion: payload.newVersion,
        newScene: payload.newScene,
      },
    }
  );
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/outline`);
  revalidatePath(`/project/${projectId}/treatment`);
  return result.createScene;
}

export async function updateScene(
  sceneId: string,
  payload: {
    activeVersion?: number;
    lockedVersion?: number | null;
    newVersion?: boolean;
    versions?: any[];
  }
) {
  const result = await serverAuthRequest<{ updateScene: any }>(
    UPDATE_SCENE_MUTATION,
    {
      sceneId,
      input: {
        activeVersion: payload.activeVersion,
        lockedVersion:
          payload.lockedVersion === null ? undefined : payload.lockedVersion,
        newVersion: payload.newVersion,
        versions: payload.versions,
      },
    }
  );
  const projectId = result.updateScene?.projectId;
  if (projectId) {
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/project/${projectId}/outline`);
    revalidatePath(`/project/${projectId}/treatment`);
  }
  return result.updateScene;
}

export async function deleteScene(sceneId: string) {
  const result = await serverAuthRequest<{
    deleteScene: { deleted: boolean; projectId?: string };
  }>(DELETE_SCENE_MUTATION, { sceneId });
  if (result.deleteScene.deleted && result.deleteScene.projectId) {
    const projectId = result.deleteScene.projectId;
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/project/${projectId}/outline`);
    revalidatePath(`/project/${projectId}/treatment`);
  }
  return result.deleteScene.deleted;
}
