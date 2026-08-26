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
import {
  createCharacter as createCharacterAction,
  updateCharacter as updateCharacterAction,
  deleteCharacter as deleteCharacterAction,
  reorderCharacters as reorderCharactersAction,
} from '../../app/actions/characters';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { useCreateCharacterModalStore } from '@/state/createCharacterModal';
import { LOCK_ALL_CHARACTERS, UNLOCK_CHARACTERS_SECTION } from 'mutations/ProjectMutations';
import { FeatureGate } from '@/components/Auth/FeatureGate';
import { useScreenplayDocuments } from '@hooks/useScreenplayDocuments';
import { ScreenplayDocumentTabs } from '@/components/ScreenplayEditor/ScreenplayDocumentTabs';
import { filterByDocument } from '@/lib/screenplayDocumentEntities';
import { useCharacterReorder } from './useCharacterReorder';
import '@/styles/charactersPage.css';

const endpoint = GRAPHQL_ENDPOINT;

interface CharactersContentProps {
  projectId: string;
}

const CHARACTERS_PAGE_STAT_KEYS = ['characters', 'deadlines'] as const;

/**
 * A character's portraits in display order. Characters saved before multi-image support carry only
 * `imageUrl`, which reads as a one-image gallery.
 */
function characterGallery(character: Record<string, unknown>): string[] {
  const gallery = (character.imageUrls as string[] | undefined) ?? [];
  const cleaned = gallery.filter((url) => typeof url === 'string' && url.trim());
  if (cleaned.length) return cleaned;
  const primary = character.imageUrl as string | undefined;
  return primary?.trim() ? [primary] : [];
}

