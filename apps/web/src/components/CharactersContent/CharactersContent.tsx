'use client';

import * as React from 'react';
import { Button } from '@mui/material';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';
import { ScrollableContentArea } from '@/components/shared/ScrollableContentArea/ScrollableContentArea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_CHARACTERS_QUERY } from '@/queries/CharacterQueries';
import { CharacterCard } from '@/components/CharacterCard';
import { CharacterCardSkeleton } from '@/components/CharacterCardSkeleton';
import AddIcon from '@mui/icons-material/Add';
import { NewCharacterForm, type NewCharacterValues } from '@/components/NewCharacterForm';
import { AppAlert } from '@/components/AppAlert';
import { CREATE_CHARACTER } from 'mutations/ProjectMutations';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { useCreateCharacterModalStore } from '@/state/createCharacterModal';

const endpoint = GRAPHQL_ENDPOINT;

interface CharactersContentProps {
  projectId: string;
}

export function CharactersContent({ projectId }: CharactersContentProps) {
  const queryClient = useQueryClient();
  const setPendingNewCharacter = useCreateCharacterModalStore((s) => s.setPendingNewCharacter);
  const pendingNewCharacter = useCreateCharacterModalStore((s) => s.pendingNewCharacter);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('Failed to create character.');
  const [expandedCardId, setExpandedCardId] = React.useState<number | undefined>(undefined);

  const getCharacters = async () => {
    const userProfileState = await useUserProfileStore.getState();
    const user = userProfileState.userProfile?.user;
    const variables = { input: { user, _id: projectId } };
    return request(endpoint, PROJECT_CHARACTERS_QUERY, variables);
  };

  const { data }: any = useQuery({
    queryKey: ['project-characters', projectId],
    queryFn: () => getCharacters(),
    enabled: Boolean(projectId),
  });

  const characters = data?.getProjectData?.[0]?.characters ?? [];

  const createCharacterMutation = useMutation({
    mutationFn: async (values: NewCharacterValues) => {
      const character = {
        _id: projectId,
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
    onMutate: () => {
      setPendingNewCharacter(true);
    },
    onSuccess: async () => {
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
    },
    onSettled: () => {
      setPendingNewCharacter(false);
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
    <ProjectDetailsLayout
      contentSx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}
      headerTitle="Characters"
      headerAction={
        <Button
          variant="contained"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Create Character
        </Button>
      }
    >
      <ScrollableContentArea>
        {pendingNewCharacter && <CharacterCardSkeleton />}
        {characters.map((character: any, index: number) => {
          const cardId = index + 1;
          return (
            <CharacterCard
              imageUrl={character.imageUrl}
              key={`${character?.name ?? 'character'}-${index}`}
              id={cardId}
              name={character.name}
              details={character.details}
              expanded={expandedCardId === cardId}
              onExpandClick={() =>
                setExpandedCardId((prev) => (prev === cardId ? undefined : cardId))
              }
            />
          );
        })}
      </ScrollableContentArea>

      <NewCharacterForm
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleSubmit}
        submitting={createCharacterMutation.isPending}
      />
      <AppAlert
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
        severity="error"
      />
    </ProjectDetailsLayout>
  );
}
