import mongoose from 'mongoose';
const s = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, maxlength: 3000 },
  category: String,
  skills: [String],
  budget: Number,
  city: String,
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [73.0479, 33.6844] } },
  status: { type: String, enum: ['open', 'in_progress', 'completed', 'closed', 'pending_review', 'rejected', 'removed'], default: 'open' },
  risk: { score: { type: Number, default: 0 }, reasons: [String] },
  fingerprint: String,
  aiReview: { summary: String, reasons: [String], score: Number },
  removedReason: String,
  proposalCount: { type: Number, default: 0 },
}, { timestamps: true });
s.index({ location: '2dsphere' });
s.index({ status: 1, createdAt: -1 });
s.index({ owner: 1, createdAt: -1 });
s.index({ category: 1, status: 1 });
s.index({ title: 'text', description: 'text', skills: 'text' });
export default mongoose.model('Gig', s);
