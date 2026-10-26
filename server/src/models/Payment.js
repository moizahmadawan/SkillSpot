import mongoose from 'mongoose';
const { Schema } = mongoose;
// Ledger entry for one paid job. TEST MODE: no real money moves until a payment gateway is connected.
const s = new Schema({
  booking: { type: Schema.Types.ObjectId, ref: 'Booking', unique: true },
  client: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  freelancer: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  title: String,
  amount: Number,
  commissionRate: Number, commission: Number,
  taxRate: Number, tax: Number,
  freelancerNet: Number,
  status: { type: String, enum: ['pending', 'held', 'released', 'refunded', 'cancelled'], default: 'pending' },
  commissionStatus: { type: String, enum: ['pending', 'received', 'none'], default: 'pending' },
  taxPaid: { type: Boolean, default: false },
  method: String, reference: String,
  paidAt: Date, releasedAt: Date,
}, { timestamps: true });
s.index({ status: 1, createdAt: -1 });
s.index({ freelancer: 1, status: 1 });
s.index({ client: 1, status: 1 });
export default mongoose.model('Payment', s);
