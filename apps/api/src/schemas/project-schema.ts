import mongoose from "mongoose";
import { ProjectType } from "../enums";
import { outlineFrameworkSchema } from "./outline-schema";
import { inspirationSchema } from "./inspiration-schema";
import { treatmentSchema } from "./treatment-schema";
import { screenplaySchema } from "./screenplay-schema";
import { feedbackSchema } from "./feedback-schema";

const collaboratorSchema = new mongoose.Schema({
  email:           { type: String, required: true },
  uid:             { type: String, default: null },
  status:          { type: String, enum: ['pending', 'active'], default: 'pending' },
  permissionLevel: { type: String, enum: ['edit', 'comment'], default: 'comment' },
  aspects:         [{ type: String, enum: ['logline', 'characters', 'outline', 'treatment', 'screenplay'] }],
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
    treatment: { type: treatmentSchema },
    screenplay: { type: screenplaySchema },
    feedback: { type: feedbackSchema },
    // Progress: lightweight counts for dashboard (no full scenes/characters).
    stats: { type: projectStatsSchema, default: () => ({}) },
    // User-defined page goal; completion dots ignore this and use manual lock only.
    pageCountEstimate: { type: Number },
    // Section lock: when true, no add/delete scenes or characters.
    outlineSectionLocked: { type: Boolean, default: false },
    charactersSectionLocked: { type: Boolean, default: false },
    // Title/logline progress: complete when lockedVersion === activeVersion.
    activeVersion: { type: Number, default: 1 },
    lockedVersion: { type: Number },
});