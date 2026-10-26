import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Gig from '../models/Gig.js';
import Booking from '../models/Booking.js';
import { auth, needOnboarded, needRole, limit } from '../middleware/auth.js';
import { askText, createGigFromText, skillAdvice, explainMatches } from '../services/ai.js';
import { matchFreelancersForGig, matchGigsForFreelancer } from '../services/matching.js';
import { screenText } from '../services/safety.js';
import { HttpError, isId, oneLine, publicUser, publicGig } from '../utils.js';
const r = Router();

// Public demo on the home page (strict per-IP limit)
r.post('/create-gig', rateLimit({ windowMs: 60_000, limit: 10, validate: false, message: { error: 'Too many requests, try again in a minute.' } }), async (req, res) => {
  const text = oneLine(req.body.text, 500);
  if (!text) throw new HttpError(400, 'Please describe the job');
  res.json(await createGigFromText(text));
});

r.post('/skill-assistant', auth(), needRole('freelancer'), needOnboarded, limit(60e3, 6), async (req, res) => {
  const u = req.user;
  res.json(await skillAdvice({ skills: u.skills, experienceYears: u.experienceYears, bio: u.bio, city: u.city }));
});

// Matching engine: a client's gig -> best freelancers (+ short AI explanation)
r.get('/match/gig/:id', auth(), needRole('client'), needOnboarded, limit(60e3, 20), async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(404, 'Gig not found');
  const gig = await Gig.findOne({ _id: req.params.id, owner: req.user._id });
  if (!gig) throw new HttpError(404, 'Gig not found');
  const top = await matchFreelancersForGig(gig);
  const reasons = await explainMatches(gig, top);
  res.json(top.map((m) => ({ freelancer: publicUser(m.user), score: m.score, distanceKm: m.distanceKm, breakdown: m.breakdown, reason: reasons[String(m.user._id)] || null })));
});
// Matching engine: a freelancer -> best open gigs
r.get('/match/jobs', auth(), needRole('freelancer'), needOnboarded, limit(60e3, 20), async (req, res) => {
  const top = await matchGigsForFreelancer(req.user);
  res.json(top.map((m) => ({ gig: publicGig(m.gig), score: m.score, distanceKm: m.distanceKm, breakdown: m.breakdown })));
});
r.post('/screen', auth(), limit(60e3, 20), async (req, res) => res.json(await screenText(oneLine(req.body.text, 2000))));

// ---- SkillSpot AI assistant (role aware) ----
const HELP = {
  client: 'I can turn your request into a gig draft, suggest a fair budget, and help you pick a freelancer. Try: "I need a logo for my bakery, budget 3000".',
  freelancer: 'I can find jobs that match your skills, improve your profile and bio, and help you get verified. Try: "Find jobs for me" or "Improve my profile".',
};
r.post('/assistant', auth(), needOnboarded, limit(60e3, 12, 'Slow down a little. You can ask again in a minute.'), async (req, res) => {
  const u = req.user;
  if (!['client', 'freelancer'].includes(u.role)) throw new HttpError(403, 'The assistant is for clients and freelancers');
  const message = oneLine(req.body.message, 600);
  if (!message) throw new HttpError(400, 'Type a message');
  let history = (Array.isArray(req.body.history) ? req.body.history : []).slice(-6)
    .map((h) => ({ role: h?.role === 'ai' ? 'assistant' : 'user', content: oneLine(h?.text, 600) })).filter((h) => h.content);
  while (history.length && history[0].role !== 'user') history.shift();

  let draft = null, extra = '', actions = [];
  if (u.role === 'client') {
    if (message.length >= 12 && /(need|want|looking|hire|budget|chahiye|karwana|banwani|banwana|repair|fix)/i.test(message)) {
      draft = await createGigFromText(message);
      extra = `Here is a draft: "${draft.title}" in ${draft.category}, suggested budget Rs ${draft.suggestedBudget?.min?.toLocaleString()} to Rs ${draft.suggestedBudget?.max?.toLocaleString()}.`;
      actions = [{ label: 'Use this draft', to: '/post' }];
    } else actions = [{ label: 'Find freelancers', to: '/skills' }, { label: 'Post a gig', to: '/post' }];
  } else {
    if (/(job|work|gig|find|match|opportunit)/i.test(message)) {
      const top = (await matchGigsForFreelancer(u, 3));
      extra = top.length ? `Best open jobs for you right now: ${top.map((m) => `"${m.gig.title}" (Rs ${m.gig.budget?.toLocaleString()}, match ${m.score})`).join('; ')}.` : 'There are no open jobs matching your skills yet. Add more skills to your profile.';
      actions = [{ label: 'See all matches', to: '/recommendations' }];
    } else if (/(profile|bio|improve|verif|skill|rate|price)/i.test(message)) {
      const a = await skillAdvice({ skills: u.skills, experienceYears: u.experienceYears, bio: u.bio, city: u.city });
      extra = `Tips: ${a.profileTips.slice(0, 3).join(' ')} Suggested rate: Rs ${a.suggestedHourlyRate}/hr.`;
      actions = [{ label: 'Open my profile', to: '/settings' }];
    } else actions = [{ label: 'Find jobs', to: '/gigs' }, { label: 'Edit profile', to: '/settings' }];
  }

  const system = `You are SkillSpot AI, the assistant inside a Pakistani micro-gig marketplace. The user is a ${u.role} (${u.city || 'unknown city'}${u.role === 'freelancer' ? `, skills: ${(u.skills || []).join(', ') || 'none yet'}, verified: ${u.verified}` : ''}). Answer in English, in at most 90 words, practical and friendly. Never ask for or share phone numbers, CNIC, OTP or payments outside the platform, and warn about advance-payment scams when relevant. ${extra ? `Facts you can use: ${extra}` : ''}`;
  const llm = await askText(system, [...history, { role: 'user', content: message }]);
  const reply = llm || [extra, !extra ? HELP[u.role] : ''].filter(Boolean).join(' ');
  res.json({ reply, draft, actions });
});
export default r;
