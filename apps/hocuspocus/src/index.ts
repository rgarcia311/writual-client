import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import cors from 'cors';
import WebSocket from 'ws';
import admin from 'firebase-admin';
import { MongoClient, Binary, ObjectId } from 'mongodb';
import { Hocuspocus } from '@hocuspocus/server';
import * as Y from 'yjs';
import { TIER_RANK, normalizeTier } from '@writual/tier-logic';
import { resolveMongoUri } from '@writual/mongo-env';

// Root `.env` is shared across apps; cwd when running under Turbo is often `apps/hocuspocus`.
const repoRoot = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local') });
dotenv.config();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersistenceEntry {
  debounceTimer: ReturnType<typeof setTimeout> | null;
  writeChain: Promise<void>;
  finalWriteEnqueued: boolean;
  getSnapshot: () => Uint8Array;
}

class DocumentTooLargeError extends Error {
  constructor(
    public readonly documentName: string,
    public readonly byteLength: number,
  ) {
    super(
      `Document "${documentName}" is ${(byteLength / 1024 / 1024).toFixed(1)}MB — exceeds 16MB limit`,
    );
    this.name = 'DocumentTooLargeError';
  }
}

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

function getPrivateKey(): string | undefined {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (raw == null || raw === '') return undefined;
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  return key.replace(/\\n/g, '\n');
}

function validateStartupEnv(): { allowInsecureNoAuth: boolean } {
  const isProduction = process.env.NODE_ENV === 'production';
  const explicitInsecure = process.env.ALLOW_INSECURE_NO_AUTH === 'true';
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = getPrivateKey();
  const hasFullFirebase = !!(projectId && clientEmail && privateKey);
  const hasAnyFirebase = !!(projectId || clientEmail || privateKey);

  if (isProduction && explicitInsecure) {
    console.error(
      '[FATAL] ALLOW_INSECURE_NO_AUTH=true is forbidden in production',
    );
    process.exit(1);
  }

  if (isProduction && !process.env.FRONTEND_ORIGIN) {
    console.error('[FATAL] FRONTEND_ORIGIN is required in production');
    process.exit(1);
  }

  const implicitDevInsecure = !isProduction && !hasAnyFirebase;
  const allowInsecureNoAuth = explicitInsecure || implicitDevInsecure;

  if (!allowInsecureNoAuth && !hasFullFirebase) {
    if (hasAnyFirebase) {
      console.error(
        '[FATAL] Incomplete Firebase Admin env: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (all three required)',
      );
    } else {
      console.error(
        '[FATAL] FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are all required',
      );
    }
    process.exit(1);
  }

  if (implicitDevInsecure) {
    console.warn(
      '[WARN] No Firebase Admin credentials in non-production — auth and access checks are relaxed (same as ALLOW_INSECURE_NO_AUTH). Do not use in production.',
    );
  }

  return { allowInsecureNoAuth };
}

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

function initFirebaseAdmin(
  allowInsecureNoAuth: boolean,
): admin.auth.Auth | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    if (allowInsecureNoAuth) {
      console.warn(
        '[WARN] Firebase Admin not initialized — insecure dev mode: WebSocket auth and project checks are bypassed.',
      );
      return null;
    }
    return null;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  return admin.auth();
}

