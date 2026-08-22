'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UPDATE_PROJECT } from '@/mutations/ProjectMutations';
import { authRequest } from '@/lib/authRequest';
import { PROJECT_SCENES_QUERY_KEY } from '@/hooks/useProjectSceneMutations';
import { DeadlineTrackingStat } from '@/components/ProjectCard/stats/DeadlineTrackingStat';
import type { DeadlineDraftValue } from '@/components/ProjectCard/stats/DeadlineRowEditor';
import {
  ProgressTrackingModal,
  type SerializedTracker,
} from '@/components/ProjectCard/ProgressTrackingModal';
import type { WritingTracker } from '@/interfaces/project';
import type { DraftDeadline } from '../../utils/progress';

export interface DeadlineTrackingTileProps {
  deadlines: DraftDeadline[];
  tracker: WritingTracker | null;
  /** Identity needed by `updateProject`; without it the tile is read-only. */
  project: { id: string; user: string; title: string; type?: string };
  compact?: boolean;
}

function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type DraftRow = SerializedTracker['draftDueDates'][number];

/** Date order with draft numbers reassigned, so an edited date re-ranks the drafts it moved past. */
function normalizeRows(rows: DraftRow[]): DraftRow[] {
  return rows
    .slice()
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .map((row, i) => ({ ...row, draftNumber: i + 1 }));
}

/**
 * Deadline Tracking tile plus its editors: the header calendar opens the progress-tracking modal,
 * and each row in the tile can be edited or deleted in place.
 */
export function DeadlineTrackingTile({
  deadlines,
  tracker,
  project,
  compact = false,
}: DeadlineTrackingTileProps) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const canManage = Boolean(project.id && project.user && project.title);

  const invalidateProject = React.useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', project.id] }),
        queryClient.invalidateQueries({ queryKey: ['project-tracking-stats', project.id] }),
        queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, project.id] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]),
    [queryClient, project.id],
  );

  const saveTracker = useMutation({
    mutationFn: (writingTracker: SerializedTracker) =>
      authRequest(UPDATE_PROJECT, {
        _id: project.id,
        user: project.user,
        title: project.title,
        writingTracker,
        progressTrackingEnabled: true,
      }),
    onSuccess: async () => {
      setModalOpen(false);
      await invalidateProject();
    },
    onError: (error: unknown) => {
      console.error('[DeadlineTrackingTile] failed to save deadlines', error);
    },
  });

  /** Rewrites the saved draft list; `nextRows` is derived from the tracker the tile is showing. */
  const persistRows = React.useCallback(
    (nextRows: DraftRow[]) =>
      saveTracker.mutateAsync({
        enabled: true,
        targetPageCount: tracker?.targetPageCount ?? null,
        currentPageCount: tracker?.currentPageCount ?? null,
        // Keep the original start date — resetting it would restate pace and schedule.
        trackingStartDate: tracker?.trackingStartDate ?? localDateString(),
        draftDueDates: normalizeRows(nextRows),
      }),
    [saveTracker, tracker],
  );

  const savedRows = React.useMemo<DraftRow[]>(
    () =>
      (tracker?.draftDueDates ?? []).map((row, i) => ({
        draftNumber: row.draftNumber ?? i + 1,
        label: row.label ?? '',
        dueDate: row.dueDate ?? '',
        tag: row.tag ?? null,
      })),
    [tracker],
  );

  const handleSaveDeadline = React.useCallback(
    (draftNumber: number, next: DeadlineDraftValue) =>
      persistRows(
        savedRows.map((row) =>
          row.draftNumber === draftNumber
            ? { ...row, label: next.label, dueDate: next.dueDate, tag: next.tag || null }
            : row,
        ),
      ),
    [persistRows, savedRows],
  );

  const handleDeleteDeadline = React.useCallback(
    (draftNumber: number) =>
      persistRows(savedRows.filter((row) => row.draftNumber !== draftNumber)),
    [persistRows, savedRows],
  );

  return (
    <>
      <DeadlineTrackingStat
        compact={compact}
        deadlines={deadlines}
        trackerEnabled={Boolean(tracker?.enabled)}
        onManageDeadlines={canManage ? () => setModalOpen(true) : undefined}
        onSaveDeadline={canManage ? handleSaveDeadline : undefined}
        onDeleteDeadline={canManage ? handleDeleteDeadline : undefined}
      />
      {modalOpen ? (
        <ProgressTrackingModal
          open
          onClose={() => setModalOpen(false)}
          projectTitle={project.title}
          projectType={project.type}
          tracker={tracker}
          isPending={saveTracker.isPending}
          onSubmit={(next) => saveTracker.mutate(next)}
        />
      ) : null}
    </>
  );
}
