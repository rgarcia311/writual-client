import mongoose from "mongoose";

export const characterContentSchema = new mongoose.Schema({
  version: { type: Number },
  bio: { type: String },
  name: { type: String },
  age: { type: Number },
  gender: { type: String },
  need: { type: String },
  want: { type: String },
});

export const characterSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Projects",
    required: true,
    index: true,
  },
  imageUrl: { type: String },
  details: [characterContentSchema],
});
