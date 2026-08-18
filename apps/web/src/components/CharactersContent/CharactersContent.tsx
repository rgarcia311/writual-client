'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import { FeatureGate } from '@/components/Auth/FeatureGate';
import '@/styles/charactersPage.css';

const endpoint = GRAPHQL_ENDPOINT;

interface CharactersContentProps {
  projectId: string;
}

const CHARACTERS_PAGE_STAT_KEYS = ['characters', 'deadlines'] as const;

export function CharactersContent({ projectId }: CharactersContentProps) {
  const queryClient = useQueryClient();
  const setPendingNewCharacter = useCreateCharacterModalStore((s) => s.setPendingNewCharacter);
  const pendingNewCharacter = useCreateCharacterModalStore((s) => s.pendingNewCharacter);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('Failed to create character.');
  const [expandedCardId, setExpandedCardId] = React.useState<number | undefined>(undefined);
  const [lockAllConfirmOpen, setLockAllConfirmOpen] = React.useState(false);
  const [editingCharacter, setEditingCharacter] = React.useState<{
    characterId: string;
    version: number | undefined;
    initialValues: NewCharacterValues;
  } | null>(null);

  const getCharacters = async () => {
    const userProfileState = await useUserProfileStore.getState();
    const user = userProfileState.userProfile?.user;
    const variables = { input: { user, _id: projectId } };
    return request(endpoint, PROJECT_CHARACTERS_QUERY, variables);
  };

  const { data } = useQuery({
    queryKey: ['project-characters', projectId],
    queryFn: () => getCharacters(),
    enabled: Boolean(projectId),
  }) as { data?: { getProjectData?: Array<Record<string, unknown>> } };

  const project = data?.getProjectData?.[0];
  const characters = (project?.characters as Array<Record<string, unknown>> | undefined) ?? [];
  const charactersSectionLocked = Boolean(project?.charactersSectionLocked);
  const totalCharacters = characters.length;

  const lockAllCharactersMutation = useMutation({
    mutationFn: () => request(endpoint, LOCK_ALL_CHARACTERS, { projectId }),
    onSuccess: async () => {
      setLockAllConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['project-tracking-stats', projectId] });
    },
  });
  const unlockCharactersMutation = useMutation({
    mutationFn: () => request(endpoint, UNLOCK_CHARACTERS_SECTION, { projectId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['project-tracking-stats', projectId] });
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
    onError: (err: { message?: string }) => {
      setErrorMessage(err?.message || 'Failed to create character.');
      setErrorOpen(true);
    },
  });

  const updateCharacterLockMutation = useMutation({
    mutationFn: async ({ characterId, locked }: { characterId: string; locked: boolean }) => {
      const character = characters.find((c) => c._id === characterId);
      const activeVersion = (character?.activeVersion as number | undefined) ?? 1;
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

  const updateCharacterDetailsMutation = useMutation({
    mutationFn: async (values: NewCharacterValues) => {
      if (!editingCharacter) throw new Error('No character selected for edit.');
      return updateCharacterAction(editingCharacter.characterId, {
        imageUrl: values.imageUrl.trim() || undefined,
        details: [
          {
            version: editingCharacter.version,
            name: values.name,
            gender: values.gender,
            age: values.age === '' ? undefined : Number(values.age),
            bio: values.bio,
            want: values.want,
            need: values.need,
          },
        ],
      });
    },
    onSuccess: async () => {
      setEditingCharacter(null);
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
    },
    onError: (err: { message?: string }) => {
      setErrorMessage(err?.message || 'Failed to update character.');
      setErrorOpen(true);
    },
  });

  const handleSubmit = (values: NewCharacterValues) => {
    createCharacterMutation.mutate(values);
  };

  const handleEditClick = (
    character: Record<string, unknown>,
    detail: Record<string, unknown> | undefined
  ) => {
    setEditingCharacter({
      characterId: character._id as string,
      version: detail?.version as number | undefined,
      initialValues: {
        name: (detail?.name as string) ?? (character.name as string) ?? '',
        gender: (detail?.gender as string) ?? '',
        age: (detail?.age as number | undefined) ?? '',
        bio: (detail?.bio as string) ?? '',
        want: (detail?.want as string) ?? '',
        need: (detail?.need as string) ?? '',
        imageUrl: (character.imageUrl as string) ?? '',
      },
    });
  };

  const handleEditSubmit = (values: NewCharacterValues) => {
    updateCharacterDetailsMutation.mutate(values);
  };

  const breadcrumbActions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
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
          <FeatureGate minTier="indie">
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
            >
              Create Character
            </Button>
          </FeatureGate>
        </>
      )}
      <Dialog open={lockAllConfirmOpen} onClose={() => setLockAllConfirmOpen(false)}>
        <DialogTitle>Lock all characters?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will lock every character at its current version and prevent adding or deleting
            characters until you unlock the section. You can still edit existing character details.
            Continue?
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
  );

  return (
    <ProjectDetailsLayout
      showFloatStatsRail
      floatStatsRailKeys={[...CHARACTERS_PAGE_STAT_KEYS]}
      breadcrumbRightAdornment={breadcrumbActions}
      contentSx={{ display: 'flex', flexDirection: 'column', flex: 'none', minHeight: 0, overflow: 'visible', pl: 0, pt: 0 }}
    >
      <ScrollableContentArea
        className="characters-page-cards"
        sx={{
          display: 'grid',
          flex: 'none',
          minHeight: 0,
          height: 'auto',
          maxHeight: 'none',
          width: '100%',
          p: 0,
          paddingTop: 0,
          overflow: 'visible',
          overflowY: 'visible',
          justifyContent: 'space-between',
          alignContent: 'flex-start',
          columnGap: 0,
          rowGap: 'var(--project-float-stat-gap, var(--app-body-padding, 8px))',
        }}
      >
        {pendingNewCharacter && <CharacterCardSkeleton gridTile />}
        {characters.map((character, index) => {
          const cardId = index + 1;
          const details = character.details as Array<Record<string, unknown>> | undefined;
          return (
            <CharacterCard
              gridTile
              imageUrl={character.imageUrl as string | undefined}
              key={(character._id as string) ?? `character-${index}`}
              id={cardId}
              name={character.name as string}
              details={details}
              expanded={expandedCardId === cardId}
              onExpandClick={() =>
                setExpandedCardId((prev) => (prev === cardId ? undefined : cardId))
              }
              locked={character.lockedVersion != null}
              onToggleLock={() =>
                updateCharacterLockMutation.mutate({
                  characterId: character._id as string,
                  locked: character.lockedVersion == null,
                })
              }
              onEditClick={(detail) => handleEditClick(character, detail)}
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
      <NewCharacterForm
        open={Boolean(editingCharacter)}
        onCancel={() => setEditingCharacter(null)}
        onSubmit={handleEditSubmit}
        submitting={updateCharacterDetailsMutation.isPending}
        initialValues={editingCharacter?.initialValues}
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
