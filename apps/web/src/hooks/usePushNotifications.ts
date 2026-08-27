'use client';

import * as React from 'react';
import { authRequest } from '@/lib/authRequest';
import { REGISTER_PUSH_SUBSCRIPTION, UNREGISTER_PUSH_SUBSCRIPTION } from '@/mutations/PushMutations';
import { useUserProfileStore } from '@/state/user';
import { useChatNotificationsStore } from '@/state/chatNotifications';
import { getNotificationPermission, requestNotificationPermission } from '@/lib/desktopNotifications';
import {
  ensureServiceWorker,
  getExistingSubscription,
  getPushSupport,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/**
 * Turns notifications on for this device.
 *
 * The permission prompt has to come from a user gesture, so this is called from the settings row
 * rather than on load. Subscribing is left to the runtime effect below: a failure there then
 * retries on the next page load instead of leaving a device stuck off.
 */
export async function enableChatNotifications(): Promise<void> {
  const { setEnabled, setBusy, setCapabilities, setPromptSuppressed, support } =
    useChatNotificationsStore.getState();
  setBusy(true);
  try {
    const permission = await requestNotificationPermission();
    setCapabilities({ support, permission });
    setEnabled(permission === 'granted');
    // Still 'default' means the browser never put the question to the user — Chrome's quiet prompt
    // fading out unanswered, most often. Without saying so, the UI just sits there looking broken.
    setPromptSuppressed(permission === 'default');
  } finally {
    setBusy(false);
  }
}

/** Turns them off on this device alone — other devices keep their own registrations. */
export async function disableChatNotifications(): Promise<void> {
  const { setEnabled, setBusy, setPushSubscribed } = useChatNotificationsStore.getState();
  setBusy(true);
  setEnabled(false);
  try {
    const endpoint = await unsubscribeFromPush();
    setPushSubscribed(false);
    if (endpoint) await authRequest(UNREGISTER_PUSH_SUBSCRIPTION, { endpoint });
  } catch (error) {
    console.error('[push] could not unregister subscription', error);
  } finally {
    setBusy(false);
  }
}

/**
 * Owns this device's Web Push registration and answers the service worker's suppression checks.
 *
 * Mount exactly once, app-wide — a second copy would race the first to subscribe and answer the
 * worker twice. Anything that only needs to read or flip the setting uses the store and the two
 * functions above instead.
 */
export function usePushNotificationsRuntime(): void {
  const uid = useUserProfileStore((s) => s.userProfile?.user ?? null);
  const enabled = useChatNotificationsStore((s) => s.enabled);
  const support = useChatNotificationsStore((s) => s.support);
  const permission = useChatNotificationsStore((s) => s.permission);
  const setCapabilities = useChatNotificationsStore((s) => s.setCapabilities);
  const setPushSubscribed = useChatNotificationsStore((s) => s.setPushSubscribed);

  /**
   * Read after mount only — neither value exists during the server render, and a value guessed
   * there would hydrate as a mismatch.
   *
   * Re-read on every change, not just once. Someone who finds the setting blocked leaves to fix it
   * in browser or OS settings and comes back to the same page; without this the app still believes
   * the stale answer and leaves the switch greyed out with no way to prove otherwise.
   */
  React.useEffect(() => {
    const refresh = () => setCapabilities({ support: getPushSupport(), permission: getNotificationPermission() });
    refresh();

    let cancelled = false;
    let status: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        result.addEventListener('change', refresh);
      })
      .catch(() => {
        // Safari has no queryable notifications permission; the visibility listener covers it.
      });

    // The moment a trip to browser settings ends is the moment the old answer stops being true.
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      cancelled = true;
      status?.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [setCapabilities]);

  /**
   * The service worker asks, on every push, whether the message is already on screen. Only the
   * page knows which conversation is open, so only the page can answer.
   */
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'writual-push-check') return;
      const port = event.ports?.[0];
      if (!port) return;
      const { activeConversationId } = useChatNotificationsStore.getState();
      const conversationId = event.data.payload?.conversationId;
      port.postMessage({
        suppress: Boolean(conversationId) && conversationId === activeConversationId && !document.hidden,
      });
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  /**
   * Re-subscribes on every load once the user has said yes. This is the repair path as much as the
   * setup path — browsers expire and rotate subscriptions on their own, and the server drops any
   * endpoint the push service reports as gone.
   */
  React.useEffect(() => {
    if (!uid || support !== 'supported' || !VAPID_PUBLIC_KEY) return;
    if (!enabled || permission !== 'granted') return;

    let cancelled = false;
    (async () => {
      await ensureServiceWorker();
      const payload = await subscribeToPush(VAPID_PUBLIC_KEY);
      if (cancelled || !payload) return;
      try {
        await authRequest(REGISTER_PUSH_SUBSCRIPTION, { ...payload });
        if (!cancelled) setPushSubscribed(true);
      } catch (error) {
        console.error('[push] could not register subscription', error);
      }
    })();

    return () => { cancelled = true; };
    // `permission` has to be a dependency, not something read inside the body. Granting it is the
    // event that makes subscribing possible, and it is the only one of these that changes when the
    // user answers the prompt — without it here, a first-time grant subscribed nothing until the
    // next page load.
  }, [uid, enabled, permission, support, setPushSubscribed]);

  // Keeps the reported state honest when a subscription was made in an earlier session, or has
  // been dropped from browser settings since.
  React.useEffect(() => {
    if (support !== 'supported') return;
    getExistingSubscription().then((sub) => setPushSubscribed(Boolean(sub)));
  }, [support, enabled, setPushSubscribed]);
}
