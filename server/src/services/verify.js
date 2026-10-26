import User from '../models/User.js';
import { askJSON } from './ai.js';
import { screenText } from './safety.js';

// Automatic freelancer profile check. Not an ID check: it reviews completeness, quality and safety of the profile.
export async function runVerification(user) {
  const notes = [];
  let score = 0;
  const name = user.name || '', bio = user.bio || '', skills = user.skills || [];
  const nameOk = /^[\p{L}][\p{L} .'-]{2,58}$/u.test(name) && !/\d/.test(name);
  const photoOk = user.avatarVersion > 0;
  const bioOk = bio.length >= 60;
  const skillsOk = skills.length >= 2;
  const check = (ok, pts, bad) => { if (ok) score += pts; else notes.push(bad); };
  check(nameOk, 15, 'Use your real full name (letters only, no numbers).');
  check(photoOk, 15, 'Add a clear profile photo.');
  check(bioOk, 20, 'Write a bio of at least 60 characters about the work you do.');
  check(skillsOk, 15, 'Add at least 2 specific skills.');
  check(!!user.city, 10, 'Add your city.');
  check(user.experienceYears > 0, 5, 'Add your years of experience.');
  check(user.hourlyRate >= 100 && user.hourlyRate <= 20000, 10, 'Set a realistic hourly rate (Rs 100 to Rs 20,000).');
  const first = (skills[0] || '').toLowerCase().split(' ')[0];
  check(!!first && bio.toLowerCase().includes(first), 10, 'Mention your main skill in your bio.');

  let risky = false;
  const risk = await screenText(`${name}\n${bio}\n${skills.join(' ')}`);
  if (risk.score >= 20) { risky = true; score = Math.max(0, score - 40); notes.push(`Your profile text looks risky: ${risk.reason || 'suspicious wording'}.`); }
  if (bio && await User.exists({ _id: { $ne: user._id }, role: 'freelancer', bio })) { risky = true; score = Math.max(0, score - 40); notes.push('This bio is identical to another profile. Write your own.'); }

  let summary = '';
  const ai = await askJSON(
    'You review freelancer profiles for a marketplace in Pakistan. Return {"quality":0-100,"concerns":string[] (max 3, empty if fine),"summary":string (max 30 words, neutral, describing the profile)}.',
    JSON.stringify({ name, bio, skills, experienceYears: user.experienceYears, hourlyRate: user.hourlyRate, city: user.city }));
  if (ai && typeof ai.quality === 'number') {
    score = Math.round(score * 0.7 + ai.quality * 0.3);
    if (ai.quality < 50) { risky = true; notes.push('The AI reviewer found the bio too vague or inconsistent. Add concrete details about your work.'); }
    for (const c of (ai.concerns || []).slice(0, 3)) if (c && !risky) notes.push(String(c));
    summary = String(ai.summary || '').slice(0, 300);
  }
  const pass = score >= 80 && nameOk && photoOk && bioOk && skillsOk && !risky;
  if (!summary) summary = pass
    ? `Profile reviewed automatically: real-looking name, photo, ${skills.length} skills, ${user.experienceYears} years of experience in ${user.city}.`
    : 'Profile reviewed automatically: some items need fixing before verification.';
  // The AI never verifies by itself: it writes a review for the admin. Passing = "pending admin", failing = "needs changes".
  user.verification = { ...(user.verification?.toObject?.() || {}), status: user.verified ? 'verified' : (pass ? 'pending' : 'needs_changes'), score, summary: pass ? `AI review passed: ${summary}` : summary, notes: pass ? [] : notes, checkedAt: new Date(), aiPassed: pass, requestedAt: new Date() };
  await user.save();
  return user.verification;
}
