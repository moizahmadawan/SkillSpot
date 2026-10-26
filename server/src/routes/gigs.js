import { Router } from 'express';
import Gig from '../models/Gig.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { auth, needRole, needOnboarded, needApproved, limit } from '../middleware/auth.js';
import Proposal from '../models/Proposal.js';
import { reviewGig } from '../services/gigReview.js';
import { screenText } from '../services/safety.js';
import { checkGigAllowed, fingerprint } from '../services/abuse.js';
import { notify } from '../services/notify.js';
import { cityLocation, validCoords } from '../cities.js';
import { HttpError, isId, escapeRegex, oneLine, multiLine, pageParams, publicGig } from '../utils.js';
const r = Router();
const OWNER = 'name city avatarVersion stats';

r.get('/', async (req, res) => {
  const { q, category, city, minBudget, maxBudget } = req.query;
  const { limit: lim, skip } = pageParams(req.query);
  const f = { status: 'open' };
  if (category) f.category = String(category).slice(0, 40);
  if (city) f.city = new RegExp(`^${escapeRegex(String(city).slice(0, 60))}$`, 'i');
  if (+minBudget > 0 || +maxBudget > 0) { f.budget = {}; if (+minBudget > 0) f.budget.$gte = +minBudget; if (+maxBudget > 0) f.budget.$lte = +maxBudget; }
  const find = (filter) => Gig.find(filter).sort('-createdAt').skip(skip).limit(lim + 1).populate('owner', OWNER);
  let rows;
  if (q) {
    try { rows = await find({ ...f, $text: { $search: String(q).slice(0, 60) } }); }
    catch { const re = new RegExp(escapeRegex(String(q).slice(0, 60)), 'i'); rows = await find({ ...f, $or: [{ title: re }, { description: re }, { skills: re }] }); }
  } else rows = await find(f);
  res.json({ items: rows.slice(0, lim).map(publicGig), hasMore: rows.length > lim });
});

r.get('/mine', auth(), async (req, res) => {
  if (req.user.role !== 'client') return res.json([]);
  const rows = await Gig.find({ owner: req.user._id, status: { $ne: 'removed' } }).sort('-createdAt').limit(100);
  res.json(rows.map((g) => ({ ...publicGig(g), aiReview: g.aiReview, removedReason: g.removedReason })));
});

r.get('/:id', auth(false), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const g = await Gig.findOne({ _id: req.params.id, status: { $ne: 'removed' } }).populate('owner', OWNER);
  const own = g && req.user && String(g.owner._id) === String(req.user._id);
  if (!g || (!own && !['open', 'in_progress', 'completed'].includes(g.status))) throw new HttpError(404, 'Not found');
  res.json({ ...publicGig(g), ...(own ? { aiReview: g.aiReview, removedReason: g.removedReason } : {}) });
});

r.post('/', auth(), needRole('client'), needOnboarded, needApproved, limit(3600e3, 20), async (req, res) => {
  const title = oneLine(req.body.title, 120), description = multiLine(req.body.description, 3000);
  const category = oneLine(req.body.category, 40), city = oneLine(req.body.city || req.user.city, 60), budget = Number(req.body.budget);
  const skills = (Array.isArray(req.body.skills) ? req.body.skills : []).map((s) => oneLine(s, 40)).filter(Boolean).slice(0, 10);
  await checkGigAllowed(req.user, { title, description, budget });
  const risk = await reviewGig({ title, description, category, budget }); // AI + rules; the admin sees the reasons if it is held
  const { lat, lng } = req.body;
  const location = validCoords(lat, lng) ? { type: 'Point', coordinates: [+lng, +lat] } : (cityLocation(city) || req.user.location);
  const gig = await Gig.create({
    owner: req.user._id, title, description, category, skills, budget, city, location, fingerprint: fingerprint(title),
    status: risk.flagged ? 'pending_review' : 'open', risk: { score: risk.score, reasons: risk.reasons }, aiReview: { summary: risk.summary, reasons: risk.reasons, score: risk.score },
  });
  await User.updateOne({ _id: req.user._id }, { $inc: { 'stats.gigsPosted': 1 } });
  if (risk.flagged) await notify(req.app, req.user._id, { type: 'gig_review', title: 'Your gig is under review', body: `"${title}" was held for a quick safety check.`, link: '/dashboard' });
  res.status(201).json({ gig: publicGig(gig), held: risk.flagged });
});

// Closing a gig cancels its waiting hire requests and tells those freelancers.
r.patch('/:id/close', auth(), needRole('client'), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const g = await Gig.findOne({ _id: req.params.id, owner: req.user._id });
  if (!g) throw new HttpError(404, 'Not found');
  if (g.status === 'in_progress') throw new HttpError(409, 'This gig has an accepted freelancer. Complete or cancel that job first.');
  g.status = 'closed'; await g.save();
  const props = await Proposal.find({ gig: g._id, status: 'pending' });
  await Proposal.updateMany({ gig: g._id, status: 'pending' }, { status: 'rejected' });
  for (const x of props) await notify(req.app, x.freelancer, { type: 'proposal_rejected', title: 'A job you applied to was closed', body: `"${g.title}"`, link: '/proposals' });
  const pending = await Booking.find({ gig: g._id, status: 'requested' });
  await Booking.updateMany({ gig: g._id, status: 'requested' }, { status: 'cancelled', cancelledBy: 'client', respondedAt: new Date() });
  for (const b of pending) await notify(req.app, b.freelancer, { type: 'booking_cancelled', title: 'A hire request was withdrawn', body: `The gig "${g.title}" was closed.`, link: '/bookings' });
  res.json({ ok: true });
});
export default r;
