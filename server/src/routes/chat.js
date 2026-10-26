import { Router } from 'express';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { auth, needOnboarded, limit } from '../middleware/auth.js';
import { LIMITS } from '../config.js';
import { getOrCreateConversation, sendMessage, toMsg } from '../services/chat.js';
import { HttpError, isId, assertCanAct } from '../utils.js';
const r = Router();
r.use(auth(), needOnboarded);

const PEOPLE = 'name avatarVersion verified role city';
const shape = (c, me) => {
  const other = String(c.client?._id) === String(me) ? c.freelancer : c.client;
  return { _id: String(c._id), other, lastMessage: c.lastMessage || null, unread: (c.unread || {})[String(me)] || 0, updatedAt: c.updatedAt };
};
const mine = (id, me) => isId(id) ? Conversation.exists({ _id: id, participants: me }) : null;

r.get('/conversations', async (req, res) => {
  const me = req.user._id;
  const q = { participants: me };
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && !isNaN(before)) q.updatedAt = { $lt: before };
  const rows = await Conversation.find(q).sort({ updatedAt: -1 }).limit(41).populate('client freelancer', PEOPLE).lean();
  res.json({ items: rows.slice(0, 40).filter((c) => c.client && c.freelancer).map((c) => shape(c, me)), hasMore: rows.length > 40 });
});

r.get('/conversations/:id', async (req, res) => {
  const me = req.user._id;
  if (!isId(req.params.id)) throw new HttpError(404, 'Conversation not found');
  const c = await Conversation.findOne({ _id: req.params.id, participants: me }).populate('client freelancer', PEOPLE).lean();
  if (!c || !c.client || !c.freelancer) throw new HttpError(404, 'Conversation not found');
  res.json(shape(c, me));
});

// Start (or open) a conversation. Only client <-> freelancer, never client <-> client.
r.post('/conversations', async (req, res) => {
  const me = req.user;
  const { userId } = req.body;
  if (!isId(userId) || String(userId) === String(me._id)) throw new HttpError(400, 'Invalid user');
  const other = await User.findById(userId);
  if (!other || !other.onboarded || other.banned || other.deactivated) throw new HttpError(404, 'This user is not available');
  if (!['client', 'freelancer'].includes(me.role) || !['client', 'freelancer'].includes(other.role) || me.role === other.role)
    throw new HttpError(403, 'Chats are only between a client and a freelancer');
  if ((other.blocked || []).some((b) => String(b) === String(me._id)) || (me.blocked || []).some((b) => String(b) === String(other._id))) throw new HttpError(403, 'You cannot message this user');
  const [client, freelancer] = me.role === 'client' ? [me, other] : [other, me];
  const key = [String(client._id), String(freelancer._id)].sort().join('_');
  if (!(await Conversation.exists({ key }))) {
    assertCanAct(me);
    const today = await Conversation.countDocuments({ starter: me._id, createdAt: { $gte: new Date(Date.now() - 864e5) } });
    if (today >= LIMITS.newChatsPerDay) throw new HttpError(429, `You can start up to ${LIMITS.newChatsPerDay} new conversations per day.`, 'CHAT_LIMIT');
  }
  const { conv } = await getOrCreateConversation(me._id, client, freelancer);
  res.json({ _id: String(conv._id) });
});

r.get('/conversations/:id/messages', async (req, res) => {
  if (!(await mine(req.params.id, req.user._id))) throw new HttpError(404, 'Conversation not found');
  const q = { conversation: req.params.id };
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && !isNaN(before)) q.createdAt = { $lt: before };
  const rows = await Message.find(q).sort({ createdAt: -1 }).limit(31).lean();
  res.json({ items: rows.slice(0, 30).reverse().map(toMsg), hasMore: rows.length > 30 });
});

r.post('/conversations/:id/messages', limit(60e3, 40, 'You are sending messages too fast.'), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Conversation not found');
  res.status(201).json(await sendMessage(req.app, req.user, req.params.id, req.body.text));
});

r.post('/conversations/:id/read', async (req, res) => {
  const me = String(req.user._id);
  const conv = isId(req.params.id) ? await Conversation.findOne({ _id: req.params.id, participants: req.user._id }).select('participants').lean() : null;
  if (!conv) throw new HttpError(404, 'Conversation not found');
  const at = new Date();
  await Promise.all([
    Message.updateMany({ conversation: conv._id, to: req.user._id, readAt: null }, { readAt: at }),
    Conversation.updateOne({ _id: conv._id }, { $set: { [`unread.${me}`]: 0 } }, { timestamps: false }),
  ]);
  const otherId = conv.participants.find((p) => String(p) !== me);
  req.app.get('io')?.to(`user:${otherId}`).emit('read', { conversationId: String(conv._id), by: me, at });
  res.json({ ok: true });
});

r.get('/unread', async (req, res) => {
  const me = String(req.user._id);
  const rows = await Conversation.find({ participants: req.user._id }).select('unread').lean();
  res.json({ unread: rows.reduce((n, c) => n + ((c.unread || {})[me] || 0), 0) });
});
export default r;
