"use server";

import { adminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

/** Mirrors the `Tier` union the API enforces; `beta-access` is granted server-side, never chosen. */
type SelectableTier = 'spec' | 'indie' | 'greenlit';

export interface VerifyAndLoginResult {
  status?: 'success';
  success?: boolean;
  error?: string;
}

export async function verifyAndLogin(
  idToken: string,
  /**
   * Tier picked on `/signup`. Only written when present, so the global auth listener in
   * `ClientOnlyMuiLayout` — which re-verifies on every id-token change with no tier — cannot
   * clear the choice a signing-up user just made.
   */
  tierId?: SelectableTier
): Promise<VerifyAndLoginResult | undefined> {
  try {
    // 1. Verify the token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days in ms
    const uid = decodedToken.uid;

    if (uid) {
      // Safari (unlike Chrome/Firefox) does not treat http://localhost as a secure
      // context for the Secure cookie attribute, so it silently drops these cookies
      // in local dev. That desyncs the server's cookie-based auth check from the
      // client's Firebase auth state, causing the "/" page's redirect() (based on
      // the user-id cookie) to re-trigger on every reload and spam history.replaceState.
      const secure = process.env.NODE_ENV === 'production';

      // 2. Create a session cookie (required for verifySessionCookie on later requests)
      //const sessionCookie = await auth().createSessionCookie(idToken, { expiresIn: expiresIn / 1000 });
      // 3. Set the session cookie (not the raw ID token)
      (await cookies()).set("firebase-token", idToken, {
        maxAge: Math.floor(expiresIn / 1000),
        httpOnly: true,
        secure,
        path: "/",
      });

      (await cookies()).set("user-id", uid, {
        maxAge: Math.floor(expiresIn / 1000),
        httpOnly: true,
        secure,
        path: "/",
      });
      if (tierId) {
        (await cookies()).set("signup-tier", tierId, {
          maxAge: Math.floor(expiresIn / 1000),
          httpOnly: true,
          secure,
          path: "/",
        });
      }

      return { status: "success" };
    }
  } catch (error) {
    console.error("Token verification failed:", error);
    return { success: false, error: "Unauthorized" };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("firebase-token");
  cookieStore.delete("user-id");
}