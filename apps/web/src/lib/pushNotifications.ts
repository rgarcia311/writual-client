'use client';

/**
 * Web Push plumbing: service worker registration, subscribe, unsubscribe.
 *
 * This is what makes chat notifications reach the operating system rather than just the page.
 * Platform-by-platform, that matters for different reasons:
 *
 *  - macOS / Windows (Chrome, Edge, Firefox, Safari 16+): the in-page `Notification` constructor
 *    also works, but only while the tab is open. Push works with the tab closed.
 *  - Android (Chrome, Edge, Firefox): the constructor throws outright. A service worker is the
 *    only way to raise a notification at all.
 *  - iOS / iPadOS 16.4+: notifications exist only inside a web app added to the Home Screen, and
 *    only through Web Push. In a normal Safari tab there is no Notification API to call.
 */

const SERVICE_WORKER_URL = '/sw.js';

export type PushSupport =
  /** Everything needed is present — permission can be requested and a subscription created. */
  | 'supported'
  /** iOS Safari in a browser tab. The APIs appear only once the app is on the Home Screen. */
  | 'ios-needs-install'
  /** No service worker or no Push API — nothing to fall back to but an in-page notification. */
  | 'unsupported';

/** True when running as an installed app rather than a browser tab (iOS calls this standalone). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as any).standalone === true
  );
}

/** iOS and iPadOS, including iPadOS's desktop-class Safari, which reports itself as a Mac. */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (hasApis) return 'supported';
  // On iOS the APIs are absent in a tab and present in the installed app, so their absence there
  // is an instruction to install rather than a dead end.
  if (isIosDevice() && !isStandaloneDisplay()) return 'ios-needs-install';
  return 'unsupported';
}

/** VAPID public keys travel as base64url; `PushManager.subscribe` wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Registers the worker, or returns the one already running.
 *
 * Waits for `ready` rather than the register() promise: a freshly installed worker is not yet
 * controlling anything, and `pushManager.subscribe` needs an active one.
 */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.error('[push] service worker registration failed', error);
    return null;
  }
}

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}

function toPayload(subscription: PushSubscription): PushSubscriptionPayload | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth, userAgent: navigator.userAgent };
}

/** This device's existing subscription, if it already has one. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Subscribes this device. Assumes permission is already granted — browsers reject `subscribe`
 * otherwise, and the prompt has to come from a user gesture anyway.
 *
 * A subscription created under a different VAPID key is dropped and remade: the push service
 * rejects payloads signed by any key but the one the subscription was minted with, so a rotated
 * key would otherwise leave this device silently unreachable.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionPayload | null> {
  const registration = await ensureServiceWorker();
  if (!registration) return null;

  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const existingKey = new Uint8Array(existing.options.applicationServerKey ?? new ArrayBuffer(0));
    const matches =
      existingKey.length === applicationServerKey.length &&
      existingKey.every((byte, i) => byte === applicationServerKey[i]);
    if (matches) return toPayload(existing);
    await existing.unsubscribe();
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      // Required to be true by every browser: a push that shows nothing is not allowed.
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });
    return toPayload(subscription);
  } catch (error) {
    console.error('[push] subscribe failed', error);
    return null;
  }
}

/** Drops this device's subscription. Returns the endpoint that was removed, for the server. */
export async function unsubscribeFromPush(): Promise<string | null> {
  const subscription = await getExistingSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  try {
    await subscription.unsubscribe();
  } catch (error) {
    console.error('[push] unsubscribe failed', error);
  }
  return endpoint;
}
