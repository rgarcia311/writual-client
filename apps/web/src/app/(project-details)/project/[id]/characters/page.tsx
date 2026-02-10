'use client';

import * as React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { useParams } from 'next/navigation';
import { ProjectHeader } from '@/components/ProjectHeader';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_CHARACTERS_QUERY } from '@/queries/CharacterQueries';
import { CharacterCard } from '@/components/CharacterCard';
import AddIcon from '@mui/icons-material/Add';
import { NewCharacterForm, type NewCharacterValues } from '@/components/NewCharacterForm';
import { AppAlert } from '@/components/AppAlert';
import { CREATE_CHARACTER } from 'mutations/ProjectMutations';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';

export default function CharactersPage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('Failed to create character.');


  const endpoint = GRAPHQL_ENDPOINT;


  const getCharacters = async () => {
    const userProfileState = await useUserProfileStore.getState();
    const user = userProfileState.userProfile?.user;
    const variables = { input: {user, _id: id}}
    return request(endpoint, PROJECT_CHARACTERS_QUERY, variables)
  } 

  const { data }: any = useQuery({
    queryKey: ['project-characters', id],
    queryFn: () => getCharacters(),
    enabled: Boolean(id),
  });

  const characters = data?.getProjectData?.[0]?.characters ?? [];

  const createCharacterMutation = useMutation({
    mutationFn: async (values: NewCharacterValues) => {
      const character = {
        projectId: id,
        name: values.name,
        imageUrl: values.imageUrl.trim() || undefined,
        details: [
          {
            gender: values.gender,
            age: values.age === '' ? null : values.age,
            bio: values.bio,
            want: values.want,
            need: values.need,
          },
        ],
      };
      return request(endpoint, CREATE_CHARACTER, { character });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['project-characters', id] });
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to create character.');
      setErrorOpen(true);
    },
  });

  const handleSubmit = (values: NewCharacterValues) => {
    createCharacterMutation.mutate(values);
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 2, height: '100%', width: '100%' }}>
      <ProjectHeader />
      <Container maxWidth={false} disableGutters sx={{ flex: 1, width: '100%', paddingTop: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Characters</Typography>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Create Character
          </Button>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
          {characters.map((character: any, index: number) => (
            <CharacterCard imageUrl={character.imageUrl} key={`${character?.name ?? 'character'}-${index}`} id={index + 1} name={character.name} details={character.details} />
          ))}
        </Box>
      </Container>

      <NewCharacterForm
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleSubmit}
        submitting={createCharacterMutation.isPending}
      />
      <AppAlert open={errorOpen} onClose={() => setErrorOpen(false)} message={errorMessage} severity="error" />
    </Container>
  );
}
