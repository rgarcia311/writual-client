'use client';

import { useChatNotifications } from '@/hooks/useChatNotifications';
import { usePushNotificationsRuntime } from '@/hooks/usePushNotifications';

/**
 * Renders nothing. It exists so two things run for the whole session rather than only while the
 * chat page is mounted: the signed-in user's Pusher message channel, which keeps the unread badge
 * live, and this device's Web Push registration, which is what reaches the operating system.
 */
export function ChatNotifications() {
  useChatNotifications();
  usePushNotificationsRuntime();
  return null;
}
