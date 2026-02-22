"use strict";
/**
 * CLEANUP PHASE — run only after the new deployment (scenes in separate collection)
 * has been verified stable.
 *
 * Removes the legacy embedded "scenes" field from projects that have sceneOrder,
 * so the old data is not kept indefinitely.
 *
 * Run from repo root: npx ts-node apps/api/scripts/cleanup-unset-embedded-scenes.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const db_connector_1 = require("../src/db-connector");
const MONGODB_URI = process.env.MONGODB_CONNECTION_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/writual";
async function run() {
    await mongoose_1.default.connect(MONGODB_URI);
    console.log("Connected to MongoDB");
    const result = await db_connector_1.Projects.updateMany({
        sceneOrder: { $exists: true, $ne: [] },
        scenes: { $exists: true },
    }, { $unset: { scenes: "" } });
    console.log(`Cleaned up embedded 'scenes' from ${result.modifiedCount} projects.`);
    await mongoose_1.default.disconnect();
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
