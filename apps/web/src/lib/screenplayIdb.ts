'use client'

/**
 * Shared IndexedDB handle for every local screenplay cache.
 *
 * Two stores live in this database and they must be opened at the same version — a module that
 * opened `writual-screenplay-cache` at its own version number would make every other module's
 * `open()` fail with a `VersionError` the moment the two drifted. Opening is centralised here so
 * adding a store is a version bump in one place.
 *
 * Every operation resolves rather than rejects: private-mode browsers, disabled storage and quota
 * failures are all expected, and each caller degrades to "no cache" instead of breaking the page.
 */

const DB_NAME = 'writual-screenplay-cache'
/** v1: `snapshots`. v2: adds `documents` (persisted script bodies). */
const DB_VERSION = 2

/** Paint-only window of rendered pages — see `screenplaySnapshotCache.ts`. */
export const SNAPSHOT_STORE = 'snapshots'
/** Full script bodies and document lists — see `screenplayContentCache.ts`. */
export const DOCUMENT_STORE = 'documents'

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'projectId' })
      }
      if (!db.objectStoreNames.contains(DOCUMENT_STORE)) {
        db.createObjectStore(DOCUMENT_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

/** Runs one request against `storeName` and resolves its result, or null on any failure. */
export function screenplayIdbTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null)
          return
        }
        let req: IDBRequest<T>
        try {
          req = run(db.transaction(storeName, mode).objectStore(storeName))
        } catch {
          db.close()
          resolve(null)
          return
        }
        req.onsuccess = () => {
          resolve(req.result ?? null)
          db.close()
        }
        req.onerror = () => {
          resolve(null)
          db.close()
        }
      }),
  )
}
