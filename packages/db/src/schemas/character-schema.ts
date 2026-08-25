import mongoose from "mongoose";

export const characterContentSchema = new mongoose.Schema({
  version: { type: Number },
  bio: { type: String },
  name: { type: String },
  age: { type: Number },
  gender: { type: String },
  need: { type: String },
  want: { type: String },
});

export const characterSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Projects",
    required: true,
    index: true,
  },
  /**
   * Primary portrait. Kept as the first entry of `imageUrls` so every reader written before
   * multi-image support keeps working unchanged.
   */
  imageUrl: { type: String },
  /**
   * Full portrait gallery, in display order. The card scrolls through these; index 0 mirrors
   * `imageUrl`. Absent on characters created before multi-image support, which read as the single
   * `imageUrl` entry.
   */
  imageUrls: { type: [String], default: undefined },
  /**
   * The screenplay document this character was derived from, when it came from a PDF import.
   * Null/absent means the character belongs to the project's primary screenplay document, which is
   * how every character created before multi-document support reads.
   */
  screenplayDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Screenplays",
    default: null,
    index: true,
  },
  details: [characterContentSchema],
  activeVersion: { type: Number, default: 1 },
  lockedVersion: { type: Number },
});
