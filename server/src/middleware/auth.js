import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { HttpError } from '../utils.js';

export const auth = (required = true) => async (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return required ? res.status(401).json({ error: 'Please log in' }) : next();
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(p.id);
    if (!user || user.banned || user.deactivated || (user.tokenVersion || 0) !== (p.tv || 0)) return res.status(401).json({ error: 'Session expired, please log in again' });
    req.user = user;
    next();
  } catch { res.status(401).json({ error: 'Invalid session' }); }
};
export const needRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, `This action is only for ${roles.join(' / ')} accounts`, 'WRONG_ROLE'));
export const needOnboarded = (req, _res, next) =>
  req.user.onboarded ? next() : next(new HttpError(403, 'Finish your account setup first', 'ONBOARDING'));
export const adminOnly = needRole('admin');
// Per-user (or per-IP when logged out) rate limit. Put it AFTER auth() in the route chain.
export const limit = (windowMs, max, message) => rateLimit({
  windowMs, limit: max, standardHeaders: true, legacyHeaders: false, validate: false,
  keyGenerator: (req) => (req.user ? String(req.user._id) : req.ip),
  message: { error: message || 'Too many requests, please slow down.' },
});
// Only accounts whose location was checked and approved by the admin can post, hire, apply, message or pay.
export const needApproved = (req, _res, next) => {
  const st = req.user.accountStatus;
  if (st === 'approved') return next();
  next(new HttpError(403, st === 'rejected'
    ? `Your account was not approved${req.user.accountNote ? `: ${req.user.accountNote}` : ''}. Update your location in Settings to ask for a new check.`
    : 'Your account is waiting for admin approval (the admin checks your location). You can browse meanwhile.', 'PENDING_APPROVAL'));
};
