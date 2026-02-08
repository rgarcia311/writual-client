"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectSchema = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const enums_1 = require("../enums");
const _1 = require("./");
const outline_schema_1 = require("./outline-schema");
const insporation_schema_1 = require("./insporation-schema");
const treatment_schema_1 = require("./treatment-schema");
const screenplay_schema_1 = require("./screenplay-schema");
const feedback_schema_1 = require("./feedback-schema");
exports.projectSchema = new mongoose_1.default.Schema({
    created_date: { type: String },
    modified_date: { type: String },
    revision: { type: Number },
    user: { type: String },
    sharedWith: { type: [String] },
    type: { type: String, enum: enums_1.ProjectType },
    genre: { type: String },
    title: { type: String },
    logline: { type: String },
    budget: { type: Number },
    poster: { type: String },
    timePeriod: { type: String },
    similarProjects: [String],
    outlineName: { type: String },
    scenes: { type: [_1.sceneSchema] },
    characters: { type: [_1.characterSchema] },
    outline: { type: outline_schema_1.outlineFrameworkSchema },
    insporation: { type: insporation_schema_1.insporationSchema }, //Continue exending  project schema from here
    treatment: { type: treatment_schema_1.treatmentSchema },
    screenplay: { type: screenplay_schema_1.screenplaySchema },
    feedback: { type: feedback_schema_1.feedbackSchema }
});
