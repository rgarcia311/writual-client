import 'dotenv/config';
import mongoose from 'mongoose';
import { AppUsers } from '@writual/db';
import { isWebPushConfigured, sendPushToUsers } from '../services/webPush';

/**
 * Diagnostic for OS-level chat notifications.
 *
 * Answers the three questions that a missing notification collapses into, in the order they break:
 * is the server configured, did the device ever register, and does a send actually reach it.
 *
 *   npx ts-node src/scripts/pushDoctor.ts               # what this environment knows
 *   npx ts-node src/scripts/pushDoctor.ts --send <uid>  # ring that user's devices now
 *
 * Run it where the app runs, so it reads the same keys and the same database:
 *   railway run npx ts-node src/scripts/pushDoctor.ts
 */

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return '(unparseable)';
  }
}

/** Which push service an endpoint belongs to — the quickest read on what kind of device it is. */
function endpointService(host: string): string {
  if (host.includes('fcm.googleapis.com') || host.includes('android.googleapis.com')) return 'Chrome/Android (FCM)';
  if (host.includes('push.services.mozilla.com')) return 'Firefox';
  if (host.includes('notify.windows.com')) return 'Edge/Windows (WNS)';
  if (host.includes('push.apple.com')) return 'Safari/iOS (APNs)';
  return host;
}

async function main() {
  const args = process.argv.slice(2);
  const sendIndex = args.indexOf('--send');
  const targetUid = sendIndex >= 0 ? args[sendIndex + 1] : null;

  console.log('--- configuration ---');
  console.log('VAPID configured:  ', isWebPushConfigured);
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
  console.log('VAPID public key:  ', publicKey ? `${publicKey.slice(0, 12)}…${publicKey.slice(-6)} (${publicKey.length} chars)` : '(missing)');
  console.log('VAPID subject:     ', process.env.VAPID_SUBJECT ?? '(default)');
  console.log('');
  console.log('Compare that key against NEXT_PUBLIC_VAPID_PUBLIC_KEY in the web app.');
  console.log('If they differ, every send is rejected and no device ever rings.');
  console.log('');

  const users = await AppUsers.find(
    { 'pushSubscriptions.0': { $exists: true } },
    { uid: 1, email: 1, pushSubscriptions: 1 },
  ).lean().exec();

  console.log('--- registered devices ---');
  if (users.length === 0) {
    console.log('None. No browser has completed Settings → Chat notifications against THIS database.');
    console.log('A device that never registered cannot be pushed to, whatever the keys say.');
  }
  for (const user of users as any[]) {
    console.log(`\n${user.email ?? '(no email)'}  uid=${user.uid}`);
    for (const sub of user.pushSubscriptions) {
      const host = endpointHost(sub.endpoint);
      console.log(`  · ${endpointService(host)}`);
      console.log(`    registered ${new Date(sub.createdAt).toISOString()}`);
      console.log(`    ${String(sub.userAgent ?? '(no user agent)').slice(0, 110)}`);
    }
  }
  console.log('');

  if (targetUid) {
    console.log(`--- test send to ${targetUid} ---`);
    const target = (users as any[]).find((u) => u.uid === targetUid);
    if (!target) {
      console.log('That uid has no registered devices — nothing to send to.');
    } else {
      await sendPushToUsers([targetUid], {
        type: 'chat-message',
        title: 'Writual test',
        body: 'If you can read this, push delivery works.',
        conversationId: 'push-doctor',
        projectId: 'push-doctor',
        url: '/projects',
      });
      // sendPushToUsers logs its own failures and prunes dead endpoints, so re-reading the count
      // tells us whether anything was dropped as gone.
      const after = await AppUsers.findOne({ uid: targetUid }, { pushSubscriptions: 1 }).lean().exec();
      const remaining = (after as any)?.pushSubscriptions?.length ?? 0;
      console.log(`Sent. ${remaining} of ${target.pushSubscriptions.length} subscription(s) still valid.`);
      console.log('No error above and no banner on the device means the browser dropped it —');
      console.log('check the OS notification settings for Chrome, and Chrome\'s own site settings.');
    }
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
