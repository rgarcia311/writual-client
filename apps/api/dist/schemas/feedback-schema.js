"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackSchema = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const feedbackContentSchema = new mongoose_1.default.Schema({
    text: { type: String },
    revision: { type: String }
});
exports.feedbackSchema = new mongoose_1.default.Schema({
    projectId: { type: String },
    user: { type: String },
    feedback_content: { type: [feedbackContentSchema] }
});
