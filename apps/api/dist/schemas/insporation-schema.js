"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insporationSchema = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
exports.insporationSchema = new mongoose_1.default.Schema({
    projectId: { type: String },
    scratch: { type: String },
    images: { type: [String] },
    videos: { type: [String] }
});
