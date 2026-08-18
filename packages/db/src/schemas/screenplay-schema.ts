import mongoose from "mongoose";

const screenplayContent = new mongoose.Schema({
    version: { type: Number },
    content: { type: mongoose.Schema.Types.Mixed }
})

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