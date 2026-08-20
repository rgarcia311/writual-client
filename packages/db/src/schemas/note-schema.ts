import mongoose from "mongoose";

/**
 * Link from a note to something else in the project. `kind: "none"` is a free-floating
 * note; character/scene/inspiration notes carry the target's _id plus a denormalized label
 * so the card can render without a second lookup (and still reads sanely if the target is
 * deleted).
 */
export const noteAssociationSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["none", "character", "scene", "inspiration"],
      default: "none",
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    label: { type: String, default: null },
  },
  { _id: false }
);

export const noteSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Projects",
      required: true,
      index: true,
    },
    title: { type: String, default: "" },
    category: { type: String, default: "" },
    // Rich text, stored as HTML produced by the editor.
    content: { type: String, default: "" },
    // Whether the note has already made it into the story.
    incorporated: { type: Boolean, default: false },
    // False parks the note in the "Maybe" bucket: kept around, not committed to the story.
    shouldIncorporate: { type: Boolean, default: true },
    association: { type: noteAssociationSchema, default: () => ({ kind: "none" }) },
  },
  { timestamps: true }
);
