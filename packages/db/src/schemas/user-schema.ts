import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema({
  colorMode: { type: String, enum: ['dark', 'light'], default: 'dark' },
  lastReadByProject: { type: Map, of: Date, default: {} },
  lastReadByConversation: { type: Map, of: Date, default: {} },
}, { _id: false });

export const userSchema = new mongoose.Schema({
  uid:         { type: String, required: true, unique: true, index: true },
  email:       { type: String, default: null },
  name:        { type: String, default: null },
  displayName: { type: String, default: null },
  tier:        { type: String, enum: ['spec', 'indie', 'greenlit', 'beta-access'], default: 'beta-access' },
  settings:    { type: userSettingsSchema, default: () => ({}) },
});
