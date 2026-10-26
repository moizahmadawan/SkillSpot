import mongoose from 'mongoose';
const { Schema } = mongoose;
const s = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 2000 },
  system: { type: Boolean, default: false },
  flagged: { type: Boolean, default: false },
  flagReason: String,
  reviewed: { type: Boolean, default: false },
  readAt: Date,
}, { timestamps: true });
s.index({ conversation: 1, createdAt: -1 });
s.index({ to: 1, readAt: 1 });
s.index({ flagged: 1, reviewed: 1, createdAt: -1 });
export default mongoose.model('Message', s);
