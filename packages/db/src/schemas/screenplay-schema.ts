import mongoose from "mongoose";

const screenplayContent = new mongoose.Schema({
    version: { type: Number },
    content: { type: mongoose.Schema.Types.Mixed }
})

/**
 * Legacy embedded screenplay on `project.screenplay`.
 *
 * Superseded by the standalone `Screenplays` collection (`screenplayDocumentSchema` below), which
 * lets a project hold several screenplay documents. Retained so existing project documents keep
 * validating and so `ensureScreenplayDocuments` can migrate them on first read; nothing writes to
 * it any more.
 */
export const screenplaySchema = new mongoose.Schema({
    projectId: { type: String },
    versions: [screenplayContent],
    lockedVersion: { type: Number },
    // Body page total (excludes the title page) recorded by the editor's pagination on save, so
    // consumers that don't load `versions.content` (dashboard cards, the enable-tracking modal)
    // have a page count even when the writing tracker is off. Absent ⇒ derive an estimate.
    pageCount: { type: Number, default: null },
    // Per-document layout overrides inferred from an imported PDF's geometry (see
    // apps/web/src/lib/screenplayLayout.ts). Null/absent ⇒ editor uses the WGA defaults.
    layout: { type: mongoose.Schema.Types.Mixed, default: null },
});

/**
 * One screenplay document belonging to a project. A project may hold several — e.g. the original
 * draft plus a PDF imported later as a separate document — and each carries its own Yjs
 * collaboration state, keyed `"<projectId>:<documentId>"`.
 *
 * Exactly one document per project has `isPrimary: true`; it is what `Project.screenplay` resolves
 * to, so every pre-existing read path (dashboard cards, page counts, chat) keeps working unchanged.
 */
export const screenplayDocumentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Projects",
      required: true,
      index: true,
    },
    /** User-facing tab label, e.g. "Draft 2" or the imported PDF's file name. */
    name: { type: String, default: "Screenplay" },
    /** The document `Project.screenplay` resolves to. Exactly one per project. */
    isPrimary: { type: Boolean, default: false },
    /** Tab order on the screenplay page; ties break by `createdAt`. */
    order: { type: Number, default: 0 },
    /** Original file name when this document came from a PDF import. */
    sourceFileName: { type: String, default: null },
    versions: [screenplayContent],
    lockedVersion: { type: Number },
    // Body page total (excludes the title page) recorded by the editor's pagination on save.
    pageCount: { type: Number, default: null },
    // Per-document layout overrides inferred from an imported PDF's geometry.
    layout: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// Tab listing and the `Project.screenplay` primary lookup both sort on this pair.
screenplayDocumentSchema.index({ projectId: 1, order: 1 });
