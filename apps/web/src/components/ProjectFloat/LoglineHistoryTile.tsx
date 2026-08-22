'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import {
  ADD_LOGLINE_FEEDBACK,
  ADD_LOGLINE_VERSION,
  DELETE_LOGLINE_FEEDBACK,
  DELETE_LOGLINE_VERSION,
  SEED_LOGLINE_HISTORY,
  SET_CURRENT_LOGLINE_VERSION,
  UPDATE_LOGLINE_VERSION,
} from '@/mutations/LoglineMutations';
import { LoglineHistoryStat } from '@/components/ProjectCard/stats/LoglineHistoryStat';
import { LoglineHistoryModal } from '@/components/LoglineHistory';
import { useUserProfileStore } from '@/state/user';
import type { LoglineVersion } from '@/interfaces/logline';
import type { ProjectAccess } from '../../utils/projectPermissions';

/** How many times the tile will try to seed the history before leaving it to a user action. */
const MAX_SEED_ATTEMPTS = 2;

export interface LoglineHistoryTileProps {
  versions: LoglineVersion[];
  /** `project.logline`, shown until the history has been seeded. */
  currentLogline: string;
  access: ProjectAccess;
  /** Project identity; without an id the tile is read-only. */
  projectId: string;
  compact?: boolean;
}

/**
 * Logline History tile plus its mutations. Every action goes through the dedicated logline
 * mutations (never `updateProject`), so the history and `project.logline` stay in step server-side.
 */
export function LoglineHistoryTile({
  versions,
  currentLogline,
  access,
  projectId,
  compact = false,
}: LoglineHistoryTileProps) {
  const queryClient = useQueryClient();
  const viewerUid = useUserProfileStore((s) => s.userProfile?.user ?? null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const canMutate = Boolean(projectId);

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-tracking-stats', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
    ]);
  }, [queryClient, projectId]);

  /** One mutation shape for every logline action: run it, refresh, surface failures inline. */
  const runMutation = useMutation({
    mutationFn: ({ document, variables }: { document: string; variables: Record<string, unknown> }) =>
      authRequest(document, { projectId, ...variables }),
    onSuccess: async () => {
      setErrorMessage(null);
      await refresh();
    },
    onError: (error: { message?: string }) => {
      console.error('[LoglineHistoryTile] logline mutation failed', error);
      // graphql-request appends the raw response after the message; keep just the message. The
      // composer holds on to its text when a save fails, so nothing typed is lost.
      const message = error?.message?.split(':')[0]?.trim();
      setErrorMessage(message || 'Could not save. Please try again.');
    },
  });

  // `mutate` is referentially stable, so `run` — and the handlers built from it — stay stable too.
  const { mutate } = runMutation;
  const run = React.useCallback(
    (document: string, variables: Record<string, unknown> = {}) => {
      if (!canMutate) return;
      mutate({ document, variables });
    },
    [canMutate, mutate],
  );

  // Prepopulate the history from the project's existing logline. The mutation is idempotent
  // server-side; the counter keeps a re-render from firing it repeatedly, while still allowing one
  // retry if the first attempt failed (e.g. a transient network error).
  const seedAttemptsRef = React.useRef(0);
  React.useEffect(() => {
    if (seedAttemptsRef.current >= MAX_SEED_ATTEMPTS) return;
    if (!canMutate || !access.canEdit) return;
    if (versions.length > 0 || !currentLogline.trim()) return;
    seedAttemptsRef.current += 1;
    run(SEED_LOGLINE_HISTORY);
  }, [canMutate, access.canEdit, versions.length, currentLogline, run]);

  const handlers = React.useMemo(
    () => ({
      onAddVersion: (text: string) => run(ADD_LOGLINE_VERSION, { text }),
      onUpdateVersion: (versionId: string, text: string) =>
        run(UPDATE_LOGLINE_VERSION, { versionId, text }),
      onDeleteVersion: (versionId: string) => run(DELETE_LOGLINE_VERSION, { versionId }),
      onMakeCurrent: (versionId: string) => run(SET_CURRENT_LOGLINE_VERSION, { versionId }),
      onAddFeedback: (versionId: string, text: string) =>
        run(ADD_LOGLINE_FEEDBACK, { versionId, text }),
      onDeleteFeedback: (versionId: string, feedbackId: string) =>
        run(DELETE_LOGLINE_FEEDBACK, { versionId, feedbackId }),
    }),
    [run],
  );

  const viewProps = {
    versions,
    currentLogline,
    access,
    viewerUid,
    isPending: runMutation.isPending,
    errorMessage,
    ...handlers,
  };

  return (
    <>
      <LoglineHistoryStat {...viewProps} compact={compact} onExpand={() => setModalOpen(true)} />
      {modalOpen ? (
        <LoglineHistoryModal {...viewProps} open onClose={() => setModalOpen(false)} />
      ) : null}
    </>
  );
}
