import mongoose from "mongoose";

/** One piece of feedback left on a logline version by the owner or a shared collaborator. */
export const loglineFeedbackSchema = new mongoose.Schema(
  {
    authorUid: { type: String, required: true },
    // Display name captured at write time so a thread renders without a second lookup.
    authorName: { type: String, default: "" },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

/**
 * One iteration of the project logline. Exactly one entry carries `current: true`; its text is
 * mirrored into `project.logline`, which stays the source of truth for the rest of the app.
 */
export const loglineVersionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    authorUid: { type: String, default: null },
    authorName: { type: String, default: "" },
    current: { type: Boolean, default: false },
    feedback: { type: [loglineFeedbackSchema], default: [] },
  },
  { timestamps: true }
);
