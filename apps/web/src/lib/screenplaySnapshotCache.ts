'use client'

/**
 * Per-project local cache of the screenplay's rendered window, so a refresh can paint real
 * pages immediately instead of an empty spinner.
 *
 * What is cached is deliberately NOT the document: it is a *paint-only* slice — the script
 * blocks within ±`SNAPSHOT_PAGE_RADIUS` pages of the reader's last scroll position, each with
 * the layout-space `top` it was rendered at. It is never fed back into the editor, Yjs, or a
 * save; the live document always comes from the network. That keeps a stale or partial snapshot
 * incapable of truncating a screenplay, which a "load the slice into the editor" design cannot
 * promise once autosave serialises `editor.getJSON()`.
 *
 * Storage is IndexedDB rather than localStorage: a 10-page slice of a feature script runs tens of
 * KB and localStorage writes are synchronous on the main thread — exactly the stall this is
 * meant to remove.
 */

const DB_NAME = 'writual-screenplay-cache'
const DB_VERSION = 1
const STORE = 'snapshots'

/** Snapshots older than this are ignored on read (and dropped) — the document has moved on. */
const SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** How many pages either side of the viewport get cached. */
export const SNAPSHOT_PAGE_RADIUS = 5

/** Bounds the write size for pathological documents (very short blocks, huge page). */
const SNAPSHOT_MAX_BLOCKS = 1200

export interface SnapshotBlock {
  /** `data-element-type` — drives every indent/case rule in Screenplay.css. */
  elementType: string
  /** Plain text content. Marks are dropped; this is a paint, not an edit surface. */
  text: string
  /** Layout-space (unscaled) offset from the top of the `.ProseMirror` column. */
  top: number
  /**
   * Block sat directly after a page-break widget. Screenplay.css zeroes such a block's `padding-top`
   * via `.page-break-gap + .node-scriptBlock > .script-block`, and the preview renders no gap
   * widgets, so the preview has to reapply that itself or every page's first line drops a line.
   */
  atPageTop?: boolean
}

export interface ScreenplaySnapshot {
  projectId: string
  updatedAt: number
  /** Workspace scrollTop in layout px (i.e. already divided by the zoom it was captured at). */
  scrollTopLayoutPx: number
  /** The zoom the reader was at. Replayed by the preview so the curtain and the editor agree. */
  zoom: number
  /** Full height of the `.ProseMirror` column in layout px, so the scrollbar matches. */
  documentHeightPx: number
  /** Physical sheets the document paginates to, title page included (drives `--total-pages`). */
  totalPages: number
  /** Body pages, title page excluded — seeds the toolbar count before pagination has run. */
  bodyPages: number
  blocks: SnapshotBlock[]
}

/**
 * Per-session mirror of what has been read or written, so the second and later mounts in a session
 * (gate → editor overlay) can render the curtain on their first paint instead of after an async
 * round trip — an async read there would show one blank/spinner frame every hand-off.
 */
const sessionMemo = new Map<string, ScreenplaySnapshot | null>()

/** Synchronously returns a snapshot already seen this session, or null. */
export function peekScreenplaySnapshot(projectId: string): ScreenplaySnapshot | null {
  return sessionMemo.get(projectId) ?? null
}

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
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'projectId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    // Private-mode / quota-disabled browsers reject here; the caller degrades to a spinner.
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

function tx<T>(
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
          req = run(db.transaction(STORE, mode).objectStore(STORE))
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

export async function readScreenplaySnapshot(
  projectId: string,
): Promise<ScreenplaySnapshot | null> {
  const memoized = sessionMemo.get(projectId)
  if (memoized !== undefined) return memoized

  const snap = (await tx<ScreenplaySnapshot>('readonly', (s) => s.get(projectId))) ?? null
  const usable =
    snap &&
    Array.isArray(snap.blocks) &&
    snap.blocks.length > 0 &&
    Number.isFinite(snap.zoom) &&
    snap.zoom > 0 &&
    Date.now() - (snap.updatedAt ?? 0) <= SNAPSHOT_MAX_AGE_MS
      ? snap
      : null

  if (snap && !usable) void deleteScreenplaySnapshot(projectId)
  sessionMemo.set(projectId, usable)
  return usable
}

export async function writeScreenplaySnapshot(snapshot: ScreenplaySnapshot): Promise<void> {
  if (!snapshot.projectId || snapshot.blocks.length === 0) return
  const trimmed: ScreenplaySnapshot =
    snapshot.blocks.length > SNAPSHOT_MAX_BLOCKS
      ? { ...snapshot, blocks: snapshot.blocks.slice(0, SNAPSHOT_MAX_BLOCKS) }
      : snapshot
  sessionMemo.set(trimmed.projectId, trimmed)
  await tx('readwrite', (s) => s.put(trimmed))
}

export async function deleteScreenplaySnapshot(projectId: string): Promise<void> {
  sessionMemo.set(projectId, null)
  await tx('readwrite', (s) => s.delete(projectId))
}
