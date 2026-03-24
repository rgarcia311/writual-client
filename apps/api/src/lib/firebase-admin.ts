import admin from "firebase-admin";

function getPrivateKey(): string | undefined {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (raw == null || raw === "") return undefined;
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  return key.replace(/\\n/g, "\n");
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = getPrivateKey();

if (!admin.apps.length) {
  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "[firebase-admin] Missing env vars — Firebase Admin not initialized. Token verification will be skipped."
    );
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
}

export const adminAuth = admin.apps.length ? admin.auth() : null;
