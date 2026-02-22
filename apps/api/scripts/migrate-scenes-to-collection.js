"use strict";
/**
 * Idempotent migration: move embedded project.scenes into the Scenes collection
 * and set project.sceneOrder to the new scene _ids (in order).
 *
 * - Skips projects that already have sceneOrder (and it is non-empty).
 * - For projects with embedded scenes and no sceneOrder: inserts each scene
 *   into Scenes collection (no number field), builds sceneOrder, updates
 *   project with $set: { sceneOrder } only. Does NOT $unset scenes (backup).
 *
 * Run from repo root: npx ts-node apps/api/scripts/migrate-scenes-to-collection.ts
 * Or after build: node apps/api/dist/scripts/migrate-scenes-to-collection.js
 *
 * CLEANUP PHASE (run separately after deployment is verified stable):
 * $unset the "scenes" field from projects that have sceneOrder and still have scenes.
 * Example (run in mongosh or a separate script):
 *   db.projects.updateMany(
 *     { sceneOrder: { $exists: true, $ne: [] }, scenes: { $exists: true } },
 *     { $unset: { scenes: "" } }
 *   )
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
    // Only migrate projects that have embedded scenes and no sceneOrder (or empty).
    const projects = await db_connector_1.Projects.find({
        scenes: { $exists: true, $type: "array", $ne: [] },
        $or: [
            { sceneOrder: { $exists: false } },
            { sceneOrder: { $size: 0 } },
        ],
    })
        .lean()
        .exec();
    console.log(`Found ${projects.length} projects to migrate (embedded scenes, no sceneOrder)`);
    for (const project of projects) {
        const proj = project;
        const embeddedScenes = proj.scenes ?? [];
        if (embeddedScenes.length === 0)
            continue;
        const session = await mongoose_1.default.connection.startSession();
        session.startTransaction();
        try {
            const sceneOrder = [];
            for (const s of embeddedScenes) {
                const doc = {
                    projectId: proj._id,
                    activeVersion: s.activeVersion ?? 1,
                    lockedVersion: s.lockedVersion,
                    newVersion: s.newVersion,
                    newScene: s.newScene,
                    versions: s.versions ?? [],
                };
                const [created] = await db_connector_1.Scenes.create([doc], { session });
                sceneOrder.push(created._id);
            }
            await db_connector_1.Projects.findByIdAndUpdate(proj._id, { $set: { sceneOrder } }, { session }).exec();
            await session.commitTransaction();
            console.log(`Migrated project ${proj._id}: ${sceneOrder.length} scenes`);
        }
        catch (e) {
            await session.abortTransaction();
            console.error(`Failed project ${proj._id}:`, e);
            throw e;
        }
        finally {
            session.endSession();
        }
    }
    console.log("Migration done. Do NOT $unset project.scenes until deployment is verified.");
    await mongoose_1.default.disconnect();
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
