import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema({
  colorMode: { type: String, enum: ['dark', 'light'], default: 'dark' },
}, { _id: false });

export const userSchema = new mongoose.Schema({
  uid:         { type: String, required: true, unique: true, index: true },
  name:        { type: String, default: null },
  displayName: { type: String, default: null },
  tier:        { type: String, enum: ['spec', 'indie', 'greenlit', 'beta-access'], default: 'beta-access' },
  settings:    { type: userSettingsSchema, default: () => ({}) },
});
