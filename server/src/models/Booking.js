import mongoose from 'mongoose';
const { Schema } = mongoose;
const s = new Schema({
  gig: { type: Schema.Types.ObjectId, ref: 'Gig' },
  service: { type: Schema.Types.ObjectId, ref: 'Service' },
  kind: { type: String, enum: ['hire', 'order', 'proposal'], default: 'hire' },
  title: String, // snapshot of the gig or service title
  days: Number,
  client: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  freelancer: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  price: Number,
  note: { type: String, maxlength: 500 },
  status: { type: String, enum: ['requested', 'accepted', 'declined', 'completed', 'cancelled', 'expired'], default: 'requested' },
  cancelledBy: { type: String, enum: ['client', 'freelancer'] },
  expiresAt: Date,
  respondedAt: Date,
  rating: Number,
  review: { type: String, maxlength: 500 },
}, { timestamps: true });
s.index({ client: 1, status: 1, createdAt: -1 });
s.index({ freelancer: 1, status: 1, createdAt: -1 });
s.index({ gig: 1, freelancer: 1, status: 1 });
export default mongoose.model('Booking', s);
