import { Router } from 'express';
import User from '../models/User.js';
import Gig from '../models/Gig.js';
import Booking from '../models/Booking.js';
import Message from '../models/Message.js';
import Report from '../models/Report.js';
import Payment from '../models/Payment.js';
import Service from '../models/Service.js';
import Proposal from '../models/Proposal.js';
import CommunityMessage from '../models/CommunityMessage.js';
import { auth, adminOnly } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { assessRisk } from '../services/risk.js';
import { shapeCm } from './community.js';
import { HttpError, isId, escapeRegex, oneLine, pageParams } from '../utils.js';
const r = Router();
r.use(auth(), adminOnly);
const MEMBER = { role: { $in: ['client', 'freelancer'] }, onboarded: true };
const SAFE = '-blocked -tokenVersion -passwordHash';
// One small aggregation per total (works the same on every MongoDB-compatible database).
const sumOf = async (match, field) => (await Payment.aggregate([{ $match: match }, { $group: { _id: null, v: { $sum: `$${field}` } } }]))[0]?.v || 0;
const need = async (id) => { if (!isId(id)) throw new HttpError(404, 'Not found'); const u = await User.findOne({ _id: id, role: { $in: ['client', 'freelancer'] } }); if (!u) throw new HttpError(404, 'User not found'); return u; };

// ---------- overview ----------
r.get('/stats', async (_, res) => {
  const [users, clients, freelancers, verified, pendingAccounts, pendingVerification, gigs, openGigs, flaggedGigs, openReports, flaggedMsgs, bookings, volume, commissionReceived] = await Promise.all([
    User.countDocuments(MEMBER), User.countDocuments({ ...MEMBER, role: 'client' }), User.countDocuments({ ...MEMBER, role: 'freelancer' }), User.countDocuments({ role: 'freelancer', verified: true }),
    User.countDocuments({ ...MEMBER, accountStatus: 'pending' }), User.countDocuments({ ...MEMBER, role: 'freelancer', accountStatus: 'approved', verified: false }),
    Gig.countDocuments(), Gig.countDocuments({ status: 'open' }), Gig.countDocuments({ status: 'pending_review' }), Report.countDocuments({ status: 'open' }),
    Message.countDocuments({ flagged: true, reviewed: false }), Booking.countDocuments(),
    sumOf({ status: { $in: ['held', 'released'] } }, 'amount'), sumOf({ status: 'released' }, 'commission'),
  ]);
  res.json({ users, clients, freelancers, verified, pendingAccounts, pendingVerification, gigs, openGigs, flaggedGigs, openReports, flaggedMsgs, bookings, volume, commissionReceived });
});

// ---------- users ----------
r.get('/users', async (req, res) => {
  const { limit, skip } = pageParams(req.query, 30, 100);
  const f = { ...MEMBER };
  if (['client', 'freelancer'].includes(req.query.role)) f.role = req.query.role;
  const st = req.query.status;
  if (['pending', 'approved', 'rejected'].includes(st)) f.accountStatus = st;
  if (st === 'banned') f.banned = true;
  if (st === 'restricted') f.restrictedUntil = { $gt: new Date() };
  const v = req.query.verification;
  if (v === 'pending') Object.assign(f, { role: 'freelancer', accountStatus: 'approved', verified: false, 'verification.status': { $nin: ['needs_changes', 'revoked'] } });
  if (v === 'verified') Object.assign(f, { role: 'freelancer', verified: true });
  if (v === 'needs_changes') Object.assign(f, { role: 'freelancer', 'verification.status': 'needs_changes' });
  if (req.query.q) { const re = new RegExp(escapeRegex(String(req.query.q).slice(0, 40)), 'i'); f.$or = [{ name: re }, { phone: re }, { city: re }]; }
  const rows = await User.find(f).select(SAFE).sort('-createdAt').skip(skip).limit(limit + 1).lean();
  res.json({ items: rows.slice(0, limit), hasMore: rows.length > limit });
});

