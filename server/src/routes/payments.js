import { Router } from 'express';
import Payment from '../models/Payment.js';
import { auth, needOnboarded, needApproved, needRole, limit } from '../middleware/auth.js';
import { payPayment } from '../services/payments.js';
import { HttpError, isId, pageParams } from '../utils.js';
const r = Router();
r.use(auth(), needOnboarded, needRole('client', 'freelancer'));

// My payments + totals. TEST MODE: the ledger records money, but no real money moves until a gateway is connected.
r.get('/mine', async (req, res) => {
  const me = req.user, mineField = me.role === 'client' ? 'client' : 'freelancer';
  const { limit: lim, skip } = pageParams(req.query, 20, 50);
  const f = { [mineField]: me._id };
  if (req.query.status) f.status = String(req.query.status);
  const [rows, all] = await Promise.all([
    Payment.find(f).sort('-createdAt').skip(skip).limit(lim + 1).populate('client freelancer', 'name avatarVersion').lean(),
    Payment.find({ [mineField]: me._id }).select('status amount commission tax freelancerNet').lean(),
  ]);
  const sum = (arr, k) => arr.reduce((n, p) => n + (p[k] || 0), 0);
  const released = all.filter((p) => p.status === 'released'), held = all.filter((p) => p.status === 'held');
  const totals = me.role === 'client'
    ? { spent: sum(released, 'amount'), inEscrow: sum(held, 'amount'), refunded: sum(all.filter((p) => p.status === 'refunded'), 'amount'), jobs: released.length }
    : { earned: sum(released, 'freelancerNet'), inEscrow: sum(held, 'freelancerNet'), commission: sum(released, 'commission'), tax: sum(released, 'tax'), jobs: released.length };
  res.json({ items: rows.slice(0, lim), hasMore: rows.length > lim, totals });
});

r.post('/:id/pay', needApproved, needRole('client'), limit(60e3, 10), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const pay = await Payment.findOne({ _id: req.params.id, client: req.user._id });
  if (!pay) throw new HttpError(404, 'Not found');
  res.json(await payPayment(req.app, pay, req.body.method));
});
export default r;
