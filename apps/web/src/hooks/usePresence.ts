'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PusherClient, { type PresenceChannel } from 'pusher-js';
import { getFirebaseAuth } from '@/lib/firebase';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';

interface PresenceMember {
  id: string;
  info: { name: string };
}

export interface UsePresenceReturn {
  typingUsers: string[];
  onlineUserIds: string[];
  sendTypingEvent: () => void;
}

export function usePresence(projectId: string | null): UsePresenceReturn {
  const userProfile = useUserProfileStore((s) => s.userProfile);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const channelRef = useRef<PresenceChannel | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTypingEventRaw = useCallback(() => {
    if (!channelRef.current || !userProfile?.displayName) return;
    try {
      (channelRef.current as any).trigger('client-typing', {
        name: userProfile.displayName,
        uid: userProfile.user,
      });
    } catch {
      // swallow — channel may not be subscribed yet
    }
  }, [userProfile]);

  const sendTypingEvent = useCallback(() => {
    if (typingThrottleRef.current) return;
    sendTypingEventRaw();
    typingThrottleRef.current = setTimeout(() => {
      typingThrottleRef.current = null;
    }, 1500);
  }, [sendTypingEventRaw]);

  useEffect(() => {
    if (!projectId) return;

    const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      channelAuthorization: {
        transport: 'ajax',
        endpoint: `${GRAPHQL_ENDPOINT}/api/pusher/auth`,
        customHandler: async ({ socketId, channelName }, callback) => {
          try {
            const token = await getFirebaseAuth().currentUser?.getIdToken();
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

    const channelName = `presence-project-${projectId}`;
    const channel = pusherClient.subscribe(channelName) as PresenceChannel;
    channelRef.current = channel;

    channel.bind('pusher:subscription_succeeded', (members: any) => {
      const ids: string[] = [];
      members.each((m: PresenceMember) => ids.push(m.id));
      setOnlineUserIds(ids);
    });

    channel.bind('pusher:member_added', (member: PresenceMember) => {
      setOnlineUserIds((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    });

    channel.bind('pusher:member_removed', (member: PresenceMember) => {
      setOnlineUserIds((prev) => prev.filter((id) => id !== member.id));
    });

    channel.bind('client-typing', (data: { name: string; uid: string }) => {
      if (data.uid === userProfile?.user) return;
      setTypingUsers((prev) => (prev.includes(data.name) ? prev : [...prev, data.name]));
      clearTimeout(typingTimers.current[data.name]);
      typingTimers.current[data.name] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== data.name));
      }, 3000);
    });

    return () => {
      Object.values(typingTimers.current).forEach(clearTimeout);
      typingTimers.current = {};
      if (typingThrottleRef.current) clearTimeout(typingThrottleRef.current);
      typingThrottleRef.current = null;
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
      pusherClient.disconnect();
      channelRef.current = null;
      setTypingUsers([]);
      setOnlineUserIds([]);
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { typingUsers, onlineUserIds, sendTypingEvent };
}
