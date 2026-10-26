import { Router } from 'express';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { HttpError, normalizePhone, validPhone, selfUser, verifyPassword } from '../utils.js';
const r = Router();

let fbReady = false;
let fbWhy = 'unknown reason';
try {
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (!file && !process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error(`FIREBASE_SERVICE_ACCOUNT_FILE is empty, or server/.env was not loaded (server was started from: ${process.cwd()})`);
  const raw = file ? fs.readFileSync(file, 'utf8') : process.env.FIREBASE_SERVICE_ACCOUNT;
  const sa = JSON.parse(raw);
  if (!sa.project_id) throw new Error('the key has no project_id, download the service account key again');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  fbReady = true;
  console.log('Firebase admin ready for project:', sa.project_id);
} catch (e) { fbWhy = e.message; console.warn('Firebase admin not configured (only needed for real SMS login):', e.message); }

const TEST_OTP = '123456';
const TEST_OTP_ON = process.env.ALLOW_TEST_OTP !== 'false';
if (TEST_OTP_ON) console.warn('WARNING: test login is ON (any phone + OTP 123456). Set ALLOW_TEST_OTP=false before deploying.');

const limiterOpts = { standardHeaders: true, legacyHeaders: false, validate: false };
const perIp = rateLimit({ ...limiterOpts, windowMs: 60_000, limit: Number(process.env.LOGIN_IP_LIMIT) || 300, message: { error: 'Too many login attempts from this network. Try again in a minute.' } });
const perPhone = rateLimit({ ...limiterOpts, windowMs: 10 * 60_000, limit: Number(process.env.LOGIN_PHONE_LIMIT) || 15, keyGenerator: (req) => normalizePhone(req.body?.phone) || req.ip, message: { error: 'Too many login attempts for this number. Try again in a few minutes.' } });
const loginLimiter = [perIp, perPhone];
const sign = (u, expiresIn = '30d') => jwt.sign({ id: u._id, tv: u.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn });

// One phone number = one account. The phone is normalised first, and the unique index guards against races.
async function loginWithPhone(phone) {
  let u = await User.findOne({ phone });
  if (!u) {
    try { u = await User.create({ phone, role: 'client', onboarded: false }); }
    catch (e) { if (e.code === 11000) u = await User.findOne({ phone }); else throw e; }
  }
  if (u.role === 'admin') throw new HttpError(403, 'Admins log in with email and password on the admin login page.');
  if (u.banned) throw new HttpError(403, 'This account has been suspended.');
  if (u.deactivated) throw new HttpError(403, 'This account is deactivated. Contact support to restore it.');
  return u;
}

r.post('/firebase', perIp, async (req, res) => {
  if (!fbReady) return res.status(503).json({ error: `Firebase server config missing: ${fbWhy}` });
  let dec;
  try { dec = await admin.auth().verifyIdToken(req.body.idToken); } catch { throw new HttpError(401, 'Login verification failed'); }
  if (!dec.phone_number) throw new HttpError(401, 'Please log in with a phone number');
  const u = await loginWithPhone(normalizePhone(dec.phone_number));
  res.json({ token: sign(u), user: selfUser(u) });
});

// TEST LOGIN: any phone number + OTP 123456. Turn off before going live with ALLOW_TEST_OTP=false.
r.post('/dev-login', ...loginLimiter, async (req, res) => {
  if (!TEST_OTP_ON) throw new HttpError(403, 'Test login is disabled');
  const phone = normalizePhone(req.body.phone);
  if (!validPhone(phone) || req.body.otp !== TEST_OTP) throw new HttpError(400, `Enter a valid phone number and use the OTP ${TEST_OTP}`);
  const u = await loginWithPhone(phone);
  res.json({ token: sign(u), user: selfUser(u) });
});

// Admin login: email + password (the admin sets the password himself, see services/adminAccount.js)
const adminLimiter = rateLimit({ standardHeaders: true, legacyHeaders: false, validate: false, windowMs: 15 * 60_000, limit: 8, keyGenerator: (req) => `${String(req.body?.email || '').toLowerCase()}|${req.ip}`, message: { error: 'Too many admin login attempts. Try again in 15 minutes.' } });
r.post('/admin-login', adminLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '');
  const u = await User.findOne({ role: 'admin', email }).select('+passwordHash');
  const ok = await verifyPassword(password, u?.passwordHash || 'scrypt$00$00');
  if (!u || !u.passwordHash || !ok || u.banned) throw new HttpError(401, 'Wrong email or password');
  res.json({ token: sign(u, '12h'), user: selfUser(u) });
});

r.get('/me', auth(), (req, res) => res.json(selfUser(req.user)));
r.get('/config', (_, res) => res.json({ testLogin: TEST_OTP_ON, firebase: fbReady }));
// Signs the account out everywhere else (old tokens stop working) and returns a fresh token for this device.
r.post('/logout-all', auth(), async (req, res) => {
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  res.json({ token: sign(req.user) });
});
export default r;
