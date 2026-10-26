import { Router } from 'express';
import Notification from '../models/Notification.js';
import { auth } from '../middleware/auth.js';
import { HttpError, isId } from '../utils.js';
const r = Router();
r.use(auth());
r.get('/', async (req, res) => {
  const q = { user: req.user._id };
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && !isNaN(before)) q.createdAt = { $lt: before };
  const rows = await Notification.find(q).sort({ createdAt: -1 }).limit(31).lean();
  res.json({ items: rows.slice(0, 30), hasMore: rows.length > 30 });
});
r.get('/unread', async (req, res) => res.json({ unread: await Notification.countDocuments({ user: req.user._id, read: false }) }));
r.post('/read-all', async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ ok: true }); });
r.patch('/:id/read', async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
  res.json({ ok: true });
});
export default r;
