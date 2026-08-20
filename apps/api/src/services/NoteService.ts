import mongoose from "mongoose";
import { Projects, Notes } from "@writual/db";
import { toObjectId, nowIso } from "../utils/mongoUtils";

/** How a note links to the rest of the project. */
export interface NoteAssociationPayload {
  kind?: "none" | "character" | "scene" | "inspiration";
  targetId?: string | null;
  label?: string | null;
}

export interface CreateNotePayload {
  title?: string;
  category?: string;
  /** Rich text as HTML. */
  content?: string;
  incorporated?: boolean;
  shouldIncorporate?: boolean;
  association?: NoteAssociationPayload;
}

/** Every field optional: the notes UI patches single flags (e.g. incorporated) on their own. */
export type UpdateNotePayload = CreateNotePayload;

const ASSOCIATION_KINDS = new Set(["none", "character", "scene", "inspiration"]);

/**
 * Normalizes an association payload. A kind of "none" (or a missing target) clears
 * targetId/label so a note switched back to unassociated doesn't keep a stale link.
 */
function normalizeAssociation(association: NoteAssociationPayload | undefined) {
  const kind = association?.kind && ASSOCIATION_KINDS.has(association.kind) ? association.kind : "none";
  if (kind === "none" || !association?.targetId) {
    return { kind: "none" as const, targetId: null, label: null };
  }
  return {
    kind,
    targetId: toObjectId(association.targetId),
    label: association.label ?? null,
  };
}

/** Notes for one project, newest first. */
export async function getNotesByProjectId(projectId: string): Promise<any[]> {
  return Notes.find({ projectId: toObjectId(projectId) })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
}

/**
 * Batch load notes for multiple projects (same order as input projectIds).
 * For use with DataLoader to avoid N+1 when resolving Project.notes for many projects.
 */
export async function getNotesByProjectIdsBatch(
  projectIds: readonly string[]
): Promise<any[][]> {
  if (projectIds.length === 0) return [];
  const ids = projectIds.map((id) => toObjectId(id));
  const notes = await Notes.find({ projectId: { $in: ids } })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  const byProject = new Map<string, any[]>();
  for (const note of notes) {
    const key = (note as any).projectId?.toString?.() ?? String((note as any).projectId);
    const bucket = byProject.get(key);
    if (bucket) bucket.push(note);
    else byProject.set(key, [note]);
  }
  return projectIds.map((pid) => byProject.get(pid) ?? []);
}

/** Creates a note for a project and bumps the project's modified_date. */
export async function createNote(
  projectId: string,
  payload: CreateNotePayload
): Promise<mongoose.Document> {
  const pid = toObjectId(projectId);
  const project = await Projects.findById(pid).lean().exec();
  if (!project) throw new Error("Project not found");

  const note = await Notes.create({
    projectId: pid,
    title: payload.title ?? "",
    category: payload.category ?? "",
    content: payload.content ?? "",
    incorporated: payload.incorporated ?? false,
    shouldIncorporate: payload.shouldIncorporate ?? true,
    association: normalizeAssociation(payload.association),
  });

  await Projects.findByIdAndUpdate(pid, { $set: { modified_date: nowIso() } }).exec();
  return note;
}

/** Partially updates a note; only the keys present on the payload are written. */
export async function updateNote(
  noteId: string,
  payload: UpdateNotePayload
): Promise<mongoose.Document | null> {
  const note = await Notes.findById(toObjectId(noteId)).exec();
  if (!note) return null;
  const doc = note as any;

  if (payload.title !== undefined) doc.title = payload.title;
  if (payload.category !== undefined) doc.category = payload.category;
  if (payload.content !== undefined) doc.content = payload.content;
  if (payload.incorporated !== undefined) doc.incorporated = payload.incorporated;
  if (payload.shouldIncorporate !== undefined) doc.shouldIncorporate = payload.shouldIncorporate;
  if (payload.association !== undefined) doc.association = normalizeAssociation(payload.association);

  await note.save();

  const projectId = doc.projectId?.toString?.() ?? doc.projectId;
  if (projectId) {
    await Projects.findByIdAndUpdate(toObjectId(projectId), {
      $set: { modified_date: nowIso() },
    }).exec();
  }
  return note;
}

/** Deletes a note. Returns its projectId so callers can revalidate by path. */
export async function deleteNote(
  noteId: string
): Promise<{ deleted: boolean; projectId?: string }> {
  const nid = toObjectId(noteId);
  const note = await Notes.findById(nid).lean().exec();
  if (!note) return { deleted: false };
  const projectId = (note as any).projectId?.toString?.() ?? (note as any).projectId;
  await Notes.deleteOne({ _id: nid }).exec();
  if (projectId) {
    await Projects.findByIdAndUpdate(toObjectId(projectId), {
      $set: { modified_date: nowIso() },
    }).exec();
  }
  return { deleted: true, projectId };
}