// Everything the admin needs to judge one user: info, location check, spending / earnings, commission, tax and fraud signals.
r.get('/users/:id/detail', async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const u = await User.findOne({ _id: req.params.id, role: { $in: ['client', 'freelancer'] } }).select(SAFE).lean();
  if (!u) throw new HttpError(404, 'User not found');
  const pays = await Payment.find({ $or: [{ client: u._id }, { freelancer: u._id }] }).sort('-createdAt').limit(500).populate('client freelancer', 'name').lean();
  const sum = (arr, k) => arr.reduce((n, p) => n + (p[k] || 0), 0);
  const asClient = pays.filter((p) => String(p.client._id) === String(u._id)), asFreelancer = pays.filter((p) => String(p.freelancer._id) === String(u._id));
  const paid = asClient.filter((p) => ['held', 'released'].includes(p.status)), relF = asFreelancer.filter((p) => p.status === 'released');
  const taxWithheld = sum(relF, 'tax'), taxPaid = sum(relF.filter((p) => p.taxPaid), 'tax');
  const finance = {
    spent: sum(paid, 'amount'), refunded: sum(asClient.filter((p) => p.status === 'refunded'), 'amount'), orders: asClient.length,
    earned: sum(relF, 'freelancerNet'), inEscrow: sum(asFreelancer.filter((p) => p.status === 'held'), 'freelancerNet'), commissionGenerated: sum(relF, 'commission'), taxWithheld, taxPaid, taxUnpaid: taxWithheld - taxPaid, jobsPaid: relF.length,
  };
  const [risk, reports] = await Promise.all([assessRisk(u), Report.find({ offender: u._id }).sort('-createdAt').limit(10).populate('reporter', 'name').lean()]);
  res.json({ user: u, risk, finance, payments: pays.slice(0, 10), reports });
});

r.post('/users/:id/approve', async (req, res) => {
  const u = await need(req.params.id);
  u.accountStatus = 'approved'; u.accountNote = undefined; u.approvedLat = u.location?.coordinates?.[1]; u.approvedLng = u.location?.coordinates?.[0];
  if (req.body.verify && u.role === 'freelancer') { u.verified = true; u.verification = { ...(u.verification?.toObject?.() || {}), status: 'verified', notes: [], checkedAt: new Date() }; }
  await u.save();
  req.app.get('io')?.in(`user:${u._id}`).socketsJoin(`community:${u.role === 'client' ? 'clients' : 'freelancers'}`);
  await notify(req.app, u._id, { type: 'account_approved', title: 'Your account is approved', body: 'Your location was checked. You can now post, apply, hire, chat and use the community.', link: '/dashboard' });
  res.json({ ok: true });
});
r.post('/users/:id/reject', async (req, res) => {
  const u = await need(req.params.id);
  const reason = oneLine(req.body.reason, 200) || 'Your location could not be confirmed.';
  u.accountStatus = 'rejected'; u.accountNote = reason; await u.save();
  await notify(req.app, u._id, { type: 'account_rejected', title: 'Your account was not approved', body: `${reason} Share your correct location in Settings to ask for a new check.`, link: '/settings' });
  res.json({ ok: true });
});
r.post('/users/:id/verification', async (req, res) => {
  const u = await need(req.params.id);
  if (u.role !== 'freelancer') throw new HttpError(400, 'Only freelancers can be verified');
  const ok = !!req.body.verified;
  u.verified = ok;
  u.verification = { ...(u.verification?.toObject?.() || {}), status: ok ? 'verified' : 'revoked', notes: ok ? [] : [oneLine(req.body.note, 200) || 'Verification was removed by the safety team.'], checkedAt: new Date() };
  await u.save();
  await notify(req.app, u._id, { type: 'verification', title: ok ? 'Your profile is verified' : 'Your verification was removed', body: ok ? 'A Verified badge now shows on your profile.' : u.verification.notes[0], link: '/settings' });
  res.json({ ok: true });
});
async function setBan(app, u, banned) {
  u.banned = banned; if (banned) u.tokenVersion = (u.tokenVersion || 0) + 1;
  await u.save();
  if (banned) {
    await Service.updateMany({ freelancer: u._id }, { active: false });
    await Gig.updateMany({ owner: u._id, status: { $in: ['open', 'pending_review'] } }, { status: 'removed', removedReason: 'The owner account was blocked' });
    app.get('io')?.in(`user:${u._id}`).disconnectSockets(true);
  }
}
r.post('/users/:id/ban', async (req, res) => { await setBan(req.app, await need(req.params.id), !!req.body.banned); res.json({ ok: true }); });
r.post('/users/:id/restriction', async (req, res) => {
  const u = await need(req.params.id);
  if (req.body.clear) { u.restrictedUntil = undefined; u.restrictionReason = undefined; }
  else { u.restrictedUntil = new Date(Date.now() + Math.min(90, Math.max(1, +req.body.days || 7)) * 864e5); u.restrictionReason = oneLine(req.body.reason, 200) || 'Restricted by the SkillSpot safety team.'; await notify(req.app, u._id, { type: 'restriction', title: 'Your account is temporarily restricted', body: u.restrictionReason, link: '/dashboard' }); }
  await u.save(); res.json({ ok: true });
});
r.post('/users/:id/note', async (req, res) => { const u = await need(req.params.id); u.adminNote = oneLine(req.body.note, 500); await u.save(); res.json({ ok: true }); });

