import { Router } from 'express';
import Proposal from '../models/Proposal.js';
import Gig from '../models/Gig.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { auth, needRole, needOnboarded, needApproved, limit } from '../middleware/auth.js';
import { LIMITS, MARKET } from '../config.js';
import { screenText, redactContacts } from '../services/safety.js';
import { notify } from '../services/notify.js';
import { acceptBooking } from '../services/bookingFlow.js';
import { getOrCreateConversation, postSystemMessage } from '../services/chat.js';
import { HttpError, isId, multiLine, publicUser, assertCanAct } from '../utils.js';
const r = Router();
const FREELANCER = 'name avatarVersion city verified verification.status rating reviewCount stats bio skills hourlyRate role experienceYears available location';

// Freelancer applies to an open gig (Upwork-style proposal). Phone numbers and links in the text are always hidden.
r.post('/gig/:gigId', auth(), needRole('freelancer'), needOnboarded, needApproved, limit(3600e3, 40), async (req, res) => {
  assertCanAct(req.user);
  if (!isId(req.params.gigId)) throw new HttpError(404, 'Job not found');
  const gig = await Gig.findOne({ _id: req.params.gigId, status: 'open' });
  if (!gig) throw new HttpError(404, 'This job is not open any more');
  if (String(gig.owner) === String(req.user._id)) throw new HttpError(400, 'You cannot apply to your own job');
  const coverLetter = multiLine(req.body.coverLetter, 1500);
  if (coverLetter.length < 20) throw new HttpError(400, 'Write a cover letter of at least 20 characters');
  const price = Math.round(Number(req.body.price)), days = Math.round(Number(req.body.days) || 3);
  if (!(price >= LIMITS.minBudget && price <= LIMITS.maxBudget)) throw new HttpError(400, `Your price must be between Rs ${LIMITS.minBudget} and Rs ${LIMITS.maxBudget.toLocaleString()}`);
  if (days < 1 || days > 365) throw new HttpError(400, 'Delivery time must be 1 to 365 days');
  if ((await screenText(coverLetter)).score >= 70) throw new HttpError(422, 'This proposal looks like a scam (advance payment or OTP/CNIC requests). Please rewrite it.', 'BLOCKED_SCAM');
  const today = await Proposal.countDocuments({ freelancer: req.user._id, createdAt: { $gte: new Date(Date.now() - 864e5) } });
  if (today >= MARKET.proposalsPerDay) throw new HttpError(429, `You can send up to ${MARKET.proposalsPerDay} proposals per day.`, 'PROPOSAL_LIMIT');
  const { text } = redactContacts(coverLetter);
  let p = await Proposal.findOne({ gig: gig._id, freelancer: req.user._id });
  if (p && p.status !== 'withdrawn') throw new HttpError(409, 'You already applied to this job.');
  if (p) { Object.assign(p, { coverLetter: text, price, days, status: 'pending' }); await p.save(); }
  else { try { p = await Proposal.create({ gig: gig._id, freelancer: req.user._id, coverLetter: text, price, days }); } catch (e) { if (e.code === 11000) throw new HttpError(409, 'You already applied to this job.'); throw e; } }
  await Gig.updateOne({ _id: gig._id }, { $inc: { proposalCount: 1 } });
  await notify(req.app, gig.owner, { type: 'proposal_received', title: `${req.user.name || 'A freelancer'} sent a proposal`, body: `"${gig.title}": Rs ${price.toLocaleString()} in ${days} day(s).`, link: `/gigs/${gig._id}` });
  res.status(201).json(p);
});

// Client sees the proposals on their own gig
r.get('/gig/:gigId', auth(), needRole('client'), needOnboarded, async (req, res) => {
  if (!isId(req.params.gigId)) throw new HttpError(404, 'Not found');
  const gig = await Gig.findOne({ _id: req.params.gigId, owner: req.user._id }).select('_id').lean();
  if (!gig) throw new HttpError(404, 'Not found');
  const rows = await Proposal.find({ gig: gig._id }).sort('-createdAt').limit(100).populate('freelancer', FREELANCER).lean();
  res.json(rows.filter((p) => p.freelancer).map((p) => ({ _id: p._id, coverLetter: p.coverLetter, price: p.price, days: p.days, status: p.status, createdAt: p.createdAt, freelancer: publicUser(p.freelancer) })));
});

r.get('/mine', auth(), needRole('freelancer'), async (req, res) => {
  const rows = await Proposal.find({ freelancer: req.user._id }).sort('-createdAt').limit(100).populate('gig', 'title budget status city').lean();
  res.json(rows.map((p) => ({ _id: p._id, coverLetter: p.coverLetter, price: p.price, days: p.days, status: p.status, createdAt: p.createdAt, gig: p.gig ? { _id: p.gig._id, title: p.gig.title, budget: p.gig.budget, status: p.gig.status, city: p.gig.city } : null })));
});

r.delete('/:id', auth(), needRole('freelancer'), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const p = await Proposal.findOne({ _id: req.params.id, freelancer: req.user._id });
  if (!p) throw new HttpError(404, 'Not found');
  if (p.status !== 'pending') throw new HttpError(409, `A ${p.status} proposal cannot be withdrawn.`);
  p.status = 'withdrawn'; await p.save();
  await Gig.updateOne({ _id: p.gig, proposalCount: { $gt: 0 } }, { $inc: { proposalCount: -1 } });
  res.json({ ok: true });
});

// Client hires from a proposal: the freelancer already agreed by applying, so the job starts accepted and awaits payment.
r.post('/:id/hire', auth(), needRole('client'), needOnboarded, needApproved, limit(3600e3, 30), async (req, res) => {
  const me = req.user;
  assertCanAct(me);
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const prop = await Proposal.findById(req.params.id);
  const gig = prop && await Gig.findOne({ _id: prop.gig, owner: me._id });
  if (!prop || !gig) throw new HttpError(404, 'Not found');
  if (prop.status !== 'pending' || gig.status !== 'open') throw new HttpError(409, 'This proposal is no longer available.');
  const f = await User.findById(prop.freelancer);
  if (!f || f.role !== 'freelancer' || f.accountStatus !== 'approved' || f.banned || f.deactivated) throw new HttpError(404, 'This freelancer is not available');
  if ((f.blocked || []).some((x) => String(x) === String(me._id)) || (me.blocked || []).some((x) => String(x) === String(f._id))) throw new HttpError(403, 'You cannot hire this user');
  const booking = await Booking.create({ gig: gig._id, client: me._id, freelancer: f._id, price: prop.price, days: prop.days, title: gig.title, kind: 'proposal', note: 'Hired from proposal' });
  const payment = await acceptBooking(req.app, booking, { who: me.name, notifyClient: false });
  const { conv } = await getOrCreateConversation(me._id, me, f);
  await postSystemMessage(req.app, conv, me._id, f._id, `You were hired for "${gig.title}" at Rs ${prop.price.toLocaleString()}. The client will pay securely in SkillSpot.`);
  await notify(req.app, f._id, { type: 'proposal_accepted', title: `You got the job: ${gig.title}`, body: `${me.name || 'The client'} hired you for Rs ${prop.price.toLocaleString()}. Wait for the secured payment, then start.`, link: '/bookings' });
  res.status(201).json({ booking, payment });
});
export default r;
