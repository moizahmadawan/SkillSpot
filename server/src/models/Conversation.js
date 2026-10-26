import mongoose from 'mongoose';
const { Schema } = mongoose;
// One conversation per client/freelancer pair. Only these two participants can read or write it.
const s = new Schema({
  key: { type: String, unique: true, required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  client: { type: Schema.Types.ObjectId, ref: 'User' },
  freelancer: { type: Schema.Types.ObjectId, ref: 'User' },
  starter: { type: Schema.Types.ObjectId, ref: 'User' },
  lastMessage: { text: String, from: Schema.Types.ObjectId, at: Date },
  unread: { type: Map, of: Number, default: {} },
}, { timestamps: true });
s.index({ participants: 1, updatedAt: -1 });
s.index({ starter: 1, createdAt: -1 });
export default mongoose.model('Conversation', s);
