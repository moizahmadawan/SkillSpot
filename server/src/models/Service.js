import mongoose from 'mongoose';
const { Schema } = mongoose;
// A fixed-price offer a freelancer sells (Fiverr-style "gig"). Clients can order it directly.
const s = new Schema({
  freelancer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 100 },
  category: { type: String, required: true },
  description: { type: String, required: true, maxlength: 2000 },
  price: { type: Number, required: true, min: 300 },
  deliveryDays: { type: Number, default: 3, min: 1, max: 90 },
  tags: [String],
  active: { type: Boolean, default: true },
}, { timestamps: true });
s.index({ active: 1, category: 1, createdAt: -1 });
s.index({ freelancer: 1, active: 1 });
s.index({ title: 'text', description: 'text', tags: 'text' });
export default mongoose.model('Service', s);
