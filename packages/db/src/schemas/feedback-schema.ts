import mongoose from "mongoose";

const feedbackContentSchema = new mongoose.Schema({
    text: { type: String },
    revision: { type: String }
})

export const feedbackSchema  =  new mongoose.Schema({
    projectId: { type: String  },
    user: { type: String },
    feedback_content: { type: [feedbackContentSchema]}
})