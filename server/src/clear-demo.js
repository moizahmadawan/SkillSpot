import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import Gig from './models/Gig.js';
import Booking from './models/Booking.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';
import Notification from './models/Notification.js';
import Report from './models/Report.js';
import Avatar from './models/Avatar.js';

// Removes the fake demo accounts created by the old seed script (and everything connected to them).
// Only these exact phone numbers are touched, real users are never deleted.
const DEMO_PHONES = ['+923000000001', '+923000000002', ...Array.from({ length: 12 }, (_, i) => `+923000000${101 + i}`)];

await mongoose.connect(process.env.MONGODB_URI);
const ids = (await User.find({ phone: { $in: DEMO_PHONES } }).select('_id')).map((u) => u._id);
if (!ids.length) { console.log('No demo data found. Your database only has real data.'); process.exit(0); }
const [gigs, bookings, convs, msgs, notes, reports] = await Promise.all([
  Gig.deleteMany({ owner: { $in: ids } }),
  Booking.deleteMany({ $or: [{ client: { $in: ids } }, { freelancer: { $in: ids } }] }),
  Conversation.deleteMany({ participants: { $in: ids } }),
  Message.deleteMany({ $or: [{ from: { $in: ids } }, { to: { $in: ids } }] }),
  Notification.deleteMany({ user: { $in: ids } }),
  Report.deleteMany({ $or: [{ reporter: { $in: ids } }, { offender: { $in: ids } }] }),
  Avatar.deleteMany({ user: { $in: ids } }),
]);
const users = await User.deleteMany({ _id: { $in: ids } });
console.log(`Removed demo data: ${users.deletedCount} users, ${gigs.deletedCount} gigs, ${bookings.deletedCount} bookings, ${convs.deletedCount} chats, ${msgs.deletedCount} messages, ${notes.deletedCount} notifications, ${reports.deletedCount} reports.`);
process.exit(0);
