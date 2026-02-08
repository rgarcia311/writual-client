"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.characterSchema = exports.charContent = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
exports.charContent = new mongoose_1.default.Schema({
    version: { type: Number },
    bio: { type: String },
    name: { type: String },
    age: { type: Number },
    gender: { type: String }
});
exports.characterSchema = new mongoose_1.default.Schema({
    projectId: { type: String },
    number: { type: Number },
    imageUrl: { type: String },
    details: [exports.charContent]
});
