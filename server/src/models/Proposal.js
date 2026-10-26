import mongoose from 'mongoose';
const { Schema } = mongoose;
// A freelancer's application to a client's gig (Upwork-style).
const s = new Schema({
  gig: { type: Schema.Types.ObjectId, ref: 'Gig', required: true },
  freelancer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coverLetter: { type: String, required: true, maxlength: 1500 },
  price: { type: Number, required: true },
  days: { type: Number, default: 3, min: 1, max: 365 },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'withdrawn'], default: 'pending' },
}, { timestamps: true });
s.index({ gig: 1, freelancer: 1 }, { unique: true });
s.index({ freelancer: 1, createdAt: -1 });
s.index({ gig: 1, status: 1, createdAt: -1 });
export default mongoose.model('Proposal', s);
