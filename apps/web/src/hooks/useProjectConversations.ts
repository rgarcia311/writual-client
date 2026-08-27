'use client';

import { useQuery } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import { GET_PROJECT_CONVERSATIONS } from '@/queries/ChatQueries';
import type { ConversationThread } from '@/interfaces/chat';

/**
 * A project's conversations, keyed so the chat page and the side nav's unread badge share one
 * fetch and one cache entry — `useChatNotifications` writes arriving messages straight into it,
 * and both re-render off that write.
 */
export function useProjectConversations(projectId: string | null) {
  return useQuery({
    queryKey: ['projectConversations', projectId],
    queryFn: () =>
      authRequest<{ getProjectConversations: ConversationThread[] }>(GET_PROJECT_CONVERSATIONS, { projectId })
        .then((d) => d.getProjectConversations),
    enabled: Boolean(projectId),
  });
}

/** Unread messages across every conversation in the project — what the side nav badge shows. */
export function useProjectUnreadCount(projectId: string | null): number {
  const { data } = useProjectConversations(projectId);
  return (data ?? []).reduce((total, thread) => total + (thread.unreadCount ?? 0), 0);
}
