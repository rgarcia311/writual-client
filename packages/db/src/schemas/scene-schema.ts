import mongoose from "mongoose";

export const sceneContentSchema = new mongoose.Schema(
  {
    version: { type: Number },
    locked: { type: Boolean, default: false },
    thesis: { type: String },
    antithesis: { type: String },
    synthesis: { type: String },
    synopsis: { type: String },
    act: { type: Number },
    step: { type: String },
    sceneHeading: { type: String },
    content: { type: String },
  },
  { timestamps: true }
);

export const sceneSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Projects",
    required: true,
    index: true,
  },
  /**
   * The screenplay document this scene was derived from, when it came from a PDF import.
   * Null/absent means the scene belongs to the project's primary screenplay document, which is how
   * every scene created before multi-document support reads.
   */
  screenplayDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Screenplays",
    default: null,
    index: true,
  },
  activeVersion: { type: Number, default: 1 },
  lockedVersion: { type: Number },
  newVersion: { type: Boolean },
  newScene: { type: Boolean },
  versions: [sceneContentSchema],
});
