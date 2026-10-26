import User from '../models/User.js';
import Gig from '../models/Gig.js';

const norm = (s) => String(s || '').toLowerCase().trim();
export function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Score 0-100: skills 45, location 20, budget 15, experience 10, rating 10, +5 if AI-verified (busy users x0.6)
export function scoreFreelancer(gig, f) {
  const need = (gig.skills || []).map(norm), have = (f.skills || []).map(norm);
  const text = norm(`${gig.title} ${gig.description} ${gig.category}`);
  const hit = need.filter((n) => have.some((h) => h.includes(n) || n.includes(h))).length;
  const textHit = have.filter((h) => h && text.includes(h)).length;
  const skill = need.length ? Math.min(1, hit / need.length + textHit * 0.1) : Math.min(1, textHit * 0.3);
  const km = haversineKm(gig.location.coordinates, f.location.coordinates);
  const loc = km <= 5 ? 1 : km <= 25 ? 0.7 : km <= 100 ? 0.4 : (norm(f.city) === norm(gig.city) ? 0.4 : 0.1);
  let budget = 0.6;
  if (gig.budget && f.hourlyRate) budget = f.hourlyRate * 2 <= gig.budget ? 1 : f.hourlyRate <= gig.budget ? 0.6 : 0.2;
  const exp = Math.min(1, (f.experienceYears || 0) / 5);
  const rating = f.reviewCount ? f.rating / 5 : 0.5;
  const raw = (skill * 45 + loc * 20 + budget * 15 + exp * 10 + rating * 10 + (f.verified ? 5 : 0)) * (f.available ? 1 : 0.6);
  return {
    score: Math.min(100, Math.round(raw)), distanceKm: Math.round(km * 10) / 10,
    breakdown: { skills: Math.round(skill * 100), location: Math.round(loc * 100), budget: Math.round(budget * 100), experience: Math.round(exp * 100), rating: Math.round(rating * 100) },
  };
}

const ACTIVE = { role: 'freelancer', onboarded: true, accountStatus: 'approved', banned: false, deactivated: { $ne: true } };
export async function matchFreelancersForGig(gig, limit = 8) {
  const base = { ...ACTIVE, _id: { $ne: gig.owner } };
  // Uses the 2dsphere index first so it stays fast with thousands of users.
  let pool = [];
  try { pool = await User.find({ ...base, location: { $nearSphere: { $geometry: gig.location, $maxDistance: 300000 } } }).limit(300).lean(); } catch { pool = []; }
  if (pool.length < limit) pool = await User.find(base).limit(300).lean();
  return pool.map((user) => ({ user, ...scoreFreelancer(gig, user) })).sort((a, b) => b.score - a.score).slice(0, limit);
}
export async function matchGigsForFreelancer(f, limit = 10) {
  const gigs = await Gig.find({ status: 'open', owner: { $ne: f._id } }).sort('-createdAt').limit(200).populate('owner', 'name city avatarVersion stats').lean();
  return gigs.map((gig) => ({ gig, ...scoreFreelancer(gig, f) })).sort((a, b) => b.score - a.score).slice(0, limit);
}
