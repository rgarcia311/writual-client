import type { Collaborator } from '@/interfaces/collaborator';

/** What the signed-in viewer may do on a project. Mirrors the API's access checks. */
export interface ProjectAccess {
  canEdit: boolean;
  canComment: boolean;
  isOwner: boolean;
}

export const NO_PROJECT_ACCESS: ProjectAccess = { canEdit: false, canComment: false, isOwner: false };

interface ProjectAccessFields {
  user?: string | null;
  sharedWith?: Array<string | null> | null;
  collaborators?: Array<Partial<Collaborator>> | null;
}

/**
 * Derives the viewer's access from the project payload, matching `verifyProjectWriteAccess` and
 * `verifyProjectCommentAccess` on the server: the owner and legacy `sharedWith` entries get edit
 * access, and collaborators need an active invite at the matching permission level. Collaborator
 * `aspects` are not consulted, because the server does not gate on them either.
 *
 * The UI uses this only to hide what the API would reject — the API remains the enforcement point.
 */
export function deriveProjectAccess(
  project: ProjectAccessFields | null | undefined,
  viewerUid: string | null,
): ProjectAccess {
  if (!project || !viewerUid) return NO_PROJECT_ACCESS;

  const isOwner = (project.user ?? '') === viewerUid;
  const isLegacyShare = (project.sharedWith ?? []).some((uid) => uid === viewerUid);
  const collaborator = (project.collaborators ?? []).find(
    (entry) => entry?.uid === viewerUid && entry?.status === 'active',
  );

  const canEdit = isOwner || isLegacyShare || collaborator?.permissionLevel === 'edit';
  const canComment = canEdit || collaborator?.permissionLevel === 'comment';

  return { canEdit, canComment, isOwner };
}
