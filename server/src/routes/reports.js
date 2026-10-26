import { Router } from 'express';
import Report from '../models/Report.js';
import CommunityMessage from '../models/CommunityMessage.js';
import Gig from '../models/Gig.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import { auth, needOnboarded, limit } from '../middleware/auth.js';
import { LIMITS } from '../config.js';
import { notify } from '../services/notify.js';
import { HttpError, isId, oneLine } from '../utils.js';
const r = Router();
const REASONS = ['scam', 'fake_gig', 'time_waster', 'harassment', 'spam', 'other'];

r.post('/', auth(), needOnboarded, limit(3600e3, 10, 'Too many reports. Try again later.'), async (req, res) => {
  const me = req.user;
  const { targetType, target, reason } = req.body;
  if (!['user', 'gig', 'message', 'community'].includes(targetType) || !isId(target)) throw new HttpError(400, 'Invalid report');
  if (!REASONS.includes(reason)) throw new HttpError(400, 'Choose a reason');
  let offender, snippet = '', context = [];
  if (targetType === 'user') {
    offender = target;
  } else if (targetType === 'gig') {
    const g = await Gig.findById(target).select('owner title').lean();
    if (!g) throw new HttpError(404, 'Gig not found');
    offender = g.owner; snippet = g.title;
  } else if (targetType === 'community') {
    // you can only report messages you can see: your own community
    const cm = await CommunityMessage.findById(target).lean();
    const myRoom = me.role === 'client' ? 'clients' : me.role === 'freelancer' ? 'freelancers' : null;
    if (!cm || cm.room !== myRoom) throw new HttpError(404, 'Message not found');
    offender = cm.from; snippet = cm.text.slice(0, 300);
    await CommunityMessage.updateOne({ _id: cm._id }, { flagged: true });
  } else {
    // you can only report a message from a conversation you are part of: nobody else can read it
    const m = await Message.findById(target).lean();
    if (!m || !(await Conversation.exists({ _id: m.conversation, participants: me._id }))) throw new HttpError(404, 'Message not found');
    offender = m.from; snippet = m.text.slice(0, 300);
    // the admin also sees up to 4 earlier messages so the report can be judged fairly
    const before = await Message.find({ conversation: m.conversation, system: false, createdAt: { $lt: m.createdAt } }).sort({ createdAt: -1 }).limit(4).lean();
    context = before.reverse().map((x) => ({ who: String(x.from) === String(me._id) ? 'reporter' : 'other', text: x.text.slice(0, 300), at: x.createdAt }));
    await Message.updateOne({ _id: m._id }, { flagged: true, flagReason: `Reported by a user: ${reason}`, reviewed: false });
  }
  if (String(offender) === String(me._id)) throw new HttpError(400, 'You cannot report yourself');
  if (!(await User.exists({ _id: offender }))) throw new HttpError(404, 'User not found');
  try {
    await Report.create({ reporter: me._id, targetType, target, offender, reason, details: oneLine(req.body.details, 500), snippet, context });
  } catch (e) { if (e.code === 11000) throw new HttpError(409, 'You already reported this.'); throw e; }

  // Several different people reporting the same account triggers a temporary restriction until an admin reviews it.
  const reporters = await Report.distinct('reporter', { offender, status: 'open' });
  if (reporters.length >= LIMITS.reportsToRestrict) {
    const u = await User.findById(offender);
    if (u && u.role !== 'admin' && !(u.restrictedUntil > new Date())) {
      u.restrictedUntil = new Date(Date.now() + LIMITS.reportRestrictDays * 864e5);
      u.restrictionReason = 'Your account is under review after multiple reports.';
      await u.save();
      await notify(req.app, u._id, { type: 'restriction', title: 'Your account is under review', body: u.restrictionReason, link: '/dashboard' });
    }
  }
  if (targetType === 'gig' && (await Report.distinct('reporter', { target, status: 'open' })).length >= 2) await Gig.updateOne({ _id: target, status: 'open' }, { status: 'pending_review' });
  res.status(201).json({ ok: true });
});
export default r;
