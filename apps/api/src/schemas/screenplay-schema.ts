import mongoose from "mongoose";

const screenplayContent = new mongoose.Schema({
    version: { type: Number },
    text:  { type: String }
})

export const screenplaySchema = new mongoose.Schema({
    projectId: { type: String },
    versions: [screenplayContent],
    lockedVersion: { type: Number },
});