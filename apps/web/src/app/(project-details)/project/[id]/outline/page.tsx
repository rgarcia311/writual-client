'use client';

import * as React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';
import { SceneCard } from '@/components/SceneCard';
import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import { PROJECT_SCENES_QUERY } from '@/queries/SceneQueries';
import { useProjectSceneMutations, PROJECT_SCENES_QUERY_KEY } from 'hooks';

import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { useOutlineSaveStatusStore } from '@/state/outlineSaveStatus';

const endpoint = GRAPHQL_ENDPOINT;

const DEFAULT_NEW_SCENE_VERSION = {
  version: 1,
  sceneHeading: '',
  thesis: '',
  antithesis: '',
  synthesis: '',
  synopsis: '',
  act: 1,
};

export default function OutlinePage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const { createSceneMutation } = useProjectSceneMutations();
  const { savingCount, lastSavedAt, reset } = useOutlineSaveStatusStore();
  const isSaving = savingCount > 0;
  const showSaved = !isSaving && lastSavedAt != null;

  React.useEffect(() => {
    return () => reset();
  }, [id, reset]);

  const getOutlines = async () => {
    const userProfileState = await useUserProfileStore.getState();
    const user = userProfileState.userProfile?.user;
    const variables = { input: { user, _id: id } };
    return request(endpoint, PROJECT_SCENES_QUERY, variables);
  };

  const { data }: any = useQuery({
    queryKey: [PROJECT_SCENES_QUERY_KEY, id],
    queryFn: getOutlines,
    enabled: Boolean(id),
  });

  const scenes = data?.getProjectData?.[0]?.scenes ?? [];

  const handleNewScene = () => {
    if (!id) return;
    createSceneMutation.mutate(
      {
        _id: id,
        versions: [{ ...DEFAULT_NEW_SCENE_VERSION }],
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, id] });
          await queryClient.refetchQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, id] });
        },
      }
    );
  };

  return (
    <ProjectDetailsLayout contentSx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight={600}>Outline</Typography>
            {isSaving && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} aria-label="Saving">
                <AutorenewIcon sx={{ fontSize: 20, animation: 'spin 1s linear infinite' }} />
                <Typography variant="body2" color="text.secondary">saving...</Typography>
              </Box>
            )}
            {showSaved && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} aria-label="Saved">
                <CloudDoneIcon sx={{ fontSize: 20, color: 'success.main' }} />
              </Box>
            )}
          </Box>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleNewScene}
            disabled={createSceneMutation.isPending}
          >
            New scene
          </Button>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', justifyContent: "flex-start", flexWrap: 'wrap', overflowY: 'auto', gap: 2 }}>
          {scenes.map((scene: any, index: number) => {
            const activeVersion = scene.activeVersion ?? 1;
            const activeVersionIndex = Math.max(0, activeVersion - 1);
            const activeVersionData = scene.versions?.[activeVersionIndex];
            return (
              <SceneCard
                key={scene.number ?? index}
                number={scene.number}
                newScene={false}
                versions={scene.versions ?? []}
                activeVersion={activeVersion}
                lockedVersion={scene.lockedVersion ?? null}
                projectId={id}
                step={activeVersionData?.step ?? ''}
              />
            );
          })}
        </Box>
    </ProjectDetailsLayout>
  );
}
