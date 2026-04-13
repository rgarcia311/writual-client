import mongoose from "mongoose";

export const inspirationSchema = new mongoose.Schema({
  projectId: { type: String, required: true },
  title: { type: String, required: true },
  image: { type: String },
  video: { type: String },
  note: { type: String },
  links: { type: [String], default: [] },
});