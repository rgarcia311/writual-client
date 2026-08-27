/* eslint-disable no-restricted-globals */
/**
 * Writual service worker — notifications only.
 *
 * It deliberately does not cache or intercept fetches: the app is server-rendered and a stale
 * cached shell would be worse than no worker at all. It exists because a service worker is the
 * only place Android Chrome and iOS Safari will let a notification be raised, and the only thing
 * that runs when the tab is closed.
 */

const NOTIFICATION_TAG_PREFIX = 'writual-chat-';

// A new worker takes over immediately rather than waiting for every tab to close — otherwise a
// notification fix would not reach a user who never fully quits the app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/**
 * Asks an open, focused page whether this message is already on screen.
 *
 * Resolves false (show the banner) if nothing answers in time — a page that cannot reply within a
 * few frames is not a page the user is reading the message in.
 */
function shouldSuppress(client, payload) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), 400);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(Boolean(event.data && event.data.suppress));
    };
    try {
      client.postMessage({ type: 'writual-push-check', payload }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  if (!payload || payload.type !== 'chat-message') return;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const focused = clients.find((client) => client.focused && client.visibilityState === 'visible');

    // The one case worth staying quiet for: the recipient is looking at this exact conversation
    // right now. Every other case — app backgrounded, another page open, another thread open,
    // nothing running at all — gets the banner.
    //
    // Push services expect a push to end in a visible notification, and Safari in particular can
    // penalise a subscription that repeatedly shows nothing. This stays within that: it needs an
    // open, focused, visible window with that exact thread on screen, which is a person actively
    // reading rather than a background app dropping pushes on the floor.
    if (focused && await shouldSuppress(focused, payload)) return;

    await self.registration.showNotification(payload.title, {
      body: payload.body,
      // One live banner per conversation: a burst of replies replaces rather than stacks.
      tag: NOTIFICATION_TAG_PREFIX + payload.conversationId,
      renotify: true,
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      data: { url: payload.url },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/projects';

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse a window that is already open rather than stacking another copy of the app.
    for (const client of clients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try {
            await client.navigate(target);
          } catch {
            // Cross-origin or a client that refuses navigation — the focus alone is still useful.
          }
        }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
