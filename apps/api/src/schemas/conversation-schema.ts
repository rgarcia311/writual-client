import mongoose from 'mongoose';

export const conversationSchema = new mongoose.Schema(
  {
    projectId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Projects', required: true, index: true },
    type:            { type: String, enum: ['direct', 'group'], required: true },
    name:            { type: String, default: null },
    participants:    { type: [String], required: true },  // Firebase UIDs
    conversationKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

// Key patterns:
//   Direct:  `${projectId}:direct:${[uid1, uid2].sort().join(':')}`
//   Group:   `${projectId}:group:${new ObjectId().toHexString()}`
//   General: `${projectId}:general`
conversationSchema.index({ projectId: 1, participants: 1 });
