import Report from '../models/Report.js';
import Message from '../models/Message.js';
import Payment from '../models/Payment.js';

// Fraud signals shown to the admin for any user. This is a guide for a human, never an automatic ban.
export async function assessRisk(user) {
  const [reports, scamMsgs, refunds] = await Promise.all([
    Report.countDocuments({ offender: user._id }),
    Message.countDocuments({ from: user._id, flagged: true }),
    Payment.countDocuments({ status: 'refunded', $or: [{ client: user._id }, { freelancer: user._id }] }),
  ]);
  const cancels = (user.stats?.cancelDates || []).length;
  const reasons = []; let score = 0;
  const add = (pts, why) => { score += pts; reasons.push(why); };
  if (reports) add(Math.min(60, reports * 20), `${reports} report(s) against this user`);
  if (scamMsgs) add(Math.min(40, scamMsgs * 10), `${scamMsgs} chat message(s) flagged as scam-like`);
  if (cancels) add(Math.min(30, cancels * 10), `${cancels} recent cancellation(s) after acceptance`);
  if (refunds) add(Math.min(20, refunds * 5), `${refunds} refunded payment(s)`);
  if (user.locationCheck?.flag) add(25, user.locationCheck.note || 'Location looks suspicious');
  if (user.restrictedUntil && new Date(user.restrictedUntil) > new Date()) add(10, 'Currently restricted');
  score = Math.min(100, score);
  return { score, level: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low', reasons, counts: { reports, scamMsgs, cancels, refunds } };
}
