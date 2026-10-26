import 'dotenv/config';
import express from 'express';
import 'express-async-errors'; // lets async route handlers throw errors safely
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import gigRoutes from './routes/gigs.js';
import serviceRoutes from './routes/services.js';
import proposalRoutes from './routes/proposals.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import chatRoutes from './routes/chat.js';
import communityRoutes from './routes/community.js';
import notificationRoutes from './routes/notifications.js';
import reportRoutes from './routes/reports.js';
import aiRoutes from './routes/ai.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { sanitize } from './middleware/sanitize.js';
import { ensureAdmin } from './services/adminAccount.js';
import User from './models/User.js';
import Gig from './models/Gig.js';
import Booking from './models/Booking.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';
import Notification from './models/Notification.js';
import Report from './models/Report.js';
import Avatar from './models/Avatar.js';
import Payment from './models/Payment.js';
import Service from './models/Service.js';
import Proposal from './models/Proposal.js';
import CommunityMessage from './models/CommunityMessage.js';

if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) { console.error('Set MONGODB_URI and JWT_SECRET in server/.env'); process.exit(1); }
const origins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((s) => s.trim()) : true;
const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1); // correct client IPs behind Render/Railway/Nginx
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '600kb' }));
app.use(sanitize);
// per-IP requests per minute; tune with API_RATE_LIMIT
app.use('/api', rateLimit({ windowMs: 60_000, limit: Number(process.env.API_RATE_LIMIT) || 1500, standardHeaders: true, legacyHeaders: false, validate: false, message: { error: 'Too many requests, please slow down.' } }));

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gigs', gigRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(', ') });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid request' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.', code: err.code });
});

// ---- Socket.IO: live delivery only. Every user joins ONE private room (user:<id>); approved members also join their own community room ----
const io = new Server(server, { cors: { origin: origins }, maxHttpBufferSize: 1e4 });
app.set('io', io);
io.use(async (socket, next) => {
  try {
    const p = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
    const u = await User.findById(p.id).select('tokenVersion banned deactivated role accountStatus').lean();
    if (!u || u.banned || u.deactivated || (u.tokenVersion || 0) !== (p.tv || 0)) return next(new Error('unauthorized'));
    socket.data.uid = String(p.id); socket.data.role = u.role; socket.data.approved = u.accountStatus === 'approved';
    next();
  } catch { next(new Error('unauthorized')); }
});
io.on('connection', (socket) => {
  const uid = socket.data.uid;
  socket.join(`user:${uid}`);
  if (socket.data.approved && socket.data.role === 'client') socket.join('community:clients');
  if (socket.data.approved && socket.data.role === 'freelancer') socket.join('community:freelancers');
  const cache = new Map(), lastTyping = new Map();
  // "typing…" indicator: only sent to the other participant of a conversation the sender belongs to
  socket.on('typing', async (conversationId) => {
    if (typeof conversationId !== 'string' || !/^[a-f0-9]{24}$/i.test(conversationId)) return;
    const now = Date.now();
    if (now - (lastTyping.get(conversationId) || 0) < 1500) return;
    lastTyping.set(conversationId, now);
    let others = cache.get(conversationId);
    if (!others) {
      const c = await Conversation.findOne({ _id: conversationId, participants: uid }).select('participants').lean();
      if (!c) return;
      others = c.participants.map(String).filter((p) => p !== uid);
      cache.set(conversationId, others);
    }
    for (const o of others) io.to(`user:${o}`).emit('typing', { conversationId, by: uid });
  });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('MongoDB connected');
  // Make sure indexes match the schemas (needed for speed with many users)
  await Promise.all([User, Gig, Booking, Conversation, Message, Notification, Report, Avatar, Payment, Service, Proposal, CommunityMessage].map((m) => m.syncIndexes()))
    .catch((e) => console.warn('Index sync skipped:', e.message));
  // one-time upgrades for accounts created before approval existed
  await User.updateMany({ role: 'admin', email: { $exists: false } }, { role: 'client', accountStatus: 'approved' }); // old phone-based admins become normal users
  await User.updateMany({ role: { $in: ['client', 'freelancer'] }, onboarded: true, accountStatus: { $exists: false } }, { accountStatus: 'approved' });
  await User.updateMany({ accountStatus: { $exists: false } }, { accountStatus: 'pending' });
  await ensureAdmin();
  server.listen(PORT, () => console.log(`API running on :${PORT}`));
}).catch((e) => { console.error('Mongo error', e.message); process.exit(1); });
