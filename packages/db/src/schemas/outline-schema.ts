import mongoose from "mongoose"

export const formatStep = new mongoose.Schema({
    step_id: {type: String},
    name: {type: String},
    number:  {type: Number},
    act: {type:  String},
    instructions: { type: String }
})

export const formatSchema = new mongoose.Schema({
    format_id: {type: String},
    name: {type: String},
    steps: {type: [formatStep]}
})

export const outlineFrameworkSchema = new mongoose.Schema({
  id: { type: String },
  user: { type: String },
  projectId: { type: String },
  format: { type: formatSchema },
});

/** Standalone collection for user's saved outline frameworks (templates). */
export const outlineFrameworkStandaloneSchema = new mongoose.Schema({
  id: { type: String },
  user: { type: String, required: true },
  name: { type: String, required: true },
  imageUrl: { type: String },
  format: { type: formatSchema },
});