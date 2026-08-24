import mongoose from "mongoose";
import { ProjectType } from "../enums";
import { outlineFrameworkSchema } from "./outline-schema";
import { inspirationSchema } from "./inspiration-schema";
import { screenplaySchema } from "./screenplay-schema";
import { feedbackSchema } from "./feedback-schema";
import { loglineVersionSchema } from "./logline-schema";

const collaboratorSchema = new mongoose.Schema({
  email:           { type: String, required: true },
  uid:             { type: String, default: null },
  status:          { type: String, enum: ['pending', 'active'], default: 'pending' },
  permissionLevel: { type: String, enum: ['edit', 'comment'], default: 'comment' },
  // 'treatment' is retained for backward compatibility: the Treatment feature was removed, but
  // existing collaborator docs may still hold this value and would fail enum validation on save.
  aspects:         [{ type: String, enum: ['logline', 'characters', 'outline', 'treatment', 'screenplay'] }],
  // Which of the project's screenplay documents this collaborator was granted, by `Screenplays._id`.
  // Empty is the default and means *every* document, including ones added after the invite — so a
  // collaborator is never left behind when the writer starts a new draft.
  screenplayDocumentIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  inviteToken:     { type: String, default: null },
  invitedAt:       { type: Date, default: Date.now },
});

collaboratorSchema.index({ inviteToken: 1 }, { sparse: true });

const projectStatsSchema = new mongoose.Schema(
  {
    totalScenes: { type: Number, default: 0 },
    lockedScenes: { type: Number, default: 0 },
    totalCharacters: { type: Number, default: 0 },
    lockedCharacters: { type: Number, default: 0 },
  },
  { _id: false }
);

const draftDueDateSchema = new mongoose.Schema(
  {
    draftNumber:  { type: Number, required: true },
    label:        { type: String, required: true },
    dueDate:      { type: String, required: true },
    tag:          { type: String, default: null },
  },
  { _id: false }
);

const writingTrackerSchema = new mongoose.Schema(
  {
    enabled:           { type: Boolean, default: false },
    targetPageCount:   { type: Number, default: null },
    currentPageCount:  { type: Number, default: null },
    trackingStartDate: { type: String, default: null },
    draftDueDates:     { type: [draftDueDateSchema], default: [] },
  },
  { _id: false }
);

// sceneOrder: ref must match model name in db-connector (e.g. mongoose.model("Scenes", ...) => ref: "Scenes")
export const projectSchema = new mongoose.Schema({
    created_date: { type: String },
    modified_date: { type: String },
    revision: { type: Number },
    user: { type: String },
    displayName: { type: String },
    email: { type: String },
    sharedWith: { type: [String] },
    collaborators: { type: [collaboratorSchema], default: [] },
    type: { type: String, enum: ProjectType },
    genre: { type: String },
    title: { type: String },
    logline: { type: String },
    /** Iteration history for the logline; the entry with `current: true` mirrors `logline`. */
    loglineHistory: { type: [loglineVersionSchema], default: [] },
    budget: { type: Number },
    poster: { type: String },
    timePeriod: { type: String },
    similarProjects: [String],
    outlineName: { type: String },
    sceneOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: "Scenes" }],
    characterOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: "Characters" }],
    outline: { type: outlineFrameworkSchema },
    // Store inspiration as an array of subdocuments so it matches the GraphQL type [inspiration].
    inspiration: { type: [inspirationSchema] },
    screenplay: { type: screenplaySchema },
    feedback: { type: feedbackSchema },
    // Progress: lightweight counts for dashboard (no full scenes/characters).
    stats: { type: projectStatsSchema, default: () => ({}) },
    // User-defined page goal; completion dots ignore this and use manual lock only.
    pageCountEstimate: { type: Number },
    writingTracker: { type: writingTrackerSchema, default: null },
    progressTrackingEnabled: { type: Boolean, default: false },
    // Section lock: when true, no add/delete scenes or characters.
    outlineSectionLocked: { type: Boolean, default: false },
    charactersSectionLocked: { type: Boolean, default: false },
    // Title/logline progress: complete when lockedVersion === activeVersion.
    activeVersion: { type: Number, default: 1 },
    lockedVersion: { type: Number },
});