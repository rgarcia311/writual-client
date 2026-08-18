'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UPDATE_PROJECT } from '@/mutations/ProjectMutations';
import { authRequest } from '@/lib/authRequest';
import { PROJECT_SCENES_QUERY_KEY } from '@/hooks/useProjectSceneMutations';
import { DeadlineTrackingStat } from '@/components/ProjectCard/stats/DeadlineTrackingStat';
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

/**
 * Deadline Tracking tile plus its editor: the header calendar opens the progress-tracking modal,
 * prefilled with the saved tracker so drafts can be edited or a new deadline added.
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', project.id] }),
        queryClient.invalidateQueries({ queryKey: ['project-tracking-stats', project.id] }),
        queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, project.id] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
    },
    onError: (error: unknown) => {
      console.error('[DeadlineTrackingTile] failed to save deadlines', error);
    },
  });

  return (
    <>
      <DeadlineTrackingStat
        compact={compact}
        deadlines={deadlines}
        trackerEnabled={Boolean(tracker?.enabled)}
        onManageDeadlines={canManage ? () => setModalOpen(true) : undefined}
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
