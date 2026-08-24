export type AspectKey = 'logline' | 'characters' | 'outline' | 'treatment' | 'screenplay';
export type PermissionLevel = 'edit' | 'comment';

export interface Collaborator {
  _id: string;
  email: string;
  uid: string | null;
  status: 'pending' | 'active';
  permissionLevel: PermissionLevel;
  aspects: AspectKey[];
  /**
   * Screenplay documents this collaborator was granted. Empty means every document on the project,
   * including ones added after the invite — see `hasAllScreenplayDocuments`.
   */
  screenplayDocumentIds: string[];
  invitedAt: string | null;
}

export interface InvitationInput {
  email: string;
  permissionLevel: PermissionLevel;
  aspects: AspectKey[];
  screenplayDocumentIds: string[];
}

export const ALL_ASPECTS: AspectKey[] = ['logline', 'characters', 'outline', 'screenplay'];

export const ASPECT_LABELS: Record<AspectKey, string> = {
  logline:    'Logline',
  characters: 'Characters',
  outline:    'Outline',
  // Legacy: the Treatment feature was removed, but existing collaborator records may
  // still carry this aspect. Keep a label so the UI can render it without crashing.
  treatment:  'Treatment (Legacy)',
  screenplay: 'Screenplay',
};

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  edit:    'Can edit',
  comment: 'Comment only',
};

/** Short form for chips and inline badges, where "Can edit" is more words than the space allows. */
export const PERMISSION_SHORT_LABELS: Record<PermissionLevel, string> = {
  edit:    'Edit',
  comment: 'Comment',
};

/**
 * True when the collaborator reaches every screenplay document on the project.
 *
 * The server stores "all" as an empty list rather than as every id, so a draft added tomorrow is
 * covered without the owner having to re-share. Callers must not read an empty list as "none".
 */
export function hasAllScreenplayDocuments(
  collaborator: Pick<Collaborator, 'screenplayDocumentIds'> | null | undefined,
): boolean {
  return (collaborator?.screenplayDocumentIds?.length ?? 0) === 0;
}
