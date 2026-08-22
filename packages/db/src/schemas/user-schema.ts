import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema({
  colorMode: { type: String, enum: ['dark', 'light'], default: 'dark' },
  lastReadByProject: { type: Map, of: Date, default: {} },
  lastReadByConversation: { type: Map, of: Date, default: {} },
  // Visible stat tiles per project page, keyed by page ('overview' | 'characters' | 'notes' | 'outline').
  // A missing key means that page falls back to its default tiles; an empty array means the user hid them all.
  statTilePreferences: { type: Map, of: [String], default: {} },
  // Set once the user finishes the intro walkthrough or ticks "Don't show this again" inside it.
  // While false (the default for every new account) the walkthrough auto-starts after login.
  walkthroughDismissed: { type: Boolean, default: false },
}, { _id: false });

export const userSchema = new mongoose.Schema({
  uid:         { type: String, required: true, unique: true, index: true },
  email:       { type: String, default: null },
  name:        { type: String, default: null },
  displayName: { type: String, default: null },
  tier:        { type: String, enum: ['spec', 'indie', 'greenlit', 'beta-access'], default: 'beta-access' },
  settings:    { type: userSettingsSchema, default: () => ({}) },
});
