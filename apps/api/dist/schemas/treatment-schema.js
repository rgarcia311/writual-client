"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.treatmentSchema = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const treatmentContent = new mongoose_1.default.Schema({
    version: { type: Number },
    text: { type: String }
});
exports.treatmentSchema = new mongoose_1.default.Schema({
    projectId: { type: String },
    versions: [treatmentContent]
});
