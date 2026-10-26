import { Router } from 'express';
import User from '../models/User.js';
import Avatar from '../models/Avatar.js';
import { auth, needOnboarded, needRole, limit } from '../middleware/auth.js';
import { runVerification } from '../services/verify.js';
import { notify } from '../services/notify.js';
import { cityLocation, validCoords, checkLocation } from '../cities.js';
import { haversineKm } from '../services/matching.js';
import { MARKET } from '../config.js';
import { km, HttpError, isId, escapeRegex, oneLine, multiLine, pageParams, publicUser, round1, selfUser } from '../utils.js';
const r = Router();

// Changing name, bio, skills or photo takes the Verified badge away until the admin verifies the profile again.
async function afterProfileChange(u, changed) {
  if (u.role !== 'freelancer' || !changed) return;
  if (u.verified) { u.verified = false; u.verification.status = 'pending'; u.verification.notes = ['You changed your profile, so the admin must verify it again.']; await u.save(); }
  else if (u.verification?.status === 'needs_changes') await runVerification(u);
}
const ACTIVE = { role: 'freelancer', onboarded: true, accountStatus: 'approved', banned: false, deactivated: { $ne: true } };

// Public freelancer search (paginated). With lat/lng it uses $geoNear on the 2dsphere index.
r.get('/freelancers', async (req, res) => {
  const { q, city, lat, lng, radius = 50, verified, available } = req.query;
  const { limit: lim, skip } = pageParams(req.query);
  const f = { ...ACTIVE };
  if (verified === 'true') f.verified = true;
  if (available === 'true') f.available = true;
  if (city) f.city = new RegExp(`^${escapeRegex(String(city).slice(0, 60))}$`, 'i');
  if (q) { const re = new RegExp(escapeRegex(String(q).slice(0, 50)), 'i'); f.$or = [{ skills: re }, { name: re }, { bio: re }]; }
  let rows;
  if (validCoords(lat, lng)) {
    const maxKm = Math.min(+radius || 50, 500);
    try {
      rows = await User.aggregate([
        { $geoNear: { near: { type: 'Point', coordinates: [+lng, +lat] }, distanceField: 'distanceM', maxDistance: maxKm * 1000, spherical: true, query: f } },
        { $skip: skip }, { $limit: lim + 1 },
      ]);
    } catch {
      // geo index unavailable: compute distances in memory instead of failing the search
      const pool = await User.find(f).limit(500).lean();
      rows = pool.map((u) => ({ ...u, distanceM: haversineKm([+lng, +lat], u.location.coordinates) * 1000 })).filter((u) => u.distanceM <= maxKm * 1000)
        .sort((a, b) => a.distanceM - b.distanceM).slice(skip, skip + lim + 1);
    }
  } else {
    rows = await User.find(f).sort({ verified: -1, rating: -1, reviewCount: -1 }).skip(skip).limit(lim + 1).lean();
  }
  res.json({ items: rows.slice(0, lim).map((u) => publicUser(u, u.distanceM != null ? { distanceKm: round1(u.distanceM / 1000) } : {})), hasMore: rows.length > lim });
});

r.post('/onboard', auth(), async (req, res) => {
  const u = req.user;
  if (u.onboarded) throw new HttpError(409, 'Your account mode is already set and cannot be changed.');
  const role = req.body.role;
  if (!['client', 'freelancer'].includes(role)) throw new HttpError(400, 'Choose client or freelancer');
  const name = oneLine(req.body.name, 60), city = oneLine(req.body.city, 60);
  if (name.length < 2) throw new HttpError(400, 'Enter your full name');
  if (!city) throw new HttpError(400, 'Enter your city');
  const { lat, lng } = req.body;
  if (!validCoords(lat, lng)) throw new HttpError(400, 'Your location is required. Allow location access so the admin can check it and approve your account.', 'LOCATION_REQUIRED');
  Object.assign(u, { role, name, city, onboarded: true, accountStatus: 'pending', address: oneLine(req.body.address, 120), locationSource: 'gps' });
  u.location = { type: 'Point', coordinates: [+lng, +lat] };
  u.locationCheck = checkLocation(city, +lat, +lng);
  await u.save();
  await notify(req.app, u._id, { type: 'account_pending', title: 'Account submitted', body: 'The SkillSpot admin will check your location and approve your account. You can browse meanwhile.', link: '/dashboard' });
  res.json(selfUser(u));
});

