/**
 * Raising a notification banner from the page.
 *
 * The service worker is the primary route — Android Chrome throws on the `Notification`
 * constructor and only accepts `ServiceWorkerRegistration.showNotification`, and iOS has no
 * constructor to call outside an installed app. The constructor is kept only as a fallback for a
 * desktop browser where the worker failed to register.
 *
 * This path covers the case where a message arrives at a page that is already open. Anything that
 * has to reach a closed tab or a backgrounded phone goes through Web Push instead — see
 * `lib/pushNotifications.ts`.
 */

export type NotificationSupport = NotificationPermission | 'unsupported';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationSupport {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Ask for permission. Call this from a user gesture — Safari ignores it otherwise, and a browser
 * that has already denied resolves straight back to 'denied' without prompting again.
 */
export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    // Older Safari only has the callback form and returns undefined from the call.
    const result = await new Promise<NotificationPermission>((resolve) => {
      const returned = Notification.requestPermission(resolve);
      if (returned && typeof (returned as any).then === 'function') {
        (returned as Promise<NotificationPermission>).then(resolve);
      }
    });
    return result ?? Notification.permission;
  } catch {
    return Notification.permission;
  }
}

interface ShowNotificationOptions {
  title: string;
  body: string;
  /** Same tag replaces the previous banner instead of stacking one per message. */
  tag?: string;
  /** Where a click should land. Read by the service worker, which handles the click. */
  url?: string;
  /** Only used by the constructor fallback — a worker-owned banner outlives this page. */
  onClick?: () => void;
}

/** Fires the banner if it can. Returns false when unsupported, not permitted, or blocked. */
export async function showDesktopNotification({
  title,
  body,
  tag,
  url,
  onClick,
}: ShowNotificationOptions): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;

  // Preferred route: the service worker owns the banner, so a click can reopen the app even after
  // this page is gone, and Android accepts it.
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration) {
        await registration.showNotification(title, {
          body,
          tag,
          icon: '/android-chrome-192x192.png',
          badge: '/favicon-32x32.png',
          data: url ? { url } : undefined,
        });
        return true;
      }
    } catch {
      // Fall through to the constructor below.
    }
  }

  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
      onClick?.();
    };
    return true;
  } catch {
    // Android Chrome throws here: it only allows notifications through a service worker.
    return false;
  }
}
