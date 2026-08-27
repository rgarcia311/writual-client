'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { createPusherClient } from './usePusher';
import { useUserProfileStore } from '@/state/user';
import { useChatNotificationsStore } from '@/state/chatNotifications';
import { showDesktopNotification } from '@/lib/desktopNotifications';
import { chatPersonDisplayName } from '@/lib/chatPersonName';
import type { ChatMessage, ConversationThread } from '@/interfaces/chat';

/** What the API pushes to `private-user-{uid}` on every message the user is a recipient of. */
interface IncomingChatMessage extends ChatMessage {
  conversationId: string;
  conversationType: 'direct' | 'group' | null;
  conversationName: string | null;
}

/**
 * The user's own message channel, subscribed once for the whole session rather than per page.
 *
 * `usePusher` only runs on the chat page and only for the conversation on screen. This carries
 * every message the signed-in user is a recipient of, from any conversation in any project, which
 * is what the side nav's unread badge and the OS notification both need — neither can wait for the
 * reader to open the thread the message belongs to.
 */
export function useChatNotifications() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const uid = useUserProfileStore((s) => s.userProfile?.user ?? null);

  // Read through refs: these change often and must not tear down the subscription when they do.
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!uid) return;
    // This hook mounts app-wide, including on routes that never touch chat. Without Pusher
    // configured the client constructor throws, and a missing key must not take those pages down.
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return;

    const pusherClient = createPusherClient();
    const channelName = `private-user-${uid}`;
    const channel = pusherClient.subscribe(channelName);

    channel.bind('new-message', (message: IncomingChatMessage) => {
      const { conversationId, projectId } = message;
      if (!conversationId) return;

      // Sent by this user from another tab — the server already leaves them off the recipient
      // list, this only guards against a payload that slipped through.
      if (message.sender?.uid && message.sender.uid === uid) return;

      const { enabled, activeConversationId, pushSubscribed } = useChatNotificationsStore.getState();
      // Already on screen: the feed marks it read as it arrives, so counting it would leave a
      // badge the reader has no way to clear.
      const isOnScreen = activeConversationId === conversationId && !document.hidden;

      if (!isOnScreen) {
        queryClient.setQueryData(
          ['projectConversations', projectId],
          (old: ConversationThread[] | undefined) =>
            old?.map((t) =>
              t._id === conversationId
                ? { ...t, lastMessage: message, unreadCount: t.unreadCount + 1 }
                : t,
            ),
        );
      }

      if (!enabled || isOnScreen) return;
      // A push-subscribed device gets its banner from the service worker, which fires whether or
      // not this page is running. Raising one here too would ring the same message twice.
      if (pushSubscribed) return;

      const senderName = chatPersonDisplayName(message.sender, 'New message');
      const title =
        message.conversationType === 'group' && message.conversationName
          ? `${senderName} in ${message.conversationName}`
          : senderName;

      const url = `/project/${projectId}/chat`;
      void showDesktopNotification({
        title,
        body: message.text,
        // Matches the service worker's tag, so the two routes can never stack for one conversation.
        tag: `writual-chat-${conversationId}`,
        url,
        onClick: () => routerRef.current.push(url),
      });
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
      pusherClient.disconnect();
    };
  }, [uid, queryClient]);
}
