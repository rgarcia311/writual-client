import mongoose from "mongoose";
import { Projects, Screenplays } from "@writual/db";
import { toObjectId, nowIso } from "../utils/mongoUtils";
import { deleteEntitiesForDocument } from "./ScreenplayEntityService";
import { resolveScreenplayPageCount } from "../utils/screenplayPageEstimate";

/**
 * Screenplay documents live in their own `Screenplays` collection (one row per document) rather
 * than embedded on the project, so a project can hold several drafts/imports without the project
 * document growing toward the 16MB BSON limit.
 *
 * Projects created before multi-document support still carry the old embedded `project.screenplay`.
 * `ensureScreenplayDocuments` migrates those on first read — see its comment for why that is done
 * lazily rather than as an offline script.
 */

/** Yjs collaboration state, written by apps/hocuspocus, keyed `"<projectId>:<documentId>"`. */
const YJS_COLLECTION = "yjs_documents";

/**
 * What a project's first screenplay was called before it took the project's title. Still the schema
 * default, and the marker the one-time rename below looks for.
 */
const LEGACY_PRIMARY_NAME = "Screenplay";

/** The project's title, trimmed; empty when the project is gone or has no title. */
async function getProjectTitle(pid: mongoose.Types.ObjectId): Promise<string> {
  const project = await Projects.findById(pid).select("title").lean().exec();
  const title = (project as { title?: unknown } | null)?.title;
  return typeof title === "string" ? title.trim() : "";
}

/**
 * A project's first screenplay is named after the project; the writer names the ones they add
 * after it. Projects migrated before that was true all got the generic `"Screenplay"`, so their
 * sole document adopts the title here, on read.
 *
 * The rename is self-limiting: after it the name no longer matches, so later reads fall straight
 * through. A project with a second document is left alone (its tabs are the writer's own naming),
 * and so is a document whose name is anything else — including one the writer renamed.
 */
async function adoptProjectTitleForSolePrimary(
  pid: mongoose.Types.ObjectId,
  documents: ScreenplayDocumentRow[]
): Promise<ScreenplayDocumentRow[]> {
  const only = documents[0];
  if (documents.length !== 1 || only.name !== LEGACY_PRIMARY_NAME) return documents;

  const title = await getProjectTitle(pid);
  if (title === "" || title === only.name) return documents;

  const renamed = await Screenplays.findOneAndUpdate(
    { _id: only._id, name: LEGACY_PRIMARY_NAME },
    { $set: { name: title } },
    { new: true }
  )
    .lean()
    .exec();

  return [(renamed as unknown as ScreenplayDocumentRow) ?? only];
}

export interface ScreenplayDocumentRow {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
  isPrimary: boolean;
  order: number;
  sourceFileName: string | null;
  /**
   * `content` is absent on rows from the batch loader. `documentId` is stamped on in that case so
   * the `ScreenplayContent.content` resolver can fetch the body only when a query selects it.
   */
  versions: Array<{
    version?: number;
    content?: unknown;
    documentId?: mongoose.Types.ObjectId;
  }>;
  lockedVersion?: number;
  pageCount: number | null;
  layout: unknown;
}

/**
 * The Yjs document name the editor connects with for this screenplay document. Must stay in sync
 * with `useCollaboration` (apps/web) and `onAuthenticate` (apps/hocuspocus).
 */
export function yjsDocumentName(
  projectId: string | mongoose.Types.ObjectId,
  documentId: string | mongoose.Types.ObjectId
): string {
  return `${String(projectId)}:${String(documentId)}`;
}

/**
 * Drops the stored Yjs state for a screenplay document.
 *
 * Required whenever a document's content is replaced out-of-band (a PDF re-import). Without it the
 * next client to connect re-syncs the *old* Y.Doc from `yjs_documents` and immediately writes it
 * back over the imported content, silently undoing the import.
 */
export async function resetYjsState(
  projectId: string | mongoose.Types.ObjectId,
  documentId: string | mongoose.Types.ObjectId
): Promise<void> {
  // Resolve the database the same way apps/hocuspocus does, so an explicit MONGODB_DB_NAME can't
  // leave this deleting from a different database than the one the Yjs state was written to.
  const dbName = process.env.MONGODB_DB_NAME?.trim();
  const db = dbName
    ? mongoose.connection.getClient().db(dbName)
    : mongoose.connection.db;
  if (!db) return;
  const name = yjsDocumentName(projectId, documentId);
  try {
    await db.collection(YJS_COLLECTION).deleteOne({ _id: name as never });
  } catch (e) {
    console.error("[screenplay] failed to reset Yjs state", { name, e });
  }
}

