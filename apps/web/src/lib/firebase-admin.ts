import admin from "firebase-admin";

function getPrivateKey(): string | undefined {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (raw == null || raw === "") {
    return undefined;
  }
  // Strip surrounding double quotes if present (e.g. from .env)
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  // Normalize newlines: escaped \n in env -> real newlines for PEM
  if (typeof key === "string") {
    key = key.replace(/\\n/g, "\n");
  }
  return key;
}

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin: missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY"
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export const adminAuth = admin.auth();