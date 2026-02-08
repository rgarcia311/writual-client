"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.screenplaySchema = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const screenplayContent = new mongoose_1.default.Schema({
    version: { type: Number },
    text: { type: String }
});
exports.screenplaySchema = new mongoose_1.default.Schema({
    projectId: { type: String },
    versions: { type: [screenplayContent] }
});
