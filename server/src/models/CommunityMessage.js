import mongoose from 'mongoose';
const { Schema } = mongoose;
// Group chat. room "clients" is only for clients, room "freelancers" only for freelancers.
const s = new Schema({
  room: { type: String, enum: ['clients', 'freelancers'], required: true },
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 600 },
  deleted: { type: Boolean, default: false },
  flagged: { type: Boolean, default: false },
}, { timestamps: true });
s.index({ room: 1, createdAt: -1 });
export default mongoose.model('CommunityMessage', s);