// ---------- gigs ----------
r.get('/gigs', async (req, res) => {
  const { limit, skip } = pageParams(req.query, 30, 100);
  const f = {};
  if (req.query.status) f.status = String(req.query.status);
  if (req.query.q) { const re = new RegExp(escapeRegex(String(req.query.q).slice(0, 40)), 'i'); f.$or = [{ title: re }, { description: re }]; }
  const rows = await Gig.find(f).sort('-createdAt').skip(skip).limit(limit + 1).populate('owner', 'name phone city').lean();
  res.json({ items: rows.slice(0, limit), hasMore: rows.length > limit });
});
r.post('/gigs/:id/approve', async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const g = await Gig.findByIdAndUpdate(req.params.id, { status: 'open' });
  if (g) await notify(req.app, g.owner, { type: 'gig_review', title: 'Your gig was approved', body: `"${g.title}" is live.`, link: `/gigs/${g._id}` });
  res.json({ ok: true });
});
r.post('/gigs/:id/remove', async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const reason = oneLine(req.body.reason, 200) || 'It does not follow the SkillSpot rules.';
  const g = await Gig.findById(req.params.id);
  if (!g) throw new HttpError(404, 'Not found');
  g.status = 'removed'; g.removedReason = reason; await g.save();
  const props = await Proposal.find({ gig: g._id, status: 'pending' });
  await Proposal.updateMany({ gig: g._id, status: 'pending' }, { status: 'rejected' });
  for (const p of props) await notify(req.app, p.freelancer, { type: 'proposal_rejected', title: 'A job you applied to was removed', body: `"${g.title}"`, link: '/proposals' });
  await Booking.updateMany({ gig: g._id, status: 'requested' }, { status: 'cancelled', cancelledBy: 'client', respondedAt: new Date() });
  await notify(req.app, g.owner, { type: 'gig_removed', title: 'Your gig was removed', body: `"${g.title}": ${reason}`, link: '/dashboard' });
  res.json({ ok: true });
});

// ---------- reports and flagged chat ----------
r.get('/reports', async (req, res) => {
  const f = req.query.status === 'all' ? {} : { status: 'open' };
  res.json(await Report.find(f).sort('-createdAt').limit(100).populate('reporter offender', 'name phone role banned').lean());
});
r.post('/reports/:id/resolve', async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const rep = await Report.findById(req.params.id);
  if (!rep) throw new HttpError(404, 'Not found');
  const action = req.body.action;
  if (!['dismiss', 'restrict', 'ban', 'remove'].includes(action)) throw new HttpError(400, 'Invalid action');
  rep.status = action === 'dismiss' ? 'dismissed' : 'actioned'; await rep.save();
  await Report.updateMany({ offender: rep.offender, status: 'open' }, { status: rep.status });
  const u = await User.findById(rep.offender);
  if (u && u.role !== 'admin') {
    if (action === 'ban') await setBan(req.app, u, true);
    else if (action === 'restrict') { u.restrictedUntil = new Date(Date.now() + 7 * 864e5); u.restrictionReason = 'Restricted by the SkillSpot safety team after a report.'; await u.save(); await notify(req.app, u._id, { type: 'restriction', title: 'Your account is temporarily restricted', body: u.restrictionReason, link: '/dashboard' }); }
    else if (action === 'dismiss' && u.restrictionReason?.includes('multiple reports')) { u.restrictedUntil = undefined; u.restrictionReason = undefined; await u.save(); }
  }
  if (action === 'remove') {
    if (rep.targetType === 'gig') await Gig.updateOne({ _id: rep.target }, { status: 'removed', removedReason: 'Removed after a report' });
    if (rep.targetType === 'community') { const m = await CommunityMessage.findByIdAndUpdate(rep.target, { deleted: true }); if (m) req.app.get('io')?.to(`community:${m.room}`).emit('community_deleted', { _id: String(m._id), room: m.room }); }
  }
  res.json({ ok: true });
});
r.get('/flagged-messages', async (_, res) => res.json(await Message.find({ flagged: true, reviewed: false }).sort('-createdAt').limit(50).populate('from to', 'name').lean()));
r.post('/messages/:id/review', async (req, res) => { if (!isId(req.params.id)) throw new HttpError(404, 'Not found'); await Message.updateOne({ _id: req.params.id }, { reviewed: true }); res.json({ ok: true }); });

