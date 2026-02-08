"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sceneSchema = exports.sceneContent = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
exports.sceneContent = new mongoose_1.default.Schema({
    version: { type: Number },
    locked: { type: Boolean },
    thesis: { type: String },
    antithesis: { type: String },
    synthesis: { type: String },
    synopsis: { type: String },
    act: { type: Number },
    step: { type: String },
    sceneHeading: { type: String },
});
exports.sceneSchema = new mongoose_1.default.Schema({
    projectId: { type: String },
    number: { type: Number },
    activeVersion: { type: Number },
    lockedVersion: { type: Number },
    newVersion: { type: Boolean },
    newScene: { type: Boolean },
    versions: [exports.sceneContent]
});
