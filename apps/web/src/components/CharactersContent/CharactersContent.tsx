'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
  Box,
} from '@mui/material';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';
import { ScrollableContentArea } from '@/components/shared/ScrollableContentArea/ScrollableContentArea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_CHARACTERS_QUERY } from '@/queries/CharacterQueries';
import { CharacterCard } from '@/components/CharacterCard';
import { CharacterCardSkeleton } from '@/components/CharacterCardSkeleton';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { NewCharacterForm, type NewCharacterValues } from '@/components/NewCharacterForm';
import { AppAlert } from '@/components/AppAlert';
import { createCharacter as createCharacterAction, updateCharacter as updateCharacterAction } from '../../app/actions/characters';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { useCreateCharacterModalStore } from '@/state/createCharacterModal';
import { LOCK_ALL_CHARACTERS, UNLOCK_CHARACTERS_SECTION } from 'mutations/ProjectMutations';

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

  const project = data?.getProjectData?.[0];
  const characters = project?.characters ?? [];
  const charactersSectionLocked = project?.charactersSectionLocked ?? false;
  const stats = project?.stats ?? {};
  const totalCharacters = characters.length;
  const lockedCharacters = characters.filter((c: any) => c.lockedVersion != null).length;

  const [lockAllConfirmOpen, setLockAllConfirmOpen] = React.useState(false);
  const lockAllCharactersMutation = useMutation({
    mutationFn: () => request(endpoint, LOCK_ALL_CHARACTERS, { projectId }),
    onSuccess: async () => {
      setLockAllConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
    },
  });
  const unlockCharactersMutation = useMutation({
    mutationFn: () => request(endpoint, UNLOCK_CHARACTERS_SECTION, { projectId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
    },
  });

  const createCharacterMutation = useMutation({
    mutationFn: async (values: NewCharacterValues) => {
      const payload = {
        imageUrl: values.imageUrl.trim() || undefined,
        details: [
          {
            name: values.name,
            gender: values.gender,
            age: values.age === '' ? undefined : Number(values.age),
            bio: values.bio,
            want: values.want,
            need: values.need,
          },
        ],
      };
      return createCharacterAction(projectId, payload);
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

  const updateCharacterLockMutation = useMutation({
    mutationFn: async ({ characterId, locked }: { characterId: string; locked: boolean }) => {
      const character = characters.find((c: any) => c._id === characterId);
      const activeVersion = character?.activeVersion ?? 1;
      return updateCharacterAction(characterId, {
        activeVersion,
        lockedVersion: locked ? activeVersion : null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
    },
  });

  const handleSubmit = (values: NewCharacterValues) => {
    createCharacterMutation.mutate(values);
  };

  return (
    <ProjectDetailsLayout
      contentSx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}
      headerTitle="Characters"
      headerLeftAdornment={
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ ml: 1, alignSelf: 'flex-end', lineHeight: 1.2 }}
        >
          {lockedCharacters} locked / {totalCharacters} total
        </Typography>
      }
      headerAction={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {charactersSectionLocked ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<LockOpenIcon />}
              onClick={() => unlockCharactersMutation.mutate()}
              disabled={unlockCharactersMutation.isPending}
            >
              Unlock
            </Button>
          ) : (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LockIcon />}
                onClick={() => setLockAllConfirmOpen(true)}
                disabled={lockAllCharactersMutation.isPending || totalCharacters === 0}
              >
                Lock All
              </Button>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setCreateOpen(true)}
              >
                Create Character
              </Button>
            </>
          )}
          <Dialog open={lockAllConfirmOpen} onClose={() => setLockAllConfirmOpen(false)}>
            <DialogTitle>Lock all characters?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                This will lock every character at its current version and prevent adding or deleting characters until you unlock the section. You can still edit existing character details. Continue?
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setLockAllConfirmOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={() => lockAllCharactersMutation.mutate()}
                disabled={lockAllCharactersMutation.isPending || totalCharacters === 0}
              >
                Lock All
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      }
    >
      <ScrollableContentArea>
        {pendingNewCharacter && <CharacterCardSkeleton />}
        {characters.map((character: any, index: number) => {
          const cardId = index + 1;
          return (
            <CharacterCard
              imageUrl={character.imageUrl}
              key={character._id ?? `character-${index}`}
              id={cardId}
              name={character.name}
              details={character.details}
              expanded={expandedCardId === cardId}
              onExpandClick={() =>
                setExpandedCardId((prev) => (prev === cardId ? undefined : cardId))
              }
              locked={character.lockedVersion != null}
              onToggleLock={() =>
                updateCharacterLockMutation.mutate({
                  characterId: character._id,
                  locked: character.lockedVersion == null,
                })
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
