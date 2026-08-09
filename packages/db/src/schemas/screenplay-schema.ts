import mongoose from "mongoose";

const screenplayContent = new mongoose.Schema({
    version: { type: Number },
    content: { type: mongoose.Schema.Types.Mixed }
})

export const screenplaySchema = new mongoose.Schema({
    projectId: { type: String },
    versions: [screenplayContent],
    lockedVersion: { type: Number },
    // Per-document layout overrides inferred from an imported PDF's geometry (see
    // apps/web/src/lib/screenplayLayout.ts). Null/absent ⇒ editor uses the WGA defaults.
    layout: { type: mongoose.Schema.Types.Mixed, default: null },
});