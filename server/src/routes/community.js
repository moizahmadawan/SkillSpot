import { Router } from 'express';
import CommunityMessage from '../models/CommunityMessage.js';
import User from '../models/User.js';
import { auth, needOnboarded, needApproved, needRole, limit } from '../middleware/auth.js';
import { MARKET } from '../config.js';
import { screenText, redactContacts } from '../services/safety.js';
import { HttpError, isId, multiLine } from '../utils.js';
const r = Router();
export const roomOf = (u) => (u.role === 'client' ? 'clients' : u.role === 'freelancer' ? 'freelancers' : null);
export const shape = (m) => {
  const o = m.toObject ? m.toObject() : m;
  const f = o.from && o.from._id ? { _id: String(o.from._id), name: o.from.name, avatarVersion: o.from.avatarVersion, verified: !!o.from.verified, role: o.from.role } : { _id: String(o.from) };
  return { _id: String(o._id), room: o.room, text: o.deleted ? '' : o.text, deleted: !!o.deleted, createdAt: o.createdAt, from: f };
};
export { shape as shapeCm };
const PEOPLE = 'name avatarVersion verified role';

// Two separate group chats: clients only talk with clients, freelancers only with freelancers.
r.use(auth(), needOnboarded, needRole('client', 'freelancer'));
r.get('/info', needApproved, async (req, res) => {
  const room = roomOf(req.user);
  const members = await User.countDocuments({ role: req.user.role, accountStatus: 'approved', banned: false, deactivated: { $ne: true } });
  res.json({ room, title: room === 'clients' ? 'Clients community' : 'Freelancers community', description: room === 'clients' ? 'Talk with other clients: hiring tips, budgets and good experiences.' : 'Talk with other freelancers: pricing, tools, tips and local work.', members });
});
r.get('/messages', needApproved, async (req, res) => {
  const q = { room: roomOf(req.user) };
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && !isNaN(before)) q.createdAt = { $lt: before };
  const rows = await CommunityMessage.find(q).sort({ createdAt: -1 }).limit(31).populate('from', PEOPLE).lean();
  res.json({ items: rows.slice(0, 30).reverse().map(shape), hasMore: rows.length > 30 });
});
r.post('/messages', needApproved, limit(60e3, MARKET.communityPerMinute, 'You are posting too fast. Please wait a moment.'), async (req, res) => {
  const room = roomOf(req.user), text = multiLine(req.body.text, MARKET.communityMax);
  if (!text) throw new HttpError(400, 'Write a message first');
  const scan = await screenText(text);
  if (scan.score >= 70) throw new HttpError(422, 'This message looks like a scam and was not posted. Never ask for advance payments or OTP/CNIC details.', 'BLOCKED_SCAM');
  const { text: clean, hidden } = redactContacts(text); // phone numbers and links are always hidden in a public group
  const m = await CommunityMessage.create({ room, from: req.user._id, text: clean, flagged: scan.flagged });
  const full = shape(await CommunityMessage.findById(m._id).populate('from', PEOPLE));
  req.app.get('io')?.to(`community:${room}`).emit('community_message', full);
  res.status(201).json({ message: full, warning: hidden ? 'Phone numbers and links are hidden in the community for everyone’s safety.' : undefined });
});
r.delete('/messages/:id', async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const m = await CommunityMessage.findOneAndUpdate({ _id: req.params.id, from: req.user._id, room: roomOf(req.user) }, { deleted: true });
  if (!m) throw new HttpError(404, 'Not found');
  req.app.get('io')?.to(`community:${m.room}`).emit('community_deleted', { _id: String(m._id), room: m.room });
  res.json({ ok: true });
});
export default r;
