"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.outlineFrameworkStandaloneSchema = exports.outlineFrameworkSchema = exports.formatSchema = exports.formatStep = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
exports.formatStep = new mongoose_1.default.Schema({
    step_id: { type: String },
    name: { type: String },
    number: { type: Number },
    act: { type: String },
    instructions: { type: String }
});
exports.formatSchema = new mongoose_1.default.Schema({
    format_id: { type: String },
    name: { type: String },
    steps: { type: [exports.formatStep] }
});
exports.outlineFrameworkSchema = new mongoose_1.default.Schema({
    id: { type: String },
    user: { type: String },
    projectId: { type: String },
    format: { type: exports.formatSchema },
});
/** Standalone collection for user's saved outline frameworks (templates). */
exports.outlineFrameworkStandaloneSchema = new mongoose_1.default.Schema({
    id: { type: String },
    user: { type: String, required: true },
    name: { type: String, required: true },
    imageUrl: { type: String },
    format: { type: exports.formatSchema },
});