export function CharactersContent({ projectId }: CharactersContentProps) {
  const queryClient = useQueryClient();
  const setPendingNewCharacter = useCreateCharacterModalStore((s) => s.setPendingNewCharacter);
  const pendingNewCharacter = useCreateCharacterModalStore((s) => s.pendingNewCharacter);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('Failed to create character.');
  const [lockAllConfirmOpen, setLockAllConfirmOpen] = React.useState(false);
  const [editingCharacter, setEditingCharacter] = React.useState<{
    characterId: string;
    version: number | undefined;
    initialValues: NewCharacterValues;
  } | null>(null);
  const [characterPendingDelete, setCharacterPendingDelete] = React.useState<{
    characterId: string;
    name: string;
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

  /**
   * Character cards are scoped to the selected screenplay document, so a project that imported a
   * second script shows that script's cast on its own tab rather than merging both casts.
   */
  const {
    documents: screenplayDocuments,
    activeDocumentId,
    setActiveDocumentId,
  } = useScreenplayDocuments(projectId);
  const primaryDocumentId =
    screenplayDocuments.find((d) => d.isPrimary)?._id ?? screenplayDocuments[0]?._id ?? null;

  const allCharacters =
    (project?.characters as Array<Record<string, unknown>> | undefined) ?? [];
  const characters = React.useMemo(
    () =>
      filterByDocument(
        allCharacters as Array<{ screenplayDocumentId?: string | null }>,
        { activeDocumentId, primaryDocumentId },
      ) as Array<Record<string, unknown>>,
    [allCharacters, activeDocumentId, primaryDocumentId],
  );
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
        imageUrls: values.imageUrls.filter((url) => url.trim()),
        // Tag the new character to the tab being viewed, or it would be filtered out of the grid
        // the moment it is created.
        screenplayDocumentId: activeDocumentId,
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
        // Sent even when empty: the gallery replaces what is stored, so clearing every image here
        // is how a character's portraits are removed.
        imageUrls: values.imageUrls.filter((url) => url.trim()),
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

  const addCharacterVersionMutation = useMutation({
    mutationFn: async (characterId: string) => {
      const character = characters.find((c) => c._id === characterId);
      const details = (character?.details as Array<Record<string, unknown>> | undefined) ?? [];
      // The new version starts as a copy of the latest one so the card still reads as the same
      // character until the writer edits it, rather than rendering a blank profile.
      const source = details[details.length - 1] ?? {};
      return updateCharacterAction(characterId, {
        newVersion: true,
        activeVersion: details.length + 1,
        details: [
          {
            name: (source.name as string) ?? (character?.name as string) ?? '',
            gender: (source.gender as string) ?? '',
            age: source.age as number | undefined,
            bio: (source.bio as string) ?? '',
            want: (source.want as string) ?? '',
            need: (source.need as string) ?? '',
          },
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
    },
    onError: (err: { message?: string }) => {
      setErrorMessage(err?.message || 'Failed to add character version.');
      setErrorOpen(true);
    },
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: (characterId: string) => deleteCharacterAction(characterId),
    onSuccess: async () => {
      setCharacterPendingDelete(null);
      // Deleting moves project character counts, so refresh the stat rail alongside the grid.
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['project-tracking-stats', projectId] });
    },
    onError: (err: { message?: string }) => {
      setErrorMessage(err?.message || 'Failed to delete character.');
      setErrorOpen(true);
    },
  });

  const reorderCharactersMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderCharactersAction(projectId, orderedIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] });
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] });
    },
    onError: (err: { message?: string }) => {
      // Drop the dragged order so the grid shows what the server actually has.
      clearPendingOrder();
      setErrorMessage(err?.message || 'Failed to reorder characters.');
      setErrorOpen(true);
    },
  });

  const characterIds = React.useMemo(
    () => characters.map((character) => character._id as string),
    [characters],
  );
  const charactersById = React.useMemo(
    () => new Map(characters.map((character) => [character._id as string, character])),
    [characters],
  );
  const reorderMutate = reorderCharactersMutation.mutate;
  const handleReorder = React.useCallback(
    (orderedIds: string[]) => reorderMutate(orderedIds),
    [reorderMutate],
  );
  const { orderedIds, draggingId, getDragProps, clearPendingOrder } = useCharacterReorder(
    characterIds,
    handleReorder,
  );

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
        imageUrls: characterGallery(character),
      },
    });
  };

  const handleEditSubmit = (values: NewCharacterValues) => {
    updateCharacterDetailsMutation.mutate(values);
  };

  const handleConfirmDelete = () => {
    if (!characterPendingDelete) return;
    deleteCharacterMutation.mutate(characterPendingDelete.characterId);
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
      <ScreenplayDocumentTabs
        documents={screenplayDocuments}
        activeDocumentId={activeDocumentId}
        onChange={setActiveDocumentId}
      />

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
        {orderedIds.map((characterId, index) => {
          const character = charactersById.get(characterId);
          if (!character) return null;
          const cardId = index + 1;
          const details = character.details as Array<Record<string, unknown>> | undefined;
          return (
            <CharacterCard
              gridTile
              dragProps={getDragProps(characterId)}
              dragging={draggingId === characterId}
              imageUrls={characterGallery(character)}
              key={characterId}
              id={cardId}
              name={character.name as string}
              details={details}
              locked={character.lockedVersion != null}
              onToggleLock={() =>
                updateCharacterLockMutation.mutate({
                  characterId: character._id as string,
                  locked: character.lockedVersion == null,
                })
              }
              onAddVersion={() => addCharacterVersionMutation.mutate(character._id as string)}
              onEditClick={(detail) => handleEditClick(character, detail)}
              onDeleteClick={
                // The server rejects deletes while the section is locked, so hide the control
                // entirely rather than offering an action that can only fail.
                charactersSectionLocked
                  ? undefined
                  : () =>
                      setCharacterPendingDelete({
                        characterId: character._id as string,
                        name: (character.name as string) ?? 'This character',
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
      <NewCharacterForm
        open={Boolean(editingCharacter)}
        onCancel={() => setEditingCharacter(null)}
        onSubmit={handleEditSubmit}
        submitting={updateCharacterDetailsMutation.isPending}
        initialValues={editingCharacter?.initialValues}
      />
      <Dialog
        open={Boolean(characterPendingDelete)}
        onClose={() => setCharacterPendingDelete(null)}
      >
        <DialogTitle>Delete character?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`"${characterPendingDelete?.name?.trim() || 'This character'}" and all of its versions will be permanently deleted. This can't be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCharacterPendingDelete(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteCharacterMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <AppAlert
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
        severity="error"
      />
    </ProjectDetailsLayout>
  );
}
