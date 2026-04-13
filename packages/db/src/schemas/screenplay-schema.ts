import mongoose from "mongoose";

const screenplayContent = new mongoose.Schema({
    version: { type: Number },
    content: { type: mongoose.Schema.Types.Mixed }
})

export const screenplaySchema = new mongoose.Schema({
    projectId: { type: String },
    versions: [screenplayContent],
    lockedVersion: { type: Number },
});