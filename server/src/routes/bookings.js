import { Router } from 'express';
import Booking from '../models/Booking.js';
import Gig from '../models/Gig.js';
import Service from '../models/Service.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { auth, needRole, needOnboarded, needApproved, limit } from '../middleware/auth.js';
import { LIMITS } from '../config.js';
import { notify } from '../services/notify.js';
import { recordCancelStrike } from '../services/abuse.js';
import { getOrCreateConversation, postSystemMessage } from '../services/chat.js';
import { acceptBooking } from '../services/bookingFlow.js';
import { releasePayment, closePayment } from '../services/payments.js';
import { HttpError, isId, oneLine, pageParams, assertCanAct } from '../utils.js';
const r = Router();
const blockedEither = (a, b) => (a.blocked || []).some((x) => String(x) === String(b._id)) || (b.blocked || []).some((x) => String(x) === String(a._id));
const usable = (f) => f && f.role === 'freelancer' && f.onboarded && f.accountStatus === 'approved' && !f.banned && !f.deactivated;

// Client hires a freelancer for one of their open gigs, or orders one of the freelancer's services (Fiverr-style)
r.post('/', auth(), needRole('client'), needOnboarded, needApproved, limit(3600e3, 20, 'Too many hire requests. Try again later.'), async (req, res) => {
  const me = req.user;
  assertCanAct(me);
  const { freelancer, gig: gigId, service: serviceId } = req.body;
  let f, gig = null, service = null, price, title, days, kind;
  if (serviceId) {
    if (!isId(serviceId)) throw new HttpError(400, 'Choose a service');
    service = await Service.findOne({ _id: serviceId, active: true });
    if (!service) throw new HttpError(404, 'This service is not available');
    f = await User.findById(service.freelancer);
    price = service.price; title = service.title; days = service.deliveryDays; kind = 'order';
  } else {
    if (!isId(freelancer) || !isId(gigId)) throw new HttpError(400, 'Choose a freelancer and one of your open gigs');
    [f, gig] = await Promise.all([User.findById(freelancer), Gig.findOne({ _id: gigId, owner: me._id })]);
    if (!gig || gig.status !== 'open') throw new HttpError(400, 'Choose one of your open gigs');
    price = Number(req.body.price); title = gig.title; kind = 'hire';
    if (!(price >= LIMITS.minBudget && price <= LIMITS.maxBudget)) throw new HttpError(400, `Offer a price between Rs ${LIMITS.minBudget} and Rs ${LIMITS.maxBudget.toLocaleString()}`);
  }
  if (!usable(f)) throw new HttpError(404, 'This freelancer is not available');
  if (blockedEither(me, f)) throw new HttpError(403, 'You cannot hire this user');
  await Booking.updateMany({ client: me._id, status: 'requested', expiresAt: { $lt: new Date() } }, { status: 'expired' });
  const dupFilter = service ? { service: service._id, client: me._id } : { gig: gig._id, freelancer: f._id };
  const [pending, dup] = await Promise.all([
    Booking.countDocuments({ client: me._id, status: 'requested' }),
    Booking.exists({ ...dupFilter, status: { $in: ['requested', 'accepted'] } }),
  ]);
  if (pending >= LIMITS.pendingHires) throw new HttpError(429, `You already have ${LIMITS.pendingHires} requests waiting for an answer. Wait for replies first.`, 'HIRE_LIMIT');
  if (dup) throw new HttpError(409, service ? 'You already ordered this service and it is still active.' : 'You already sent this freelancer a request for this gig.');
  const booking = await Booking.create({ gig: gig?._id, service: service?._id, kind, title, days, client: me._id, freelancer: f._id, price, note: oneLine(req.body.note, 500), expiresAt: new Date(Date.now() + LIMITS.bookingExpiryHours * 36e5) });
  const { conv } = await getOrCreateConversation(me._id, me, f);
  await postSystemMessage(req.app, conv, me._id, f._id, `${kind === 'order' ? 'Order placed' : 'Hire request sent'} for "${title}" at Rs ${price.toLocaleString()}.`);
  await notify(req.app, f._id, { type: 'booking_request', title: `${me.name || 'A client'} ${kind === 'order' ? 'ordered your service' : 'wants to hire you'}`, body: `"${title}" for Rs ${price.toLocaleString()}. Accept or decline within ${LIMITS.bookingExpiryHours} hours.`, link: '/bookings' });
  res.status(201).json(booking);
});

