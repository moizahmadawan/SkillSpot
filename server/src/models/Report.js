import mongoose from 'mongoose';
const { Schema } = mongoose;
const s = new Schema({
  reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['user', 'gig', 'message', 'community'], required: true },
  target: { type: Schema.Types.ObjectId, required: true },
  offender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, enum: ['scam', 'fake_gig', 'time_waster', 'harassment', 'spam', 'other'], required: true },
  details: { type: String, maxlength: 500 },
  snippet: String, // copy of the reported message/gig title, so admins review only what was reported
  context: [{ who: String, text: String, at: Date }], // up to 4 messages before a reported chat message
  status: { type: String, enum: ['open', 'dismissed', 'actioned'], default: 'open' },
}, { timestamps: true });
s.index({ reporter: 1, targetType: 1, target: 1 }, { unique: true });
s.index({ status: 1, createdAt: -1 });
s.index({ offender: 1, status: 1 });
export default mongoose.model('Report', s);
