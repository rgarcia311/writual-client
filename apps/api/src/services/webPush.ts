import webpush from 'web-push';
import { AppUsers } from '@writual/db';

/**
 * Web Push delivery.
 *
 * Pusher tells a *running* page that a message arrived; this tells the operating system, which is
 * a different job. It is the only mechanism that reaches a closed tab, a backgrounded phone, or an
 * iOS home-screen app — and on iOS and Android it is the only one that can raise a banner at all,
 * since neither allows the in-page `Notification` constructor.
 *
 * Requires a VAPID key pair, generated once with `npx web-push generate-vapid-keys`:
 *   VAPID_PUBLIC_KEY   — also given to the browser as NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY  — server only
 *   VAPID_SUBJECT      — a mailto: or https: URL identifying this app to the push services
 *
 * Rotating the pair invalidates every stored subscription: browsers bind a subscription to the
 * public key it was created with, and the push service rejects payloads signed by any other.
 */

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:support@writual.com';

export const isWebPushConfigured = Boolean(publicKey && privateKey);

if (isWebPushConfigured) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
} else {
  console.warn('[webPush] VAPID keys missing — OS notifications are disabled.');
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface ChatPushPayload {
  type: 'chat-message';
  title: string;
  body: string;
  conversationId: string;
  projectId: string;
  /** Where a tap on the banner should land. */
  url: string;
}

/**
 * Pushes to every device a user has registered.
 *
 * Never throws: a message must still send when someone's phone has an expired subscription. A 404
 * or 410 from the push service means that registration is permanently gone (browser uninstalled,
 * site data cleared, subscription rotated), so it is dropped rather than retried forever.
 */
export async function sendPushToUsers(uids: string[], payload: ChatPushPayload): Promise<void> {
  if (!isWebPushConfigured || uids.length === 0) return;

  const users = await AppUsers.find(
    { uid: { $in: uids }, 'pushSubscriptions.0': { $exists: true } },
    { uid: 1, pushSubscriptions: 1 },
  ).lean().exec();
  if (users.length === 0) return;

  const body = JSON.stringify(payload);
  const staleByUid = new Map<string, string[]>();

  await Promise.all(
    (users as any[]).flatMap((user) =>
      (user.pushSubscriptions as StoredPushSubscription[]).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            body,
            // Chat is time-sensitive: a message the recipient sees an hour later is noise. `urgency`
            // asks the push service not to hold it back on a device saving battery.
            { TTL: 60 * 60, urgency: 'high' },
          );
        } catch (error: any) {
          const status = error?.statusCode;
          if (status === 404 || status === 410) {
            const list = staleByUid.get(user.uid) ?? [];
            list.push(sub.endpoint);
            staleByUid.set(user.uid, list);
          } else {
            console.error('[webPush] send failed', status, error?.body ?? error?.message);
          }
        }
      }),
    ),
  );

  await Promise.all(
    [...staleByUid.entries()].map(([uid, endpoints]) =>
      AppUsers.updateOne(
        { uid },
        { $pull: { pushSubscriptions: { endpoint: { $in: endpoints } } } },
      ).exec(),
    ),
  );
}
