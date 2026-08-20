'use client';

import * as React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';
import { ScrollableContentArea } from '@/components/shared/ScrollableContentArea/ScrollableContentArea';
import {
  NoteCard,
  NoteCardSkeleton,
  noteStatusFlags,
  type AssociationTarget,
  type Note,
  type NoteStatus,
} from '@/components/NoteCard';
import { NewNoteForm, type NewNoteValues } from '@/components/NewNoteForm';
import { AppAlert } from '@/components/AppAlert';
import { FeatureGate } from '@/components/Auth/FeatureGate';
import { useProjectNotes, valuesToPayload } from './useProjectNotes';
import { NotesFilterBar } from './NotesFilterBar';
import { NotesReferencePanesLayer } from './NotesReferencePanesLayer';
import { useNoteReferencePanes, type PaneAnchor } from './useNoteReferencePanes';
import {
  ALL_ASSOCIATIONS,
  ALL_CATEGORIES,
  GENERAL_ASSOCIATION,
  matchesNoteFilters,
  sortNotes,
  type NoteSortMode,
  type NoteStatusFilter,
} from './noteFiltering';
import '@/styles/notesPage.css';

interface NotesContentProps {
  projectId: string;
}

const NOTES_PAGE_STAT_KEYS = ['characters', 'deadlines'] as const;

/** Maps a stored note back into the form's value shape for editing. */
function noteToValues(note: Note): NewNoteValues {
  return {
    title: note.title,
    category: note.category,
    content: note.content,
    incorporated: note.incorporated,
    shouldIncorporate: note.shouldIncorporate,
    associationKind: note.association.kind,
    associationTargetId: note.association.targetId,
    associationLabel: note.association.label,
  };
}

export function NotesContent({ projectId }: NotesContentProps) {
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('Failed to save note.');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<Note | null>(null);
  const [notePendingDelete, setNotePendingDelete] = React.useState<Note | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<NoteStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<string>(ALL_CATEGORIES);
  const [associationFilter, setAssociationFilter] = React.useState<string>(ALL_ASSOCIATIONS);
  const [sortMode, setSortMode] = React.useState<NoteSortMode>('newest');

  const handleError = React.useCallback((message: string) => {
    setErrorMessage(message);
    setErrorOpen(true);
  }, []);

  const {
    notes,
    categoryOptions,
    associationTargets,
    associationTargetsById,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
  } = useProjectNotes({ projectId, onError: handleError });

  const openReferencePane = useNoteReferencePanes();

  // A category can disappear when its last note is retagged or deleted; fall back to "all"
  // so the grid doesn't silently filter down to nothing.
  React.useEffect(() => {
    if (categoryFilter !== ALL_CATEGORIES && !categoryOptions.includes(categoryFilter)) {
      setCategoryFilter(ALL_CATEGORIES);
    }
  }, [categoryOptions, categoryFilter]);

  // A linked character/scene/inspiration item can be deleted out from under the filter;
  // fall back to "all" rather than showing an empty grid against a dead target.
  React.useEffect(() => {
    if (
      associationFilter !== ALL_ASSOCIATIONS &&
      associationFilter !== GENERAL_ASSOCIATION &&
      !associationTargetsById.has(associationFilter)
    ) {
      setAssociationFilter(ALL_ASSOCIATIONS);
    }
  }, [associationTargetsById, associationFilter]);

  const visibleNotes = React.useMemo(() => {
    const filters = {
      status: statusFilter,
      category: categoryFilter,
      association: associationFilter,
    };
    const matching = notes.filter((note) => matchesNoteFilters(note, filters));
    return sortNotes(matching, sortMode, associationTargetsById);
  }, [notes, statusFilter, categoryFilter, associationFilter, sortMode, associationTargetsById]);

  const handleCreateSubmit = (values: NewNoteValues) => {
    createMutation.mutate(values, { onSuccess: () => setCreateOpen(false) });
  };

  const handleEditSubmit = (values: NewNoteValues) => {
    if (!editingNote) return;
    updateMutation.mutate(
      { noteId: editingNote._id, payload: valuesToPayload(values) },
      { onSuccess: () => setEditingNote(null) }
    );
  };

  const handleStatusChange = (note: Note, status: NoteStatus) => {
    updateMutation.mutate({ noteId: note._id, payload: noteStatusFlags(status) });
  };

  const handleAssociationClick = (target: AssociationTarget, anchor: PaneAnchor) => {
    openReferencePane(target, anchor);
  };

  const handleConfirmDelete = () => {
    if (!notePendingDelete) return;
    deleteMutation.mutate(notePendingDelete._id, { onSuccess: () => setNotePendingDelete(null) });
  };

  const breadcrumbActions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
      <FeatureGate minTier="indie">
        <Button
          variant="contained"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Create Note
        </Button>
      </FeatureGate>
    </Box>
  );

  return (
    <ProjectDetailsLayout
      showFloatStatsRail
      floatStatsRailKeys={[...NOTES_PAGE_STAT_KEYS]}
      breadcrumbRightAdornment={breadcrumbActions}
      contentSx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 'none',
        minHeight: 0,
        overflow: 'visible',
        pl: 0,
        pt: 0,
      }}
    >
      <NotesFilterBar
        status={statusFilter}
        onStatusChange={setStatusFilter}
        category={categoryFilter}
        onCategoryChange={setCategoryFilter}
        categoryOptions={categoryOptions}
        association={associationFilter}
        onAssociationChange={setAssociationFilter}
        associationTargets={associationTargets}
        sort={sortMode}
        onSortChange={setSortMode}
      />

      <ScrollableContentArea
        className="notes-page-cards"
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
        {createMutation.isPending && <NoteCardSkeleton gridTile />}
        {isLoading && notes.length === 0 && (
          <>
            <NoteCardSkeleton gridTile />
            <NoteCardSkeleton gridTile />
            <NoteCardSkeleton gridTile />
          </>
        )}
        {visibleNotes.map((note) => (
          <NoteCard
            gridTile
            key={note._id}
            note={note}
            associationTarget={
              note.association.targetId
                ? associationTargetsById.get(note.association.targetId)
                : undefined
            }
            onEditClick={setEditingNote}
            onDeleteClick={setNotePendingDelete}
            onStatusChange={handleStatusChange}
            onAssociationClick={handleAssociationClick}
          />
        ))}
      </ScrollableContentArea>

      {!isLoading && !createMutation.isPending && visibleNotes.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
          {notes.length === 0
            ? 'No notes yet. Create one to start collecting ideas, research and reminders.'
            : 'No notes match the current filters.'}
        </Typography>
      )}

      <NewNoteForm
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        submitting={createMutation.isPending}
        categoryOptions={categoryOptions}
        associationTargets={associationTargets}
      />
      <NewNoteForm
        open={Boolean(editingNote)}
        onCancel={() => setEditingNote(null)}
        onSubmit={handleEditSubmit}
        submitting={updateMutation.isPending}
        initialValues={editingNote ? noteToValues(editingNote) : undefined}
        categoryOptions={categoryOptions}
        associationTargets={associationTargets}
      />

      <Dialog open={Boolean(notePendingDelete)} onClose={() => setNotePendingDelete(null)}>
        <DialogTitle>Delete note?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`"${notePendingDelete?.title?.trim() || 'Untitled note'}" will be permanently deleted. This can't be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotePendingDelete(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <NotesReferencePanesLayer />

      <AppAlert
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
        severity="error"
      />
    </ProjectDetailsLayout>
  );
}
