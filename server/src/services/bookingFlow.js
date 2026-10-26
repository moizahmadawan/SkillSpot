import Booking from '../models/Booking.js';
import Gig from '../models/Gig.js';
import Proposal from '../models/Proposal.js';
import User from '../models/User.js';
import { notify } from './notify.js';
import { ensurePayment } from './payments.js';

// Shared by "freelancer accepts a request" and "client hires from a proposal".
export async function acceptBooking(app, b, { who = 'The freelancer', notifyClient = true } = {}) {
  const gig = b.gig ? await Gig.findById(b.gig) : null;
  b.status = 'accepted'; b.respondedAt = new Date(); b.cancelledBy = undefined; await b.save();
  if (gig && gig.status === 'open') { gig.status = 'in_progress'; await gig.save(); }
  await User.updateOne({ _id: b.client }, { $inc: { 'stats.hires': 1 } });
  if (gig) {
    const rivals = await Booking.find({ gig: b.gig, _id: { $ne: b._id }, status: 'requested' });
    if (rivals.length) {
      await Booking.updateMany({ _id: { $in: rivals.map((x) => x._id) } }, { status: 'declined', respondedAt: new Date() });
      for (const x of rivals) await notify(app, x.freelancer, { type: 'booking_declined', title: 'This job is no longer available', body: `"${gig.title}" was given to another freelancer.`, link: '/bookings' });
    }
    const others = await Proposal.find({ gig: b.gig, status: 'pending', freelancer: { $ne: b.freelancer } });
    if (others.length) {
      await Proposal.updateMany({ _id: { $in: others.map((x) => x._id) } }, { status: 'rejected' });
      for (const x of others) await notify(app, x.freelancer, { type: 'proposal_rejected', title: 'Your proposal was not selected', body: `"${gig.title}" was given to another freelancer.`, link: '/proposals' });
    }
    await Proposal.updateMany({ gig: b.gig, freelancer: b.freelancer, status: 'pending' }, { status: 'accepted' });
  }
  const payment = await ensurePayment(b);
  if (notifyClient) await notify(app, b.client, { type: 'booking_accepted', title: `${who} accepted your hire request`, body: `"${b.title}" is now in progress. Pay securely in SkillSpot, then chat and share contact details.`, link: '/bookings' });
  return payment;
}
