'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import {
  INVITE_COLLABORATORS,
  UPDATE_COLLABORATOR,
  REMOVE_COLLABORATOR,
} from '@/mutations/ShareMutations';
import { PROJECT_SHARING_QUERY_KEY } from '@hooks/useProjectSharing';
import type { InvitationInput } from '@/interfaces/collaborator';
import type { CollaboratorAccessValue } from './CollaboratorAccessFields';

/**
 * Invite, re-grant and revoke for one project's collaborators.
 *
 * Shared so the share modal and the chat's manage-access dialog invalidate the same caches: a
 * permission changed from the chat has to reach the project cards, and vice versa.
 */
export function useCollaboratorMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['projectChats'] });
    queryClient.invalidateQueries({ queryKey: [PROJECT_SHARING_QUERY_KEY, projectId] });
  };

  const inviteMutation = useMutation({
    mutationFn: (invitations: InvitationInput[]) =>
      authRequest(INVITE_COLLABORATORS, { projectId, invitations }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ collaboratorId, ...access }: { collaboratorId: string } & CollaboratorAccessValue) =>
      authRequest(UPDATE_COLLABORATOR, { projectId, collaboratorId, ...access }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (collaboratorId: string) =>
      authRequest(REMOVE_COLLABORATOR, { projectId, collaboratorId }),
    onSuccess: invalidate,
  });

  return { inviteMutation, updateMutation, removeMutation };
}
