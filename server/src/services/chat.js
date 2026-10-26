import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { HttpError, assertCanAct, assertApproved } from '../utils.js';
import { LIMITS } from '../config.js';
import { screenText, redactContacts } from './safety.js';

export const toMsg = (m) => ({ _id: String(m._id), conversation: String(m.conversation), from: String(m.from), to: String(m.to), text: m.text, system: !!m.system, readAt: m.readAt || null, createdAt: m.createdAt });

// Simple per-user flood control (max 15 messages / 10 seconds).
const buckets = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (!v.some((t) => now - t < 10000)) buckets.delete(k); }, 60000).unref();
function rateOk(uid) {
  const now = Date.now();
  const arr = (buckets.get(uid) || []).filter((t) => now - t < 10000);
  if (arr.length >= 15) return false;
  arr.push(now); buckets.set(uid, arr);
  return true;
}

export async function getOrCreateConversation(starterId, client, freelancer) {
  const key = [String(client._id), String(freelancer._id)].sort().join('_');
  let conv = await Conversation.findOne({ key });
  if (conv) return { conv, created: false };
  try {
    conv = await Conversation.create({ key, participants: [client._id, freelancer._id], client: client._id, freelancer: freelancer._id, starter: starterId });
    return { conv, created: true };
  } catch (e) {
    if (e.code === 11000) return { conv: await Conversation.findOne({ key }), created: false };
    throw e;
  }
}

async function deliver(app, conv, msg, fromId, toId) {
  await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessage: { text: msg.text.slice(0, 120), from: fromId, at: msg.createdAt } }, $inc: { [`unread.${toId}`]: 1 } });
  const payload = toMsg(msg);
  // Only the two participants' private rooms receive the message.
  app.get('io')?.to(`user:${toId}`).to(`user:${fromId}`).emit('message', payload);
  return payload;
}

export async function postSystemMessage(app, conv, fromId, toId, text) {
  const msg = await Message.create({ conversation: conv._id, from: fromId, to: toId, text, system: true });
  return deliver(app, conv, msg, fromId, toId);
}

export async function sendMessage(app, user, conversationId, rawText) {
  const text = String(rawText ?? '').trim();
  if (!text) throw new HttpError(400, 'Write a message first');
  if (text.length > LIMITS.msgMax) throw new HttpError(400, `Messages can be up to ${LIMITS.msgMax} characters`);
  if (!rateOk(String(user._id))) throw new HttpError(429, 'You are sending messages too fast. Please wait a few seconds.');
  assertCanAct(user);
  assertApproved(user);
  const conv = await Conversation.findOne({ _id: conversationId, participants: user._id });
  if (!conv) throw new HttpError(404, 'Conversation not found');
  const otherId = conv.participants.find((p) => String(p) !== String(user._id));
  const other = await User.findById(otherId).select('blocked banned deactivated accountStatus').lean();
  if (!other || other.banned || other.deactivated || other.accountStatus !== 'approved') throw new HttpError(403, 'This user is not available');
  if ((other.blocked || []).some((b) => String(b) === String(user._id)) || (user.blocked || []).some((b) => String(b) === String(otherId))) throw new HttpError(403, 'You cannot message this user');

  const scan = await screenText(text);
  if (scan.score >= 70) throw new HttpError(422, 'This message looks like a scam attempt and was not sent. Never ask for advance payments or share OTP or CNIC details.', 'BLOCKED_SCAM');
  // Phone numbers and links stay hidden until the two users have an accepted job together.
  const trusted = await Booking.exists({ client: conv.client, freelancer: conv.freelancer, status: 'accepted' });
  const { text: clean, hidden } = trusted ? { text, hidden: false } : redactContacts(text);
  const msg = await Message.create({ conversation: conv._id, from: user._id, to: otherId, text: clean, flagged: scan.flagged, flagReason: scan.reason });
  const payload = await deliver(app, conv, msg, user._id, otherId);
  return { message: payload, warning: hidden ? 'Phone numbers and links are hidden until a hire request is accepted. Keep payments inside SkillSpot.' : undefined };
}
