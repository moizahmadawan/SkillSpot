import { Router } from 'express';
import Service from '../models/Service.js';
import User from '../models/User.js';
import { auth, needRole, needOnboarded, needApproved, limit } from '../middleware/auth.js';
import { MARKET, LIMITS } from '../config.js';
import { CATEGORY_NAMES } from '../categories.js';
import { screenText } from '../services/safety.js';
import { HttpError, isId, escapeRegex, oneLine, multiLine, pageParams, publicUser } from '../utils.js';
const r = Router();
const FREELANCER = 'name avatarVersion city verified verification.status rating reviewCount stats';

const shape = (s) => {
  const o = s.toObject ? s.toObject() : s;
  const f = o.freelancer && o.freelancer._id ? publicUser(o.freelancer) : o.freelancer;
  return { _id: o._id, title: o.title, category: o.category, description: o.description, price: o.price, deliveryDays: o.deliveryDays, tags: o.tags, active: o.active, createdAt: o.createdAt, freelancer: f && f.location ? { _id: f._id, name: f.name, avatarVersion: f.avatarVersion, city: f.city, verified: f.verified, verificationStatus: f.verificationStatus, rating: f.rating, reviewCount: f.reviewCount, completedJobs: f.completedJobs } : f };
};
const clean = async (b) => {
  const title = oneLine(b.title, 100), description = multiLine(b.description, 2000), category = oneLine(b.category, 40);
  const price = Math.round(Number(b.price)), deliveryDays = Math.round(Number(b.deliveryDays) || 3);
  const tags = [...new Set((Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',')).map((t) => oneLine(t, 30).toLowerCase()).filter(Boolean))].slice(0, 8);
  if (title.length < 5) throw new HttpError(400, 'Service title must be at least 5 characters');
  if (description.length < 20) throw new HttpError(400, 'Describe what you offer in at least 20 characters');
  if (!CATEGORY_NAMES.includes(category)) throw new HttpError(400, 'Choose a category');
  if (!(price >= LIMITS.minBudget && price <= LIMITS.maxBudget)) throw new HttpError(400, `Price must be between Rs ${LIMITS.minBudget} and Rs ${LIMITS.maxBudget.toLocaleString()}`);
  if (deliveryDays < 1 || deliveryDays > 90) throw new HttpError(400, 'Delivery time must be 1 to 90 days');
  if ((await screenText(`${title}\n${description}`)).score >= 70) throw new HttpError(422, 'This service text looks like a scam (advance payment or OTP/CNIC requests). Please rewrite it.');
  return { title, description, category, price, deliveryDays, tags };
};

// Public browse (Fiverr-style)
r.get('/', async (req, res) => {
  const { q, category, minPrice, maxPrice, verified } = req.query;
  const { limit: lim, skip } = pageParams(req.query, 12, 40);
  const f = { active: true };
  if (category) f.category = String(category).slice(0, 40);
  if (isId(String(req.query.freelancer || ''))) f.freelancer = String(req.query.freelancer);
  if (+minPrice > 0 || +maxPrice > 0) { f.price = {}; if (+minPrice > 0) f.price.$gte = +minPrice; if (+maxPrice > 0) f.price.$lte = +maxPrice; }
  if (verified === 'true') { const ids = await User.find({ role: 'freelancer', verified: true }).select('_id').limit(2000).lean(); f.freelancer = { $in: ids.map((x) => x._id) }; }
  const find = (filter) => Service.find(filter).sort('-createdAt').skip(skip).limit(lim + 1).populate('freelancer', FREELANCER);
  let rows;
  if (q) { try { rows = await find({ ...f, $text: { $search: String(q).slice(0, 60) } }); } catch { const re = new RegExp(escapeRegex(String(q).slice(0, 60)), 'i'); rows = await find({ ...f, $or: [{ title: re }, { description: re }, { tags: re }] }); } }
  else rows = await find(f);
  res.json({ items: rows.slice(0, lim).map(shape), hasMore: rows.length > lim });
});
r.get('/mine', auth(), needRole('freelancer'), async (req, res) => res.json((await Service.find({ freelancer: req.user._id }).sort('-createdAt').limit(50)).map(shape)));
r.get('/:id', async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const s = await Service.findOne({ _id: req.params.id, active: true }).populate('freelancer', FREELANCER);
  if (!s) throw new HttpError(404, 'Not found');
  res.json(shape(s));
});
r.post('/', auth(), needRole('freelancer'), needOnboarded, needApproved, limit(3600e3, 20), async (req, res) => {
  if ((await Service.countDocuments({ freelancer: req.user._id, active: true })) >= MARKET.activeServices) throw new HttpError(429, `You can keep ${MARKET.activeServices} services live. Remove one first.`);
  const s = await Service.create({ ...(await clean(req.body)), freelancer: req.user._id });
  res.status(201).json(shape(s));
});
r.patch('/:id', auth(), needRole('freelancer'), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const s = await Service.findOne({ _id: req.params.id, freelancer: req.user._id });
  if (!s) throw new HttpError(404, 'Not found');
  if (req.body.active !== undefined && Object.keys(req.body).length === 1) { s.active = !!req.body.active; }
  else Object.assign(s, await clean({ ...s.toObject(), ...req.body }));
  await s.save(); res.json(shape(s));
});
r.delete('/:id', auth(), needRole('freelancer'), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  await Service.deleteOne({ _id: req.params.id, freelancer: req.user._id }); res.json({ ok: true });
});
export default r;
