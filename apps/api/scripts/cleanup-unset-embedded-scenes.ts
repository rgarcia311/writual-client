/**
 * CLEANUP PHASE — run only after the new deployment (scenes in separate collection)
 * has been verified stable.
 *
 * Removes the legacy embedded "scenes" field from projects that have sceneOrder,
 * so the old data is not kept indefinitely.
 *
 * Run from repo root: npx ts-node apps/api/scripts/cleanup-unset-embedded-scenes.ts
 */

import mongoose from "mongoose";
import { Projects } from "../src/db-connector";

const MONGODB_URI =
  process.env.MONGODB_CONNECTION_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/writual";

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const result = await Projects.updateMany(
    {
      sceneOrder: { $exists: true, $ne: [] },
      scenes: { $exists: true },
    },
    { $unset: { scenes: "" } }
  );

  console.log(`Cleaned up embedded 'scenes' from ${result.modifiedCount} projects.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
