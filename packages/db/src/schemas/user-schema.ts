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

/**
 * One browser's Web Push registration. A person collects one per device and per browser — a phone
 * PWA, a laptop's Chrome and that same laptop's Safari are three separate endpoints, all of which
 * should ring. The push service hands back the endpoint URL and the two keys its payloads must be
 * encrypted with; none of it is guessable or reusable elsewhere, and a stale one is removed when
 * the push service reports it gone.
 */
const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth:   { type: String, required: true },
  },
  /** Only ever shown back to the user, so they can tell one registered device from another. */
  userAgent: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

export const userSchema = new mongoose.Schema({
  uid:         { type: String, required: true, unique: true, index: true },
  email:       { type: String, default: null },
  name:        { type: String, default: null },
  displayName: { type: String, default: null },
  tier:        { type: String, enum: ['spec', 'indie', 'greenlit', 'beta-access'], default: 'beta-access' },
  settings:    { type: userSettingsSchema, default: () => ({}) },
  pushSubscriptions: { type: [pushSubscriptionSchema], default: [] },
});
