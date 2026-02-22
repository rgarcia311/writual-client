import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createScene, updateScene, deleteScene } from '../app/actions/scenes';

export const PROJECT_SCENES_QUERY_KEY = 'project-scenes';

export function useProjectSceneMutations() {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/e25f859c-d7ba-44eb-86e1-bc11ced01386',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useProjectSceneMutations.ts:hook',message:'useProjectSceneMutations run',data:{},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  const queryClient = useQueryClient();

  const updateSceneMutation = useMutation({
    mutationFn: async (variables: {
      sceneId: string;
      projectId: string;
      activeVersion: number;
      lockedVersion?: number | null;
      newVersion: boolean;
      versions: any[];
    }) => {
      const { sceneId, projectId: _pid, ...payload } = variables;
      return updateScene(sceneId, {
        activeVersion: payload.activeVersion,
        lockedVersion: payload.lockedVersion ?? undefined,
        newVersion: payload.newVersion,
        versions: payload.versions,
      });
    },
    onSuccess: async (_, variables) => {
      if (variables.projectId) {
        await queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables.projectId] });
        await queryClient.refetchQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables.projectId] });
      }
    },
  });

  const deleteSceneMutation = useMutation({
    mutationFn: async (variables: { sceneId: string; projectId: string }) =>
      deleteScene(variables.sceneId),
    onSuccess: async (_, variables) => {
      if (variables.projectId) {
        await queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables.projectId] });
        await queryClient.refetchQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables.projectId] });
      }
    },
  });

  const createSceneMutation = useMutation({
    mutationFn: async (variables: {
      projectId: string;
      versions: any[];
      step?: string;
    }) =>
      createScene(variables.projectId, {
        versions: variables.versions ?? [],
      }),
    onSuccess: async (_, variables) => {
      if (variables.projectId) {
        await queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables.projectId] });
        await queryClient.refetchQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables.projectId] });
      }
    },
  });

  return {
    updateSceneMutation,
    deleteSceneMutation,
    createSceneMutation,
  };
}
