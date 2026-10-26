import mongoose from 'mongoose';
import crypto from 'crypto';
export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export const isId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
export const oid = (v) => new mongoose.Types.ObjectId(String(v));
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
// Public coordinates are rounded (~1 km) so exact home locations are never exposed.
export const coarse = (loc) => ({ type: 'Point', coordinates: [round2(loc?.coordinates?.[0] ?? 0), round2(loc?.coordinates?.[1] ?? 0)] });
export const oneLine = (s, max) => String(s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const multiLine = (s, max) => String(s ?? '').replace(/[<>]/g, '').replace(/\r/g, '').trim().slice(0, max);
export const pageParams = (q, def = 20, max = 50) => {
  const limit = Math.min(Math.max(parseInt(q.limit) || def, 1), max);
  const page = Math.max(parseInt(q.page) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
};
// One canonical form per phone number so 0300..., +92300... and 92300... are the same account.
export const normalizePhone = (raw = '') => {
  let p = String(raw).replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (/^03\d{9}$/.test(p)) p = '+92' + p.slice(1);
  else if (/^92\d{10}$/.test(p)) p = '+' + p;
  if (/^\+920\d{10}$/.test(p)) p = '+92' + p.slice(4);
  return p;
};
export const validPhone = (p) => /^\+\d{8,15}$/.test(p);
export const maskPhone = (p = '') => (p.length > 6 ? `${p.slice(0, 3)} ${'*'.repeat(p.length - 7)} ${p.slice(-4)}` : p);

const PUB = ['_id', 'name', 'role', 'bio', 'skills', 'experienceYears', 'hourlyRate', 'available', 'city', 'rating', 'reviewCount', 'verified', 'avatarVersion', 'createdAt'];
export function publicUser(u, extra = {}) {
  const o = u?.toObject ? u.toObject() : u;
  const out = {};
  for (const k of PUB) out[k] = o[k];
  out.location = coarse(o.location);
  out.completedJobs = o.stats?.completed || 0;
  out.verificationStatus = o.verified ? 'verified' : (o.verification?.status === 'needs_changes' ? 'needs_changes' : 'pending');
  if (o.verified) out.verificationSummary = o.verification?.summary || '';
  return { ...out, ...extra };
}
export function publicGig(g) {
  const o = g?.toObject ? g.toObject() : g;
  const owner = o.owner && o.owner._id ? { _id: o.owner._id, name: o.owner.name, city: o.owner.city, avatarVersion: o.owner.avatarVersion, completedJobs: o.owner.stats?.completed || 0 } : o.owner;
  return { _id: o._id, title: o.title, description: o.description, category: o.category, skills: o.skills, budget: o.budget, city: o.city, status: o.status, createdAt: o.createdAt, location: coarse(o.location), owner, proposalCount: o.proposalCount || 0 };
}
export const isRestricted = (u) => u?.restrictedUntil && new Date(u.restrictedUntil) > new Date();
export function assertCanAct(u) {
  if (isRestricted(u)) {
    throw new HttpError(403, `Your account is temporarily restricted until ${new Date(u.restrictedUntil).toDateString()}. ${u.restrictionReason || ''}`.trim(), 'RESTRICTED');
  }
}
export const selfUser = (u) => { const o = u.toObject(); delete o.tokenVersion; return o; };

// Password hashing with Node's built-in scrypt (no extra dependency). Format: scrypt$salt$hash
export const hashPassword = (pw) => new Promise((res, rej) => {
  const salt = crypto.randomBytes(16).toString('hex');
  crypto.scrypt(pw, salt, 64, (e, key) => (e ? rej(e) : res(`scrypt$${salt}$${key.toString('hex')}`)));
});
export const verifyPassword = (pw, stored) => new Promise((res) => {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return res(false);
  crypto.scrypt(pw, salt, 64, (e, key) => res(!e && crypto.timingSafeEqual(key, Buffer.from(hash, 'hex'))));
});
export function km([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
export const inPakistan = (lat, lng) => lat >= 23.4 && lat <= 37.2 && lng >= 60.8 && lng <= 77.9;
export const money = (n) => Math.round(Number(n) || 0);
export function assertApproved(u) {
  if (u?.accountStatus === 'approved') return;
  throw new HttpError(403, u?.accountStatus === 'rejected' ? 'Your account was not approved. Update your location in Settings to ask for a new check.' : 'Your account is waiting for admin approval (the admin checks your location).', 'PENDING_APPROVAL');
}