async function verifyFirebaseIdToken(
  rawToken: string | undefined,
  adminAuth: admin.auth.Auth | null,
): Promise<string | null> {
  if (!rawToken || !adminAuth) return null;
  const token = rawToken.startsWith('Bearer ')
    ? rawToken.slice(7)
    : rawToken;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CORS / Origin helper
// ---------------------------------------------------------------------------

const LOCALHOST_PREFIXES = [
  'http://localhost:',
  'https://localhost:',
  'http://127.0.0.1:',
  'https://127.0.0.1:',
];

function normalizeOrigin(origin: string): string {
  return origin
    .trim()
    .replace(/\/$/, '')
    .replace(/^(https?:\/\/)www\./, '$1');
}

function isAllowedOrigin(
  requestOrigin: string | undefined,
  nodeEnv: string | undefined,
  frontendOrigin: string | undefined,
): boolean {
  if (!requestOrigin) return false;

  if (nodeEnv === 'production') {
    return (
      !!frontendOrigin &&
      normalizeOrigin(requestOrigin) === normalizeOrigin(frontendOrigin)
    );
  }

  if (frontendOrigin) {
    return normalizeOrigin(requestOrigin) === normalizeOrigin(frontendOrigin);
  }

  return LOCALHOST_PREFIXES.some((prefix) => requestOrigin.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 3000;
const MAX_DOC_BYTES = 16 * 1024 * 1024;
const WARN_DOC_BYTES = 14e6;

const registry = new Map<string, PersistenceEntry>();
const moduleOrphanChains: Promise<void>[] = [];

async function persistYjsState(
  documentName: string,
  bytes: Uint8Array,
  coll: ReturnType<ReturnType<MongoClient['db']>['collection']>,
): Promise<void> {
  if (bytes.length >= MAX_DOC_BYTES) {
    throw new DocumentTooLargeError(documentName, bytes.length);
  }
  if (bytes.length > WARN_DOC_BYTES) {
    console.warn(
      `[yjs] Document "${documentName}" approaching size limit: ${(bytes.length / 1024 / 1024).toFixed(1)}MB`,
    );
  }
  console.info(
    `[yjs] Persisting "${documentName}" (${bytes.length} bytes)`,
  );
  await coll.replaceOne(
    { _id: documentName as any },
    {
      _id: documentName as any,
      state: new Binary(bytes),
      updatedAt: new Date(),
    },
    { upsert: true },
  );
}

function scheduleFinalPersist(
  entry: PersistenceEntry,
  documentName: string,
  coll: ReturnType<ReturnType<MongoClient['db']>['collection']>,
): void {
  if (entry.finalWriteEnqueued) return;
  entry.finalWriteEnqueued = true;
  entry.writeChain = entry.writeChain
    .then(() => persistYjsState(documentName, entry.getSnapshot(), coll))
    .catch((err) => {
      console.error('[yjs] final persist failed', { documentName, err });
    });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { allowInsecureNoAuth } = validateStartupEnv();

  let mongoUri: string;
  try {
    mongoUri = resolveMongoUri();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const client = new MongoClient(mongoUri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  try {
    await client.connect();
    console.info('[mongo] Connected');
  } catch (err) {
    console.error('[mongo] Connection failed', err);
    process.exit(1);
  }

  console.info(`[config] FRONTEND_ORIGIN="${process.env.FRONTEND_ORIGIN ?? '(not set)'}"`);

  const db = process.env.MONGODB_DB_NAME
    ? client.db(process.env.MONGODB_DB_NAME)
    : client.db();

  const yjsColl = db.collection('yjs_documents');
  const usersCollName = process.env.APP_USERS_COLLECTION ?? 'appusers';
  const projectsCollName = process.env.PROJECTS_COLLECTION ?? 'projects';

  const adminAuth = initFirebaseAdmin(allowInsecureNoAuth);

  // -----------------------------------------------------------------------
  // Hocuspocus
  // -----------------------------------------------------------------------

  const hocuspocus = new Hocuspocus({
    name: process.env.SERVICE_NAME ?? 'writual-hocuspocus',
    quiet: true,
    stopOnSignals: false,

    async onAuthenticate({ token, documentName }) {
      if (!adminAuth && allowInsecureNoAuth) {
        const uid = process.env.DEV_MOCK_UID?.trim() || 'dev-local';
        return { uid };
      }

      const uid = await verifyFirebaseIdToken(token, adminAuth);
      if (!uid) {
        throw new Error('Unauthorized: invalid or missing token');
      }

      const userDoc = await db
        .collection(usersCollName)
        .findOne({ uid });
      const tier = normalizeTier(userDoc?.tier);
      if (TIER_RANK[tier] < TIER_RANK['greenlit']) {
        throw new Error('Requires greenlit tier or higher');
      }

      let projectObjectId: ObjectId;
      try {
        projectObjectId = new ObjectId(documentName);
      } catch {
        throw new Error('Invalid document name: must be a project ID');
      }

      const project = await db
        .collection(projectsCollName)
        .findOne({
          _id: projectObjectId,
          $or: [
            { user: uid },
            { sharedWith: uid },
            { collaborators: { $elemMatch: { uid, status: 'active' } } },
          ],
        });
      if (!project) {
        throw new Error('Forbidden: no access to this project');
      }

      return { uid };
    },

    async onLoadDocument({ document, documentName }) {
      let entry = registry.get(documentName);
      if (!entry) {
        entry = {
          debounceTimer: null,
          writeChain: Promise.resolve(),
          finalWriteEnqueued: false,
          getSnapshot: () => Y.encodeStateAsUpdate(document),
        };
        registry.set(documentName, entry);
      } else {
        entry.writeChain = Promise.resolve();
        entry.finalWriteEnqueued = false;
        if (entry.debounceTimer) {
          clearTimeout(entry.debounceTimer);
          entry.debounceTimer = null;
        }
        entry.getSnapshot = () => Y.encodeStateAsUpdate(document);
      }

      const existing = await yjsColl.findOne({ _id: documentName as any });
      if (existing?.state) {
        const state =
          existing.state instanceof Binary
            ? existing.state.buffer
            : existing.state;
        Y.applyUpdate(document, new Uint8Array(state as ArrayBuffer));
      }

      return document;
    },

    async onStoreDocument({ document, documentName }) {
      const entry = registry.get(documentName);
      if (!entry) return;

      entry.getSnapshot = () => Y.encodeStateAsUpdate(document);

      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer);
      }

      entry.debounceTimer = setTimeout(() => {
        const bytes = entry.getSnapshot();
        entry.writeChain = entry.writeChain
          .then(() => persistYjsState(documentName, bytes, yjsColl))
          .catch((err) => {
            console.error('[yjs] debounced persist failed', {
              documentName,
              err,
            });
          });
      }, DEBOUNCE_MS);
    },

    async afterUnloadDocument({ documentName }) {
      const entry = registry.get(documentName);
      if (!entry) return;

      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer);
        entry.debounceTimer = null;
      }

      scheduleFinalPersist(entry, documentName, yjsColl);

      const tail = entry.writeChain;
      registry.delete(documentName);
      moduleOrphanChains.push(tail);
    },
  });

  // -----------------------------------------------------------------------
  // Express + HTTP
  // -----------------------------------------------------------------------

  const app = express();
  const httpServer = http.createServer(app);

  app.use(
    cors({
      origin: (origin, cb) => {
        cb(
          null,
          isAllowedOrigin(
            origin,
            process.env.NODE_ENV,
            process.env.FRONTEND_ORIGIN,
          ),
        );
      },
    }),
  );

  app.get('/', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // -----------------------------------------------------------------------
  // WebSocket upgrade
  // -----------------------------------------------------------------------

  const wss = new WebSocket.Server({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    if (
      !isAllowedOrigin(
        request.headers.origin,
        process.env.NODE_ENV,
        process.env.FRONTEND_ORIGIN,
      )
    ) {
      console.warn(
        `[ws] Rejected upgrade — origin="${request.headers.origin}" expected="${process.env.FRONTEND_ORIGIN}"`,
      );
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      hocuspocus.handleConnection(ws, request);
    });
  });

  // -----------------------------------------------------------------------
  // Listen
  // -----------------------------------------------------------------------

  const port = Number(process.env.HOCUSPOCUS_PORT || process.env.PORT || 8787);
  httpServer.listen({ port, host: '0.0.0.0' }, () => {
    console.info(`[hocuspocus] Listening on 0.0.0.0:${port}`);
  });

  // -----------------------------------------------------------------------
  // Graceful shutdown
  // -----------------------------------------------------------------------

  const shutdown = async (signal: string) => {
    console.info(`[shutdown] Received ${signal}`);

    httpServer.close();

    const allPendingWrites: Promise<void>[] = [];

    for (const [documentName, entry] of registry) {
      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer);
        entry.debounceTimer = null;
      }
      scheduleFinalPersist(entry, documentName, yjsColl);
      allPendingWrites.push(entry.writeChain);
    }

    allPendingWrites.push(...moduleOrphanChains);

    try {
      await Promise.all(allPendingWrites);
    } catch (err) {
      console.error('[shutdown] Error draining writes', err);
    }

    registry.clear();
    moduleOrphanChains.length = 0;

    try {
      await client.close();
    } catch (err) {
      console.error('[shutdown] MongoClient.close failed', err);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[FATAL] Unhandled error in main', err);
  process.exit(1);
});
