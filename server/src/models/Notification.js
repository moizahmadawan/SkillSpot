import mongoose from 'mongoose';
const s = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: String, title: String, body: String, link: String,
  read: { type: Boolean, default: false },
}, { timestamps: true });
s.index({ user: 1, createdAt: -1 });
s.index({ user: 1, read: 1 });
s.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // auto-delete after 90 days
export default mongoose.model('Notification', s);
