import Gig from '../models/Gig.js';
import User from '../models/User.js';
import { LIMITS } from '../config.js';
import { HttpError, assertCanAct } from '../utils.js';

export const fingerprint = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);

// Stops fake / spam gigs: size limits, duplicate titles, too many active gigs, too many per day.
export async function checkGigAllowed(user, { title, description, budget }) {
  assertCanAct(user);
  if (!title || title.length < 5) throw new HttpError(400, 'Gig title must be at least 5 characters');
  if (!description || description.length < 20) throw new HttpError(400, 'Describe the job in at least 20 characters so freelancers know what to do');
  if (!(budget >= LIMITS.minBudget && budget <= LIMITS.maxBudget)) throw new HttpError(400, `Budget must be between Rs ${LIMITS.minBudget} and Rs ${LIMITS.maxBudget.toLocaleString()}`);
  const day = new Date(Date.now() - 864e5), week = new Date(Date.now() - 7 * 864e5);
  const [active, today, dup] = await Promise.all([
    Gig.countDocuments({ owner: user._id, status: { $in: ['open', 'pending_review', 'in_progress'] } }),
    Gig.countDocuments({ owner: user._id, createdAt: { $gte: day } }),
    Gig.exists({ owner: user._id, fingerprint: fingerprint(title), createdAt: { $gte: week } }),
  ]);
  if (active >= LIMITS.openGigs) throw new HttpError(429, `You already have ${LIMITS.openGigs} active gigs. Close or finish one before posting another.`, 'GIG_LIMIT');
  if (today >= LIMITS.gigsPerDay) throw new HttpError(429, `You can post up to ${LIMITS.gigsPerDay} gigs per day.`, 'GIG_LIMIT');
  if (dup) throw new HttpError(409, 'You already posted a gig with this title recently.', 'DUPLICATE_GIG');
}

// A cancellation after a job was accepted counts as a strike. Enough strikes = temporary restriction.
export async function recordCancelStrike(userId) {
  const u = await User.findById(userId);
  if (!u) return null;
  const since = new Date(Date.now() - LIMITS.cancelWindowDays * 864e5);
  const dates = [...(u.stats.cancelDates || []).filter((d) => d > since), new Date()].slice(-10);
  u.stats.cancelDates = dates;
  let restricted = false;
  if (dates.length >= LIMITS.cancelStrikes) {
    u.restrictedUntil = new Date(Date.now() + LIMITS.restrictDays * 864e5);
    u.restrictionReason = 'Too many cancellations after accepted jobs.';
    u.stats.cancelDates = [];
    restricted = true;
  }
  await u.save();
  return { restricted, user: u };
}
