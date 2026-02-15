"use server";

import { adminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function verifyAndLogin(idToken) {
  try {
    // 1. Verify the token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days in ms
    const uid = decodedToken.uid;

    if (uid) {
      // 2. Create a session cookie (required for verifySessionCookie on later requests)
      //const sessionCookie = await auth().createSessionCookie(idToken, { expiresIn: expiresIn / 1000 });
      // 3. Set the session cookie (not the raw ID token)
      (await cookies()).set("firebase-token", idToken, {
        maxAge: Math.floor(expiresIn / 1000),
        httpOnly: true,
        secure: true,
        path: "/",
      });

      (await cookies()).set("user-id", uid, {
        maxAge: Math.floor(expiresIn / 1000),
        httpOnly: true,
        secure: true,
        path: "/",
      });
      return { status: "success" };
    }
  } catch (error) {
    console.error("Token verification failed:", error);
    return { success: false, error: "Unauthorized" };
  }
}