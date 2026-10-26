import { Router } from 'express';
import User from '../models/User.js';
import Gig from '../models/Gig.js';
import Service from '../models/Service.js';
import Booking from '../models/Booking.js';
import { CATEGORIES } from '../categories.js';
const r = Router();
const MEMBER = { onboarded: true, accountStatus: 'approved', banned: false, deactivated: { $ne: true } };
let cache = { at: 0, stats: null };

// Real numbers for the public landing page (cached for 30 seconds)
r.get('/stats', async (_, res) => {
  if (Date.now() - cache.at > 30_000) {
    const [freelancers, clients, openGigs, services, completedJobs] = await Promise.all([
      User.countDocuments({ ...MEMBER, role: 'freelancer' }), User.countDocuments({ ...MEMBER, role: 'client' }),
      Gig.countDocuments({ status: 'open' }), Service.countDocuments({ active: true }), Booking.countDocuments({ status: 'completed' }),
    ]);
    cache = { at: Date.now(), stats: { freelancers, clients, openGigs, services, completedJobs } };
  }
  res.json(cache.stats);
});
// Category list with real counts of live services and open gigs
r.get('/categories', async (_, res) => {
  const count = async (M, match) => Object.fromEntries((await M.aggregate([{ $match: match }, { $group: { _id: '$category', n: { $sum: 1 } } }])).map((x) => [x._id, x.n]));
  const [svc, gigs] = await Promise.all([count(Service, { active: true }), count(Gig, { status: 'open' })]);
  res.json(CATEGORIES.map((c) => ({ ...c, services: svc[c.name] || 0, openGigs: gigs[c.name] || 0 })));
});
export default r;