r.put('/me', auth(), needOnboarded, async (req, res) => {
  const b = req.body, u = req.user;
  if (b.name !== undefined) { const n = oneLine(b.name, 60); if (n.length < 2) throw new HttpError(400, 'Enter your full name'); u.name = n; }
  const gps = validCoords(b.lat, b.lng);
  if (b.city !== undefined) {
    const c = oneLine(b.city, 60);
    if (c !== u.city) {
      u.city = c;
      if (u.locationSource !== 'gps') { const loc = cityLocation(c); if (loc && !gps) { u.location = loc; u.locationSource = 'city'; } }
      else if (!gps) u.locationCheck = checkLocation(c, u.location.coordinates[1], u.location.coordinates[0]); // admin sees if the new city does not match the GPS
    }
  }
  if (b.address !== undefined) u.address = oneLine(b.address, 120);
  if (gps) {
    const moved = u.approvedLat != null ? km([u.approvedLng, u.approvedLat], [+b.lng, +b.lat]) : 0;
    u.location = { type: 'Point', coordinates: [+b.lng, +b.lat] }; u.locationSource = 'gps';
    u.locationCheck = checkLocation(u.city, +b.lat, +b.lng);
    // a rejected account asks for a new check; a big move after approval also needs a new check
    if (u.accountStatus === 'rejected' || (u.accountStatus === 'approved' && moved > MARKET.moveRecheckKm)) { u.accountStatus = 'pending'; u.accountNote = undefined; }
  }
  if (u.role === 'freelancer') {
    if (b.bio !== undefined) u.bio = multiLine(b.bio, 600);
    if (b.skills !== undefined) {
      if (!Array.isArray(b.skills)) throw new HttpError(400, 'Skills must be a list');
      u.skills = [...new Set(b.skills.map((s) => oneLine(s, 40).toLowerCase()).filter(Boolean))].slice(0, 15);
    }
    if (b.experienceYears !== undefined) u.experienceYears = Math.min(60, Math.max(0, Math.round(+b.experienceYears) || 0));
    if (b.hourlyRate !== undefined) u.hourlyRate = Math.min(100000, Math.max(0, Math.round(+b.hourlyRate) || 0));
    if (b.available !== undefined) u.available = !!b.available;
  }
  const changedKey = ['name', 'bio', 'skills'].some((k) => u.isModified(k));
  await u.save();
  // edits to a verified (or recently rejected) profile are re-checked automatically; admin-revoked profiles are not
  await afterProfileChange(u, changedKey); // a verified profile loses its badge until the admin verifies it again
  res.json(selfUser(u));
});

const imageType = (b) => (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'image/jpeg'
  : b.subarray(0, 4).toString('hex') === '89504e47' ? 'image/png'
  : b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null);

r.put('/me/avatar', auth(), needOnboarded, limit(3600e3, 10, 'Too many photo changes. Try again later.'), async (req, res) => {
  const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.dataUrl || ''));
  if (!m) throw new HttpError(400, 'Upload a JPG, PNG or WEBP image');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 250 * 1024) throw new HttpError(400, 'Image is too large (max 250 KB)');
  const type = imageType(buf);
  if (!type) throw new HttpError(400, 'That file is not a valid image');
  await Avatar.findOneAndUpdate({ user: req.user._id }, { contentType: type, data: buf }, { upsert: true });
  req.user.avatarVersion = Date.now();
  await req.user.save();
  await afterProfileChange(req.user, true);
  res.json(selfUser(req.user));
});
r.delete('/me/avatar', auth(), async (req, res) => {
  await Avatar.deleteOne({ user: req.user._id });
  req.user.avatarVersion = 0;
  await req.user.save();
  await afterProfileChange(req.user, true);
  res.json(selfUser(req.user));
});

// Freelancer asks for verification: the AI reviews the profile first and writes a note for the admin, who decides.
r.post('/me/verify', auth(), needRole('freelancer'), needOnboarded, limit(86400e3, 5, 'You can request a profile review 5 times per day.'), async (req, res) => {
  const v = await runVerification(req.user);
  await notify(req.app, req.user._id, v.aiPassed
    ? { type: 'verification', title: 'Profile sent for verification', body: 'The AI review passed. The admin will verify your profile soon.', link: '/settings' }
    : { type: 'verification', title: 'Profile needs changes', body: v.notes?.[0] || 'Open your profile to see what to fix.', link: '/settings' });
  res.json({ verification: v, verified: req.user.verified });
});

r.get('/me/blocked', auth(), async (req, res) => {
  const rows = await User.find({ _id: { $in: req.user.blocked || [] } }).select('name avatarVersion role').lean();
  res.json(rows);
});
r.post('/me/block/:id', auth(), needOnboarded, async (req, res) => {
  if (!isId(req.params.id) || String(req.params.id) === String(req.user._id)) throw new HttpError(400, 'Invalid user');
  await User.updateOne({ _id: req.user._id }, { $addToSet: { blocked: req.params.id } });
  res.json({ ok: true });
});
r.delete('/me/block/:id', auth(), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, 'Invalid user');
  await User.updateOne({ _id: req.user._id }, { $pull: { blocked: req.params.id } });
  res.json({ ok: true });
});
r.post('/me/deactivate', auth(), async (req, res) => {
  if (req.body.confirm !== 'DEACTIVATE') throw new HttpError(400, 'Type DEACTIVATE to confirm');
  req.user.deactivated = true; req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  res.json({ ok: true });
});

r.get('/:id/avatar', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).end();
  const a = await Avatar.findOne({ user: req.params.id });
  if (!a) return res.status(404).end();
  res.set({ 'Content-Type': a.contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'Cross-Origin-Resource-Policy': 'cross-origin' }).send(a.data);
});
r.get('/:id', auth(false), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Not found');
  const own = req.user && String(req.user._id) === req.params.id;
  const u = await User.findOne({ _id: req.params.id, onboarded: true, banned: false, deactivated: { $ne: true }, ...(own ? {} : { accountStatus: 'approved' }) }).lean();
  if (!u || u.role === 'admin') throw new HttpError(404, 'Not found');
  res.json(publicUser(u));
});
export default r;
