'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import { PROJECT_ACCESS_QUERY } from '@/queries/ProjectQueries';
import { useUserProfileStore } from '@/state/user';
import type { Collaborator } from '@/interfaces/collaborator';

export const PROJECT_SHARING_QUERY_KEY = 'project-sharing';

/** How one person reaches a project: as its owner, a legacy share, or a collaborator row. */
export interface ParticipantAccess {
  /** Set when the person's access has no collaborator row behind it, and so cannot be edited. */
  role: 'owner' | 'legacy-share' | null;
  collaborator: Collaborator | null;
}

/** A screenplay document as a share grant can name it — id and tab label, nothing else. */
export interface SharableScreenplayDocument {
  _id: string;
  name: string;
  isPrimary: boolean;
  order: number;
}

export interface UseProjectSharingResult {
  /** Firebase uid of the project's owner. */
  ownerUid: string | null;
  ownerDisplayName: string | null;
  collaborators: Collaborator[];
  /** Collaborator rows keyed by uid — pending invites have no uid and are absent here. */
  collaboratorByUid: Map<string, Collaborator>;
  /** Legacy `sharedWith` uids, which predate collaborator rows and always mean full edit access. */
  legacyShareUids: string[];
  screenplayDocuments: SharableScreenplayDocument[];
  /** Whether the signed-in viewer owns the project, and so may change other people's access. */
  isViewerOwner: boolean;
  /** How a given uid reaches this project — the chat asks this of every conversation partner. */
  participantAccess: (uid: string) => ParticipantAccess;
  isLoading: boolean;
}

interface ProjectAccessRow {
  _id: string;
  title: string | null;
  user: string | null;
  displayName: string | null;
  sharedWith: Array<string | null> | null;
  collaborators: Collaborator[] | null;
  screenplayDocuments: SharableScreenplayDocument[] | null;
}

/**
 * Who a project is shared with and what each of them was granted.
 *
 * Split out from the page-level project queries so surfaces that only care about *people* — the
 * chat's permission badges and its manage-access dialog — do not have to pull scenes, characters
 * and script bodies to render a chip.
 */
export function useProjectSharing(projectId: string | undefined): UseProjectSharingResult {
  const viewerUid = useUserProfileStore((s) => s.userProfile?.user) ?? null;

  const { data, isLoading } = useQuery({
    queryKey: [PROJECT_SHARING_QUERY_KEY, projectId],
    queryFn: () =>
      authRequest<{ getProjectData?: ProjectAccessRow[] }>(PROJECT_ACCESS_QUERY, {
        input: { user: viewerUid, _id: projectId },
      }),
    enabled: Boolean(projectId && viewerUid),
  });

  const project = data?.getProjectData?.[0] ?? null;

  const collaborators = React.useMemo(
    () => (project?.collaborators ?? []).filter(Boolean),
    [project],
  );

  const collaboratorByUid = React.useMemo(() => {
    const map = new Map<string, Collaborator>();
    for (const collaborator of collaborators) {
      if (collaborator.uid) map.set(collaborator.uid, collaborator);
    }
    return map;
  }, [collaborators]);

  const screenplayDocuments = React.useMemo(
    () =>
      [...(project?.screenplayDocuments ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      ),
    [project],
  );

  const legacyShareUids = React.useMemo(
    () => (project?.sharedWith ?? []).filter((uid): uid is string => Boolean(uid)),
    [project],
  );

  const ownerUid = project?.user ?? null;

  const participantAccess = React.useCallback(
    (uid: string): ParticipantAccess => {
      if (uid && uid === ownerUid) return { role: 'owner', collaborator: null };
      const collaborator = collaboratorByUid.get(uid) ?? null;
      if (collaborator) return { role: null, collaborator };
      // Predates collaborator rows; these shares carry full edit access and no aspect breakdown.
      if (legacyShareUids.includes(uid)) return { role: 'legacy-share', collaborator: null };
      return { role: null, collaborator: null };
    },
    [ownerUid, collaboratorByUid, legacyShareUids],
  );

  return {
    ownerUid,
    ownerDisplayName: project?.displayName ?? null,
    collaborators,
    collaboratorByUid,
    legacyShareUids,
    screenplayDocuments,
    isViewerOwner: Boolean(viewerUid && ownerUid === viewerUid),
    participantAccess,
    isLoading,
  };
}
