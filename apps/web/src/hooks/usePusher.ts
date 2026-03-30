'use client';

import { useEffect } from 'react';
import PusherClient from 'pusher-js';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import type { ChatMessage, ConversationThread } from '@/interfaces/chat';

function createPusherClient() {
  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    channelAuthorization: {
      transport: 'ajax',
      endpoint: `${GRAPHQL_ENDPOINT}/api/pusher/auth`,
      customHandler: async ({ socketId, channelName }, callback) => {
        try {
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch(`${GRAPHQL_ENDPOINT}/api/pusher/auth`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
          });
          if (!res.ok) { callback(new Error(`Auth ${res.status}`), null); return; }
          callback(null, await res.json());
        } catch (err) {
          callback(err as Error, null);
        }
      },
    },
  });
}

export function usePusher(conversationId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();

  // Subscribe to conversation channel for real-time messages
  useEffect(() => {
    if (!conversationId) return;

    const pusherClient = createPusherClient();
    const channelName = `private-conversation-${conversationId}`;
    const channel = pusherClient.subscribe(channelName);

    channel.bind('new-message', (message: ChatMessage) => {
      queryClient.setQueryData(
        ['messages', conversationId],
        (old: InfiniteData<ChatMessage[]> | undefined) => {
          if (!old) return old;
          const firstPage = old.pages[0] ?? [];
          const matchIdx =
            message.clientGeneratedId != null
              ? firstPage.findIndex((m) => m.clientGeneratedId === message.clientGeneratedId)
              : -1;
          const newFirstPage =
            matchIdx >= 0
              ? firstPage.map((m, i) => (i === matchIdx ? message : m))
              : [message, ...firstPage];
          return { ...old, pages: [newFirstPage, ...old.pages.slice(1)] };
        }
      );
      // Update lastMessage in the conversation list
      if (projectId) {
        queryClient.setQueryData(
          ['projectConversations', projectId],
          (old: ConversationThread[] | undefined) =>
            old?.map((t) => (t._id === conversationId ? { ...t, lastMessage: message } : t))
        );
      }
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
      pusherClient.disconnect();
    };
  }, [conversationId, projectId, queryClient]);

  // Subscribe to project channel for new-conversation discovery
  useEffect(() => {
    if (!projectId) return;

    const pusherClient = createPusherClient();
    const channelName = `private-project-${projectId}`;
    const channel = pusherClient.subscribe(channelName);

    channel.bind('new-conversation', () => {
      queryClient.invalidateQueries({ queryKey: ['projectConversations', projectId] });
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
      pusherClient.disconnect();
    };
  }, [projectId, queryClient]);
}
