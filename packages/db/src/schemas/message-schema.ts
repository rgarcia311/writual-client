import mongoose from "mongoose";

export const messageSchema = new mongoose.Schema(
  {
    text:           { type: String, required: true },
    senderId:       { type: mongoose.Schema.Types.ObjectId, ref: "AppUsers", required: true },
    projectId:      { type: mongoose.Schema.Types.ObjectId, ref: "Projects", required: true, index: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversations", required: false, index: true },
  },
  { timestamps: true }
);

// Compound index for efficient "fetch last N messages for a project" queries (legacy)
messageSchema.index({ projectId: 1, createdAt: -1 });
// Compound index for conversation-scoped queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