const PAY_FIELDS = 'status amount commission tax freelancerNet method reference taxPaid';
r.get('/', auth(), needOnboarded, async (req, res) => {
  const me = req.user;
  if (!['client', 'freelancer'].includes(me.role)) return res.json({ items: [], hasMore: false });
  const field = me.role === 'client' ? 'client' : 'freelancer';
  await Booking.updateMany({ [field]: me._id, status: 'requested', expiresAt: { $lt: new Date() } }, { status: 'expired' });
  const { limit: lim, skip } = pageParams(req.query, 20, 50);
  const f = { [field]: me._id };
  const groups = { pending: ['requested'], active: ['accepted'], done: ['completed'], closed: ['declined', 'cancelled', 'expired'] };
  if (groups[req.query.tab]) f.status = { $in: groups[req.query.tab] };
  const rows = await Booking.find(f).sort('-createdAt').skip(skip).limit(lim + 1)
    .populate('client', 'name avatarVersion city').populate('freelancer', 'name avatarVersion city verified rating').populate('gig', 'title budget status').lean();
  const pays = await Payment.find({ booking: { $in: rows.map((x) => x._id) } }).select(`booking ${PAY_FIELDS}`).lean();
  const byBooking = new Map(pays.map((p) => [String(p.booking), p]));
  res.json({ items: rows.slice(0, lim).map((b) => ({ ...b, title: b.title || b.gig?.title, payment: byBooking.get(String(b._id)) || null })), hasMore: rows.length > lim });
});

r.get('/counts', auth(), needOnboarded, async (req, res) => {
  const me = req.user;
  if (!['client', 'freelancer'].includes(me.role)) return res.json({});
  const field = me.role === 'client' ? 'client' : 'freelancer';
  const rows = await Booking.aggregate([{ $match: { [field]: me._id, $or: [{ status: { $ne: 'requested' } }, { expiresAt: { $gte: new Date() } }] } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  res.json(Object.fromEntries(rows.map((x) => [x._id, x.n])));
});

r.patch('/:id', auth(), needOnboarded, limit(60e3, 30), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const b = await Booking.findById(req.params.id);
  const me = req.user;
  const isF = b && String(b.freelancer) === String(me._id), isC = b && String(b.client) === String(me._id);
  if (!b || (!isF && !isC)) throw new HttpError(404, 'Not found');
  const next = req.body.status;
  const allowed = isF ? { requested: ['accepted', 'declined'], accepted: ['cancelled'] } : { requested: ['cancelled'], accepted: ['completed', 'cancelled'] };
  if (b.status === 'requested' && b.expiresAt && b.expiresAt < new Date()) { b.status = 'expired'; await b.save(); throw new HttpError(410, 'This request has expired.'); }
  if (!(allowed[b.status] || []).includes(next)) throw new HttpError(409, `You cannot change a ${b.status} request to ${next}.`);
  const other = isF ? b.client : b.freelancer;
  const who = me.name || (isF ? 'The freelancer' : 'The client');
  const title = b.title || 'your job';
  const prev = b.status;
  if (next === 'accepted') assertCanAct(me);
  const pay = await Payment.findOne({ booking: b._id });

  if (next === 'accepted') {
    await acceptBooking(req.app, b, { who });
  } else if (next === 'declined') {
    b.status = 'declined'; b.respondedAt = new Date(); await b.save();
    await notify(req.app, other, { type: 'booking_declined', title: `${who} declined your request`, body: `"${title}". You can hire someone else.`, link: '/bookings' });
  } else if (next === 'completed') {
    const rating = Number(req.body.rating);
    if (!pay || pay.status !== 'held') throw new HttpError(402, 'Pay for this job in SkillSpot first (your money stays safe until you confirm), then mark it complete.', 'PAYMENT_REQUIRED');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rate the freelancer from 1 to 5');
    b.status = 'completed'; b.respondedAt = new Date(); b.rating = rating; b.review = oneLine(req.body.review, 500); await b.save();
    await releasePayment(req.app, pay);
    const f = await User.findById(b.freelancer);
    if (f) { f.rating = (f.rating * f.reviewCount + rating) / (f.reviewCount + 1); f.reviewCount += 1; f.stats.completed += 1; await f.save(); }
    await User.updateOne({ _id: b.client }, { $inc: { 'stats.completed': 1 } });
    if (b.gig) await Gig.updateOne({ _id: b.gig }, { status: 'completed' });
    await notify(req.app, other, { type: 'booking_completed', title: 'Job marked as completed', body: `${who} rated you ${rating}/5 for "${title}".`, link: '/bookings' });
  } else if (next === 'cancelled') {
    b.status = 'cancelled'; b.respondedAt = new Date(); b.cancelledBy = isF ? 'freelancer' : 'client'; await b.save();
    if (b.gig) await Gig.updateOne({ _id: b.gig, status: 'in_progress' }, { status: 'open' });
    await closePayment(req.app, pay, `${who} cancelled`);
    await notify(req.app, other, { type: 'booking_cancelled', title: `${who} cancelled the request`, body: `"${title}".`, link: '/bookings' });
    if (prev === 'accepted') { // only cancelling an accepted job is a strike
      const s = await recordCancelStrike(me._id);
      if (s?.restricted) await notify(req.app, me._id, { type: 'restriction', title: 'Your account is temporarily restricted', body: s.user.restrictionReason, link: '/dashboard' });
    }
  }
  res.json(b);
});
export default r;
