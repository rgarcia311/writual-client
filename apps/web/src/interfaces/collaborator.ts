export type AspectKey = 'logline' | 'characters' | 'outline' | 'treatment' | 'screenplay';
export type PermissionLevel = 'edit' | 'comment';

export interface Collaborator {
  _id: string;
  email: string;
  uid: string | null;
  status: 'pending' | 'active';
  permissionLevel: PermissionLevel;
  aspects: AspectKey[];
  invitedAt: string | null;
}

export interface InvitationInput {
  email: string;
  permissionLevel: PermissionLevel;
  aspects: AspectKey[];
}

export const ALL_ASPECTS: AspectKey[] = ['logline', 'characters', 'outline', 'treatment', 'screenplay'];

export const ASPECT_LABELS: Record<AspectKey, string> = {
  logline:    'Logline',
  characters: 'Characters',
  outline:    'Outline',
  treatment:  'Treatment',
  screenplay: 'Screenplay',
};
