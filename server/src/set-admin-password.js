import 'dotenv/config';
import readline from 'readline';
import mongoose from 'mongoose';
import User from './models/User.js';
import { hashPassword } from './utils.js';
import { ADMIN_EMAIL } from './services/adminAccount.js';

// Interactive: the admin types his own password (hidden). Run: npm run set-admin-password
const ask = (q) => new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (rl.muted && !/[\r\n]/.test(s)) rl.output.write('*'); else rl.output.write(s); };
  rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); res(a); }); rl.muted = true;
});
const pw = await ask(`New password for ${ADMIN_EMAIL} (at least 8 characters): `);
if (pw.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1); }
if (pw !== await ask('Type it again: ')) { console.error('The two passwords do not match.'); process.exit(1); }
await mongoose.connect(process.env.MONGODB_URI);
let u = await User.findOne({ role: 'admin', email: ADMIN_EMAIL });
if (!u) u = new User({ role: 'admin', email: ADMIN_EMAIL, phone: `admin:${ADMIN_EMAIL}`, name: 'SkillSpot Admin', onboarded: true, accountStatus: 'approved', city: 'Pakistan' });
u.passwordHash = await hashPassword(pw); u.tokenVersion = (u.tokenVersion || 0) + 1; await u.save();
console.log(`Done. Log in at /admin/login with ${ADMIN_EMAIL}`);
process.exit(0);
