/**
 * Closed-beta allowlist, evaluated in `src/proxy.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS A ROUTING GATE, NOT A SECURITY BOUNDARY.
 * ─────────────────────────────────────────────────────────────────────────────
 * Next's proxy runs on the Edge runtime, where `firebase-admin` is unavailable, so we can
 * only *decode* the `firebase-token` JWT — we cannot verify its RS256 signature without
 * fetching Google's JWKS on every request. A hand-crafted token would therefore satisfy the
 * checks below. That is acceptable only because real verification already happens where the
 * data actually lives:
 *
 *   - the GraphQL API verifies the Firebase token on every request
 *   - hocuspocus verifies it in `onAuthenticate` (apps/hocuspocus/src/index.ts)
 *
 * This module's job is to keep uninvited accounts out of the UI once Vercel Deployment
 * Protection is disabled (which it must be, so PICO Browser can fetch the PWA manifest
 * unauthenticated and launch the app in standalone/spatial mode). Never let it become the
 * only thing standing between a stranger and user data.
 */

/**
 * Authorized beta users — Firebase UIDs and/or email addresses, mixed freely.
 *
 * ⚠️ AN EMPTY LIST DISABLES THE GATE (everyone authenticated is allowed through).
 * This is deliberate: shipping an empty fail-closed list would lock every developer and
 * existing user out of the app the moment it merged. The gate is opt-in — populate this
 * array, or set the `BETA_ALLOWLIST` env var, to arm it.
 *
 * Entries added here are committed to git history. To add beta users without putting their
 * addresses in source, set `BETA_ALLOWLIST` (comma-separated) in the environment instead;
 * both sources are merged.
 */
export const BETA_ALLOWLIST: readonly string[] = [
  // 'someone@example.com',
  // 'aFirebaseUidGoesHere',
];

function parseEnvAllowlist(): string[] {
  const raw = process.env.BETA_ALLOWLIST;
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Emails are matched case-insensitively; UIDs are matched exactly, since Firebase UIDs are
 * mixed-case alphanumeric and lowercasing them could collide two distinct users.
 */
function buildAllowlist(): { emails: Set<string>; uids: Set<string>; empty: boolean } {
  const entries = [...BETA_ALLOWLIST, ...parseEnvAllowlist()];
  const emails = new Set<string>();
  const uids = new Set<string>();

  for (const entry of entries) {
    if (entry.includes('@')) emails.add(entry.toLowerCase());
    else uids.add(entry);
  }

  return { emails, uids, empty: emails.size === 0 && uids.size === 0 };
}

export interface DecodedFirebaseToken {
  /** Firebase UID (both claims are populated on a real ID token; either may be read). */
  sub?: string;
  user_id?: string;
  email?: string;
  exp?: number;
}

/**
 * Decodes a Firebase ID token's payload without verifying it. Edge-runtime safe: uses only
 * `atob` and `TextDecoder`, no Node built-ins.
 *
 * Returns `null` for anything that isn't a well-formed three-segment JWT with a JSON payload.
 */
export function decodeFirebaseToken(rawToken: string | undefined): DecodedFirebaseToken | null {
  if (!rawToken) return null;

  const segments = rawToken.split('.');
  if (segments.length !== 3) return null;

  try {
    // base64url → base64, then pad to a multiple of 4 for atob.
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

    // atob yields a binary string; round-trip through bytes so a non-ASCII claim (e.g. a
    // display name) can't corrupt the JSON before it is parsed.
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));

    return typeof payload === 'object' && payload !== null ? (payload as DecodedFirebaseToken) : null;
  } catch {
    return null;
  }
}

/**
 * Whether the bearer of this `firebase-token` cookie is permitted into the closed beta.
 *
 * Deliberately does NOT reject on an expired `exp`. `actions/auth.ts` stores the raw ID token
 * in a cookie with a 5-day `maxAge`, but a Firebase ID token itself expires after 1 hour and
 * the cookie is never refreshed — so an ordinary, still-signed-in user carries an "expired"
 * token for most of their session. Gating on `exp` here would bounce them to `/` an hour after
 * login. Token freshness is enforced server-side by the API and hocuspocus, which is where it
 * belongs; this gate only answers "which identity is this?".
 */
export function isAllowedBetaUser(rawToken: string | undefined): boolean {
  const { emails, uids, empty } = buildAllowlist();

  // Gate not configured — behave exactly as the app did before it existed.
  if (empty) return true;

  const claims = decodeFirebaseToken(rawToken);
  if (!claims) return false;

  const uid = claims.user_id ?? claims.sub;
  if (uid && uids.has(uid)) return true;

  const email = claims.email?.toLowerCase();
  if (email && emails.has(email)) return true;

  return false;
}
