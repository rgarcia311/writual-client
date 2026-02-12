import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { CREATE_SCENE, UPDATE_SCENE } from 'mutations/SceneMutations';
import { DELETE_SCENE } from 'mutations/SceneDeleteMutation';
import { GRAPHQL_ENDPOINT } from '@/lib/config';

export const PROJECT_SCENES_QUERY_KEY = 'project-scenes';

export function useProjectSceneMutations() {
  const queryClient = useQueryClient();

  const updateSceneMutation = useMutation({
    mutationFn: async (variables: {
      _id: string;
      number: number;
      activeVersion: number;
      lockedVersion?: number | null;
      newVersion: boolean;
      versions: any[];
    }) =>
      request(GRAPHQL_ENDPOINT, UPDATE_SCENE, {
        _id: variables._id,
        number: variables.number,
        activeVersion: variables.activeVersion,
        lockedVersion: variables.lockedVersion ?? undefined,
        newVersion: variables.newVersion,
        newScene: false,
        versions: variables.versions,
      }),
    onSuccess: async (_, variables) => {
      if (variables._id) {
        await queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables._id] });
        await queryClient.refetchQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables._id] });
      }
    },
  });

  const deleteSceneMutation = useMutation({
    mutationFn: async (variables: { _id: string; number: number }) =>
      request(GRAPHQL_ENDPOINT, DELETE_SCENE, {
        _id: variables._id,
        sceneNumber: variables.number,
      }),
    onSuccess: (_, variables) => {
      if (variables._id) {
        queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables._id] });
      }
    },
  });

  const createSceneMutation = useMutation({
    mutationFn: async (variables: {
      _id: string;
      number?: number;
      versions: any[];
    }) =>
      request(GRAPHQL_ENDPOINT, CREATE_SCENE, {
        _id: variables._id,
        versions: variables.versions,
        number: variables.number,
      }),
    onSuccess: (_, variables) => {
      if (variables._id) {
        queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, variables._id] });
      }
    },
  });

  return {
    updateSceneMutation,
    deleteSceneMutation,
    createSceneMutation,
  };
}
