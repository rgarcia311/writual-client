import mongoose from "mongoose";

const treatmentContent = new mongoose.Schema({
    version:  { type:  Number },
    text: { type: String }
})

export const treatmentSchema = new mongoose.Schema({
    projectId: { type: String },
    versions: [treatmentContent],
    lockedVersion: { type: Number },
});