'use client';

import * as React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { ProjectHeader } from '@/components/ProjectHeader';
import { SceneCard } from '@/components/SceneCard';
import AddIcon from '@mui/icons-material/Add';
import { PROJECT_SCENES_QUERY } from '@/queries/SceneQueries';
import { useProjectSceneMutations, PROJECT_SCENES_QUERY_KEY } from 'hooks';

import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';

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
  const { createSceneMutation } = useProjectSceneMutations();

  const getOutlines= async () => {
    const userProfileState = await useUserProfileStore.getState();
    const user = userProfileState.userProfile?.user;
    const variables = { input: {user, _id: id}}
    return request(endpoint, PROJECT_SCENES_QUERY, variables)
  } 

  const { data }: any = useQuery({
    queryKey: [PROJECT_SCENES_QUERY_KEY, id],
    queryFn: () => getOutlines,
    enabled: Boolean(id),
  });

  const scenes = data?.getProjectData?.[0]?.scenes ?? [];

  const handleNewScene = () => {
    if (!id) return;
    createSceneMutation.mutate({
      _id: id,
      number: scenes.length + 1,
      versions: [{ ...DEFAULT_NEW_SCENE_VERSION }],
    });
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ border: "1px solid green",  display: 'flex', flexDirection: 'column', flex: 1, padding: 2, height: '100%', width: '100%' }}>
      <ProjectHeader />

      <Container maxWidth={false} disableGutters sx={{ 
   
        minHeight: "500px",
        width: '100%', 
        paddingTop: 2 }}>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Outline</Typography>
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

        <Box sx={{ height: "calc(100% - 45px)", display: 'flex', flexDirection: 'row', flexWrap: 'wrap', overflowY: 'scroll', gap: 2 }}>
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
                projectId={scene.projectId ?? id}
                step={activeVersionData?.step ?? ''}
              />
            );
          })}
        </Box>

      </Container>
    </Container>
  );
}
