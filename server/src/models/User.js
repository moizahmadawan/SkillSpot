import mongoose from 'mongoose';
const { Schema } = mongoose;
const s = new Schema({
  phone: { type: String, unique: true, required: true },
  name: { type: String, default: '', trim: true, maxlength: 60 },
  role: { type: String, enum: ['client', 'freelancer', 'admin'], default: 'client' },
  onboarded: { type: Boolean, default: false }, // role is chosen once and then locked
  email: { type: String, lowercase: true, trim: true }, // admin only
  passwordHash: { type: String, select: false },        // admin only
  accountStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, // admin checks the location, then approves
  accountNote: String,
  address: { type: String, default: '', maxlength: 120 },
  locationCheck: { distanceKm: Number, flag: Boolean, note: String },
  approvedLat: Number, approvedLng: Number,
  adminNote: { type: String, maxlength: 500 },
  avatarVersion: { type: Number, default: 0 },
  bio: { type: String, default: '', maxlength: 600 },
  skills: { type: [String], default: [] },
  experienceYears: { type: Number, default: 0, min: 0, max: 60 },
  hourlyRate: { type: Number, default: 0, min: 0, max: 100000 },
  available: { type: Boolean, default: true },
  locationSource: { type: String, enum: ['default', 'city', 'gps'], default: 'default' },
  city: { type: String, default: '', maxlength: 60 },
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [73.0479, 33.6844] } }, // [lng, lat]
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  verification: {
    status: { type: String, enum: ['none', 'pending', 'verified', 'needs_changes', 'revoked'], default: 'pending' },
    score: Number, summary: String, notes: [String], checkedAt: Date, aiPassed: Boolean, requestedAt: Date,
  },
  stats: { gigsPosted: { type: Number, default: 0 }, hires: { type: Number, default: 0 }, completed: { type: Number, default: 0 }, cancelDates: [Date] },
  restrictedUntil: Date,
  restrictionReason: String,
  banned: { type: Boolean, default: false },
  deactivated: { type: Boolean, default: false },
  blocked: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  tokenVersion: { type: Number, default: 0 },
}, { timestamps: true });
s.index({ location: '2dsphere' });
s.index({ role: 1, onboarded: 1, verified: -1, rating: -1 });
s.index({ role: 1, city: 1 });
s.index({ skills: 1 });
s.index({ accountStatus: 1, role: 1, createdAt: -1 });
s.index({ role: 1, email: 1 });
export default mongoose.model('User', s);