// ---------- finance ----------
r.get('/payments', async (req, res) => {
  const { limit, skip } = pageParams(req.query, 30, 100);
  const f = {};
  if (req.query.status) f.status = String(req.query.status);
  const rows = await Payment.find(f).sort('-createdAt').skip(skip).limit(limit + 1).populate('client freelancer', 'name phone').lean();
  res.json({ items: rows.slice(0, limit), hasMore: rows.length > limit });
});
r.post('/payments/:id/tax-paid', async (req, res) => { if (!isId(req.params.id)) throw new HttpError(404, 'Not found'); await Payment.updateOne({ _id: req.params.id }, { taxPaid: !!req.body.paid }); res.json({ ok: true }); });
r.get('/finance/summary', async (_, res) => {
  const top = (match, key, as, field) => Payment.aggregate([{ $match: match }, { $group: { _id: `$${key}`, [as]: { $sum: `$${field}` } } }, { $sort: { [as]: -1 } }, { $limit: 5 }]);
  const [inEscrow, released, refunded, commissionReceived, commissionPending, taxPaid, taxUnpaid, paidToFreelancers, jobsPaid, topEarners, topSpenders] = await Promise.all([
    sumOf({ status: 'held' }, 'amount'), sumOf({ status: 'released' }, 'amount'), sumOf({ status: 'refunded' }, 'amount'),
    sumOf({ status: 'released' }, 'commission'), sumOf({ status: 'held' }, 'commission'),
    sumOf({ status: 'released', taxPaid: true }, 'tax'), sumOf({ status: 'released', taxPaid: { $ne: true } }, 'tax'),
    sumOf({ status: 'released' }, 'freelancerNet'), Payment.countDocuments({ status: 'released' }),
    top({ status: 'released' }, 'freelancer', 'earned', 'freelancerNet'), top({ status: { $in: ['held', 'released'] } }, 'client', 'spent', 'amount'),
  ]);
  const names = Object.fromEntries((await User.find({ _id: { $in: [...topEarners, ...topSpenders].map((x) => x._id) } }).select('name').lean()).map((u) => [String(u._id), u.name]));
  res.json({
    volume: inEscrow + released, released, inEscrow, refunded, commissionReceived, commissionPending, taxWithheld: taxPaid + taxUnpaid, taxPaid, taxUnpaid, paidToFreelancers, jobsPaid,
    topEarners: topEarners.map((x) => ({ _id: x._id, name: names[String(x._id)], earned: x.earned })), topSpenders: topSpenders.map((x) => ({ _id: x._id, name: names[String(x._id)], spent: x.spent })),
  });
});

// ---------- community moderation ----------
r.get('/community/:room', async (req, res) => {
  if (!['clients', 'freelancers'].includes(req.params.room)) throw new HttpError(404, 'Not found');
  const q = { room: req.params.room };
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && !isNaN(before)) q.createdAt = { $lt: before };
  const rows = await CommunityMessage.find(q).sort({ createdAt: -1 }).limit(51).populate('from', 'name avatarVersion verified role banned').lean();
  res.json({ items: rows.slice(0, 50).map((m) => ({ ...shapeCm(m), text: m.text, flagged: !!m.flagged })), hasMore: rows.length > 50 });
});
r.delete('/community/messages/:id', async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const m = await CommunityMessage.findByIdAndUpdate(req.params.id, { deleted: true });
  if (!m) throw new HttpError(404, 'Not found');
  req.app.get('io')?.to(`community:${m.room}`).emit('community_deleted', { _id: String(m._id), room: m.room });
  res.json({ ok: true });
});
export default r;
