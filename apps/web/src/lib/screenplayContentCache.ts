'use client'

/**
 * Local persistence of the screenplay itself — the script body, and the tab-bar metadata needed to
 * know which body to show.
 *
 * This is a different promise from `screenplaySnapshotCache.ts`. That one caches a *picture* of the
 * pages and is never read back into the editor. This one caches the real TipTap document so the
 * editor can mount from local storage on a revisit instead of waiting on the network, which is the
 * whole cost of "loading takes a while when revisiting".
 *
 * Two rules keep a stale entry from being able to truncate a screenplay:
 *
 *  1. Under collaboration the Y.Doc remains authoritative. Cached content is only ever used where
 *     the server's copy was already used — as the seed for an empty Y.Doc — so a stale entry can at
 *     worst seed a document the server sync then corrects.
 *  2. Entries carry the `version` they came from. `pickFreshestScreenplayDocument` prefers the
 *     server whenever the server's version is greater or equal, so the cache can only win while it
 *     is genuinely ahead (a local edit written after the last successful read).
 *
 * Storage is IndexedDB, not localStorage: a feature script serialises to hundreds of KB and
 * localStorage writes block the main thread — the exact stall this is meant to remove.
 */

import { DOCUMENT_STORE, screenplayIdbTx } from './screenplayIdb'

/** Entries older than this are ignored on read and dropped; the document has moved on. */
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Refuse to persist a body larger than this once serialised (~4M UTF-16 chars). */
const MAX_CONTENT_CHARS = 4_000_000

export interface CachedScreenplayDocument {
  key: string
  projectId: string
  documentId: string | null
  updatedAt: number
  /** `versions[0].version` this body corresponds to; null for a body captured from a live editor. */
  version: number | null
  /** Where the body came from — a server read, or the mounted editor's own content. */
  source: 'server' | 'editor'
  name: string | null
  isPrimary: boolean
  layout: unknown
  pageCount: number | null
  /** TipTap document JSON. */
  content: unknown
}

/** The `getProjectData` payload backing the document tab bar, cached verbatim. */
export interface CachedScreenplayDocumentList {
  key: string
  projectId: string
  updatedAt: number
  payload: unknown
}

type CacheEntry = CachedScreenplayDocument | CachedScreenplayDocumentList

/**
 * Per-session mirror of everything read or written, so the second and later mounts in a session
 * resolve on their first render instead of after an IndexedDB round trip. Without it every gate →
 * editor hand-off would show one uncached frame.
 */
const sessionMemo = new Map<string, CacheEntry | null>()

export function screenplayDocumentCacheKey(
  projectId: string,
  documentId: string | null | undefined,
): string {
  return `doc:${projectId}:${documentId ?? 'primary'}`
}

export function screenplayDocumentListCacheKey(projectId: string): string {
  return `list:${projectId}`
}

function fresh<T extends CacheEntry>(entry: T | null): T | null {
  if (!entry) return null
  return Date.now() - (entry.updatedAt ?? 0) <= CACHE_MAX_AGE_MS ? entry : null
}

/** Synchronously returns an entry already seen this session, or null. */
export function peekScreenplayDocument(
  projectId: string,
  documentId: string | null | undefined,
): CachedScreenplayDocument | null {
  const entry = sessionMemo.get(screenplayDocumentCacheKey(projectId, documentId))
  return fresh((entry as CachedScreenplayDocument) ?? null)
}

/** Synchronously returns a document list already seen this session, or null. */
export function peekScreenplayDocumentList(
  projectId: string,
): CachedScreenplayDocumentList | null {
  const entry = sessionMemo.get(screenplayDocumentListCacheKey(projectId))
  return fresh((entry as CachedScreenplayDocumentList) ?? null)
}

async function readEntry<T extends CacheEntry>(key: string): Promise<T | null> {
  const memoized = sessionMemo.get(key)
  if (memoized !== undefined) return fresh(memoized as T)

  const entry = (await screenplayIdbTx<T>(DOCUMENT_STORE, 'readonly', (s) => s.get(key))) ?? null
  const usable = fresh(entry)
  if (entry && !usable) void screenplayIdbTx(DOCUMENT_STORE, 'readwrite', (s) => s.delete(key))
  sessionMemo.set(key, usable)
  return usable
}

export function readScreenplayDocument(
  projectId: string,
  documentId: string | null | undefined,
): Promise<CachedScreenplayDocument | null> {
  return readEntry<CachedScreenplayDocument>(screenplayDocumentCacheKey(projectId, documentId))
}

export function readScreenplayDocumentList(
  projectId: string,
): Promise<CachedScreenplayDocumentList | null> {
  return readEntry<CachedScreenplayDocumentList>(screenplayDocumentListCacheKey(projectId))
}

export interface WriteScreenplayDocumentInput {
  projectId: string
  documentId: string | null | undefined
  version: number | null
  source: 'server' | 'editor'
  name?: string | null
  isPrimary?: boolean
  layout?: unknown
  pageCount?: number | null
  content: unknown
}

/**
 * Persists one screenplay body.
 *
 * Empty content is refused rather than stored: an editor that has not finished mounting reports an
 * empty document, and writing that would replace a good cache entry with a blank screenplay — the
 * one failure mode a local cache must never have.
 */
export async function writeScreenplayDocument(
  input: WriteScreenplayDocumentInput,
): Promise<void> {
  const { projectId, documentId, content } = input
  if (!projectId || content == null) return

  let serialised: string
  try {
    serialised = JSON.stringify(content)
  } catch {
    return
  }
  if (serialised.length > MAX_CONTENT_CHARS) return

  const entry: CachedScreenplayDocument = {
    key: screenplayDocumentCacheKey(projectId, documentId),
    projectId,
    documentId: documentId ?? null,
    updatedAt: Date.now(),
    version: input.version ?? null,
    source: input.source,
    name: input.name ?? null,
    isPrimary: input.isPrimary ?? false,
    layout: input.layout ?? null,
    pageCount: input.pageCount ?? null,
    content,
  }
  sessionMemo.set(entry.key, entry)
  await screenplayIdbTx(DOCUMENT_STORE, 'readwrite', (s) => s.put(entry))
}

export async function writeScreenplayDocumentList(
  projectId: string,
  payload: unknown,
): Promise<void> {
  if (!projectId || payload == null) return
  const entry: CachedScreenplayDocumentList = {
    key: screenplayDocumentListCacheKey(projectId),
    projectId,
    updatedAt: Date.now(),
    payload,
  }
  sessionMemo.set(entry.key, entry)
  await screenplayIdbTx(DOCUMENT_STORE, 'readwrite', (s) => s.put(entry))
}

export async function deleteScreenplayDocument(
  projectId: string,
  documentId: string | null | undefined,
): Promise<void> {
  const key = screenplayDocumentCacheKey(projectId, documentId)
  sessionMemo.set(key, null)
  await screenplayIdbTx(DOCUMENT_STORE, 'readwrite', (s) => s.delete(key))
}

/**
 * Rebuilds a `getScreenplayDocument` response from a cache entry, so a cached body can be handed to
 * the same code path a server read feeds. Returns null when the entry holds no usable body.
 */
export function cachedDocumentAsQueryData(entry: CachedScreenplayDocument | null): unknown {
  if (!entry || entry.content == null) return null
  return {
    getScreenplayDocument: {
      _id: entry.documentId,
      name: entry.name,
      isPrimary: entry.isPrimary,
      layout: entry.layout,
      pageCount: entry.pageCount,
      versions: [{ version: entry.version ?? 0, content: entry.content }],
    },
  }
}
