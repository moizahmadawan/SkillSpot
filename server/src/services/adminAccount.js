import User from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils.js';

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'skillspotai@gmail.com').trim().toLowerCase();

// Creates the admin account if it does not exist. The admin sets the password himself:
// either ADMIN_PASSWORD in server/.env or the interactive command `npm run set-admin-password`.
export async function ensureAdmin() {
  let u = await User.findOne({ role: 'admin', email: ADMIN_EMAIL }).select('+passwordHash');
  if (!u) u = new User({ role: 'admin', email: ADMIN_EMAIL, phone: `admin:${ADMIN_EMAIL}`, name: 'SkillSpot Admin', onboarded: true, accountStatus: 'approved', city: 'Pakistan' });
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) {
    if (pw.length < 8) console.warn('ADMIN_PASSWORD is shorter than 8 characters, ignored.');
    else if (!u.passwordHash || !(await verifyPassword(pw, u.passwordHash))) u.passwordHash = await hashPassword(pw);
  }
  u.accountStatus = 'approved'; u.onboarded = true;
  await u.save();
  if (!u.passwordHash) console.warn(`Admin account ${ADMIN_EMAIL} has no password yet. Run "npm run set-admin-password" (or set ADMIN_PASSWORD in server/.env).`);
  else console.log(`Admin login ready: ${ADMIN_EMAIL}`);
  return u;
}
