import mongoose from 'mongoose';
const s = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true }, contentType: String, data: Buffer }, { timestamps: true });
export default mongoose.model('Avatar', s);