/**
 * Guarantees the project has at least one screenplay document and returns them all, ordered.
 *
 * Migration is lazy (on read) rather than a one-shot script because the collection is written by
 * three separate services and there is no migration runner in this repo; doing it here means a
 * project is migrated exactly once, the first time anything asks for its documents, with no
 * deploy-ordering requirement. The upsert is atomic on `{ projectId, isPrimary: true }`, so
 * concurrent readers cannot create duplicate primaries.
 */
export async function ensureScreenplayDocuments(
  projectId: string | mongoose.Types.ObjectId
): Promise<ScreenplayDocumentRow[]> {
  const pid = typeof projectId === "string" ? toObjectId(projectId) : projectId;

  const existing = await Screenplays.find({ projectId: pid })
    .sort({ order: 1, createdAt: 1 })
    .lean()
    .exec();
  if (existing.length > 0) {
    return adoptProjectTitleForSolePrimary(
      pid,
      existing as unknown as ScreenplayDocumentRow[]
    );
  }

  const project = await Projects.findById(pid).select("screenplay title").lean().exec();
  if (!project) return [];

  const projectTitle = (project as { title?: unknown }).title;
  const primaryName =
    typeof projectTitle === "string" && projectTitle.trim() !== ""
      ? projectTitle.trim()
      : LEGACY_PRIMARY_NAME;

  const legacy = (project as { screenplay?: Record<string, unknown> }).screenplay;
  const legacyVersions = Array.isArray(legacy?.versions) ? legacy!.versions : [];

  // Page totals are estimated from content when a document has never been saved by the paginating
  // editor. Do that once, here, rather than on every read: the batch loader deliberately does not
  // fetch `versions.content`, so the estimate would have nothing to work from later.
  const migratedPageCount =
    (legacy?.pageCount as number | null | undefined) ??
    (legacy ? resolveScreenplayPageCount(legacy as never) : null);

  // A project with no screenplay at all still gets an empty primary document, so the editor and
  // the tab bar always have a document to bind to instead of special-casing "none yet".
  const created = await Screenplays.findOneAndUpdate(
    { projectId: pid, isPrimary: true },
    {
      $setOnInsert: {
        projectId: pid,
        // The project's own screenplay, so it carries the project's name; a writer adding a second
        // one names it themselves.
        name: primaryName,
        isPrimary: true,
        order: 0,
        sourceFileName: null,
        versions: legacyVersions,
        lockedVersion: (legacy?.lockedVersion as number | undefined) ?? undefined,
        pageCount: migratedPageCount ?? null,
        layout: legacy?.layout ?? null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .lean()
    .exec();

  return [created as unknown as ScreenplayDocumentRow];
}

/** All screenplay documents for a project, tab order, migrating legacy data if needed. */
export async function listScreenplayDocuments(
  projectId: string
): Promise<ScreenplayDocumentRow[]> {
  return ensureScreenplayDocuments(projectId);
}

/**
 * Batch loader for `Project.screenplayDocuments` / `Project.screenplay`, returned in the same order
 * as `projectIds`. Projects needing migration are handled individually; already-migrated projects
 * (the overwhelming majority after first read) resolve in a single query.
 */
export async function getScreenplayDocumentsByProjectIdsBatch(
  projectIds: readonly string[]
): Promise<ScreenplayDocumentRow[][]> {
  if (projectIds.length === 0) return [];

  const ids: mongoose.Types.ObjectId[] = [];
  for (const id of projectIds) {
    try {
      ids.push(toObjectId(id));
    } catch {
      // Skip malformed ids; the corresponding slot resolves to [] below.
    }
  }

  // `versions.content` is excluded: a project can hold several feature-length scripts, and most
  // consumers of this loader (tab bars, dashboard cards, page counts) only need metadata. Queries
  // that do select the body get it through `ScreenplayContent.content`, which fetches on demand
  // using the document id stamped onto each version stub below.
  const rows = ids.length
    ? ((await Screenplays.find({ projectId: { $in: ids } })
        .select({ "versions.content": 0 })
        .sort({ order: 1, createdAt: 1 })
        .lean()
        .exec()) as unknown as ScreenplayDocumentRow[])
    : [];

  for (const row of rows) {
    if (!Array.isArray(row.versions)) continue;
    row.versions = row.versions.map((v) => ({ ...v, documentId: row._id }));
  }

  const byProject = new Map<string, ScreenplayDocumentRow[]>();
  for (const row of rows) {
    const key = String(row.projectId);
    const bucket = byProject.get(key);
    if (bucket) bucket.push(row);
    else byProject.set(key, [row]);
  }

  return Promise.all(
    projectIds.map(async (pid) => {
      const hit = byProject.get(pid);
      if (hit) return hit;
      try {
        return await ensureScreenplayDocuments(pid);
      } catch {
        return [];
      }
    })
  );
}

/** The document `Project.screenplay` resolves to: the primary, else the first in tab order. */
export function pickPrimary(
  documents: ScreenplayDocumentRow[]
): ScreenplayDocumentRow | null {
  if (documents.length === 0) return null;
  return documents.find((d) => d.isPrimary) ?? documents[0];
}

export async function getPrimaryScreenplayDocument(
  projectId: string
): Promise<ScreenplayDocumentRow | null> {
  return pickPrimary(await ensureScreenplayDocuments(projectId));
}

/**
 * Resolves a caller-supplied document id against a project, falling back to the primary when the id
 * is absent. Throws when the id names a document belonging to a different project, so a caller
 * cannot write across project boundaries with an id they happen to know.
 */
export async function resolveScreenplayDocument(
  projectId: string,
  documentId?: string | null
): Promise<ScreenplayDocumentRow> {
  const documents = await ensureScreenplayDocuments(projectId);
  if (documentId) {
    const match = documents.find((d) => String(d._id) === String(documentId));
    if (!match) throw new Error("Screenplay document not found for this project");
    return match;
  }
  const primary = pickPrimary(documents);
  if (!primary) throw new Error("Project not found");
  return primary;
}

/**
 * One screenplay document including its script body — the read the editor makes for the document
 * it is displaying. Everything else should go through the metadata-only batch loader.
 */
export async function getScreenplayDocumentWithContent(
  projectId: string,
  documentId?: string | null
): Promise<ScreenplayDocumentRow | null> {
  const target = await resolveScreenplayDocument(projectId, documentId ?? null);
  const full = await Screenplays.findOne({
    _id: target._id,
    projectId: toObjectId(projectId),
  })
    .lean()
    .exec();
  return (full as unknown as ScreenplayDocumentRow) ?? null;
}

/**
 * Batch loader for script bodies, keyed by screenplay document id.
 *
 * Backs `ScreenplayContent.content` so selecting the body costs one extra query per request rather
 * than being pulled eagerly by every query that happens to name the `screenplay` field.
 */
export async function getScreenplayContentByDocumentIdsBatch(
  documentIds: readonly string[]
): Promise<Array<Map<number, unknown>>> {
  if (documentIds.length === 0) return [];

  const ids: mongoose.Types.ObjectId[] = [];
  for (const id of documentIds) {
    if (mongoose.Types.ObjectId.isValid(id)) ids.push(new mongoose.Types.ObjectId(id));
  }

  const rows = ids.length
    ? await Screenplays.find({ _id: { $in: ids } })
        .select({ versions: 1 })
        .lean()
        .exec()
    : [];

  const byId = new Map<string, Map<number, unknown>>();
  for (const row of rows as unknown as ScreenplayDocumentRow[]) {
    const versionMap = new Map<number, unknown>();
    for (const v of row.versions ?? []) {
      versionMap.set(Number(v.version ?? 0), v.content ?? null);
    }
    byId.set(String(row._id), versionMap);
  }

  return documentIds.map((id) => byId.get(id) ?? new Map<number, unknown>());
}

export interface CreateScreenplayDocumentPayload {
  name?: string | null;
  content?: unknown;
  layout?: unknown;
  pageCount?: number | null;
  sourceFileName?: string | null;
}

/** Appends a new screenplay document to the project, placed last in tab order. */
export async function createScreenplayDocument(
  projectId: string,
  payload: CreateScreenplayDocumentPayload = {}
): Promise<ScreenplayDocumentRow> {
  const pid = toObjectId(projectId);
  const existing = await ensureScreenplayDocuments(pid);
  const nextOrder = existing.reduce((max, d) => Math.max(max, d.order ?? 0), -1) + 1;

  // Unnamed additions are numbered by position. Only a project with no documents at all reaches
  // the title branch — `ensureScreenplayDocuments` above normally creates the first one itself.
  const name =
    typeof payload.name === "string" && payload.name.trim() !== ""
      ? payload.name.trim()
      : existing.length === 0
        ? (await getProjectTitle(pid)) || LEGACY_PRIMARY_NAME
        : `Screenplay ${existing.length + 1}`;

  const created = await Screenplays.create({
    projectId: pid,
    name,
    // A newly added document never displaces the existing primary — `Project.screenplay` (and every
    // consumer reading through it) must keep pointing at the document it already pointed at.
    isPrimary: existing.length === 0,
    order: nextOrder,
    sourceFileName: payload.sourceFileName ?? null,
    versions: payload.content != null ? [{ version: 0, content: payload.content }] : [],
    pageCount: payload.pageCount ?? null,
    layout: isPlainObject(payload.layout) ? payload.layout : null,
  });

  await Projects.findByIdAndUpdate(pid, { $set: { modified_date: nowIso() } }).exec();
  return created.toObject() as unknown as ScreenplayDocumentRow;
}

export interface SaveScreenplayDocumentPayload {
  content: unknown;
  /** Only written when the key is present; layout-less autosaves must preserve the stored value. */
  layout?: unknown;
  pageCount?: number | null;
  /** Set for an out-of-band content replacement (PDF re-import) so stale Yjs state is dropped. */
  resetCollaboration?: boolean;
}

/** Writes content into one screenplay document. */
export async function saveScreenplayDocument(
  projectId: string,
  documentId: string,
  payload: SaveScreenplayDocumentPayload
): Promise<ScreenplayDocumentRow | null> {
  const pid = toObjectId(projectId);
  const did = toObjectId(documentId);

  const setDoc: Record<string, unknown> = {
    versions: [{ version: 0, content: payload.content }],
  };
  if ("layout" in payload) {
    setDoc.layout = isPlainObject(payload.layout) ? payload.layout : null;
  }
  if (payload.pageCount != null && Number.isFinite(payload.pageCount)) {
    setDoc.pageCount = Math.max(0, Math.round(payload.pageCount));
  }

  const updated = await Screenplays.findOneAndUpdate(
    { _id: did, projectId: pid },
    { $set: setDoc },
    { new: true }
  )
    .lean()
    .exec();
  if (!updated) return null;

  if (payload.resetCollaboration) {
    await resetYjsState(pid, did);
  }
  await Projects.findByIdAndUpdate(pid, { $set: { modified_date: nowIso() } }).exec();

  return updated as unknown as ScreenplayDocumentRow;
}

export async function renameScreenplayDocument(
  projectId: string,
  documentId: string,
  name: string
): Promise<ScreenplayDocumentRow | null> {
  const trimmed = name.trim();
  if (trimmed === "") throw new Error("Document name cannot be empty");
  const updated = await Screenplays.findOneAndUpdate(
    { _id: toObjectId(documentId), projectId: toObjectId(projectId) },
    { $set: { name: trimmed } },
    { new: true }
  )
    .lean()
    .exec();
  return (updated as unknown as ScreenplayDocumentRow) ?? null;
}

/**
 * Deletes a screenplay document, its Yjs state, and the characters/scenes that were imported with
 * it. The last remaining document cannot be deleted — the editor always needs one to bind to.
 */
export async function deleteScreenplayDocument(
  projectId: string,
  documentId: string
): Promise<{ deleted: boolean; reason?: string }> {
  const pid = toObjectId(projectId);
  const did = toObjectId(documentId);

  const documents = await ensureScreenplayDocuments(pid);
  if (documents.length <= 1) {
    return { deleted: false, reason: "A project must keep at least one screenplay document." };
  }
  const target = documents.find((d) => String(d._id) === String(did));
  if (!target) return { deleted: false, reason: "Screenplay document not found." };

  // `includeLocked`: the document is going away, so even finished cards must go with it rather
  // than be left pointing at a document that no longer exists.
  await deleteEntitiesForDocument(pid, did, { includeLocked: true });
  await Screenplays.deleteOne({ _id: did, projectId: pid }).exec();
  await resetYjsState(pid, did);

  // Deleting the primary promotes the next document so `Project.screenplay` never dangles.
  if (target.isPrimary) {
    const next = documents.find((d) => String(d._id) !== String(did));
    if (next) {
      await Screenplays.updateOne({ _id: next._id }, { $set: { isPrimary: true } }).exec();
    }
  }

  await Projects.findByIdAndUpdate(pid, { $set: { modified_date: nowIso() } }).exec();
  return { deleted: true };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
