// LLM wrapper (Anthropic Messages API). Returns null when there is no key or the call fails, so callers fall back to rule-based logic.
export async function askJSON(system, user) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 1000,
        system: system + '\nRespond with ONLY valid JSON, no markdown fences.',
        messages: [{ role: 'user', content: user }],
      }),
    });
    const d = await r.json();
    const text = (d.content || []).map((c) => c.text || '').join('').replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) { console.warn('AI call failed:', e.message); return null; }
}

import { CATEGORY_NAMES } from '../categories.js';
export const CATEGORIES = CATEGORY_NAMES;

const KEYWORDS = {
  'Graphic Design': ['logo', 'design', 'poster', 'banner', 'flyer', 'canva', 'photoshop', 'branding'],
  'Web Development': ['website', 'web', 'wordpress', 'react', 'shopify'],
  'Mobile Apps': ['mobile app', 'android', 'ios', 'flutter', 'react native'],
  'Digital Marketing': ['seo', 'ads', 'marketing', 'facebook', 'instagram'],
  'Writing & Translation': ['article', 'translate', 'translation', 'content', 'likhna', 'writing', 'blog'],
  'Video & Animation': ['video', 'edit', 'reel', 'animation'],
  Photography: ['photo', 'shoot', 'camera', 'wedding photographer'],
  'Tutoring & Teaching': ['tuition', 'tutor', 'padhai', 'teacher', 'math', 'quran'],
  Electrician: ['bijli', 'electrician', 'wiring', 'fan', 'switch', 'ups', 'solar'],
  Plumbing: ['plumber', 'nalka', 'pipe', 'leak', 'tap', 'geyser'],
  Carpentry: ['carpenter', 'furniture', 'cupboard', 'door'],
  Painting: ['paint', 'painter', 'polish', 'rang'],
  'AC & Appliance Repair': ['ac ', 'air conditioner', 'fridge', 'refrigerator', 'washing machine'],
  'Cleaning & Home Services': ['safai', 'clean', 'pest', 'garden', 'laundry'],
  'Delivery & Errands': ['delivery', 'parcel', 'errand', 'saman', 'shifting'],
  'Tailoring & Fashion': ['tailor', 'stitch', 'silai', 'alteration', 'embroidery'],
  'Event Planning': ['event', 'wedding', 'decor', 'catering', 'mehndi', 'dj'],
  'Data Entry & VA': ['data entry', 'typing', 'excel', 'virtual assistant'],
  'Car & Bike Repair': ['car', 'bike', 'mechanic', 'tyre', 'denting'],
  'Beauty & Makeup': ['makeup', 'bridal', 'hair', 'salon', 'beautician'],
  'Accounting & Legal': ['accounting', 'tax', 'bookkeeping', 'lawyer', 'contract'],
};

export async function createGigFromText(text) {
  const ai = await askJSON(
    `You convert Roman Urdu / Urdu / English requests into a marketplace job post for Pakistan. Return JSON: {"title":string,"description":string (3-5 clear sentences, English),"category":one of ${JSON.stringify(CATEGORIES)},"skills":string[] (3-6),"suggestedBudget":{"min":number,"max":number} in PKR,"questions":string[] (max 3 clarifying questions)}`, text);
  if (ai?.title) return ai;
  // fallback
  const t = text.toLowerCase();
  const category = Object.entries(KEYWORDS).find(([, ws]) => ws.some((w) => t.includes(w)))?.[0] || 'Other';
  const m = t.match(/(\d[\d,]*)/); const b = m ? parseInt(m[1].replace(/,/g, '')) : 2000;
  return {
    title: text.length > 60 ? text.slice(0, 57) + '...' : text,
    description: `Client needs help with: ${text}. Please share relevant past work, expected timeline and your price before starting.`,
    category, skills: [category], suggestedBudget: { min: Math.round(b * 0.8), max: Math.round(b * 1.3) }, questions: ['What is the deadline?', 'Do you have a reference or example?'],
  };
}

export async function skillAdvice(profile) {
  const ai = await askJSON(
    `You are a career coach for freelancers in Pakistan. Return JSON: {"categories":string[] (best 3 from ${JSON.stringify(CATEGORIES)}),"profileTips":string[] (3-5 concrete improvements),"learning":[{"topic":string,"why":string}] (3 items),"suggestedHourlyRate":number (PKR),"bioDraft":string}`,
    JSON.stringify(profile));
  if (ai?.categories) return ai;
  const t = (profile.skills || []).join(' ').toLowerCase();
  const cats = Object.entries(KEYWORDS).filter(([, ws]) => ws.some((w) => t.includes(w))).map(([c]) => c).slice(0, 3);
  return {
    categories: cats.length ? cats : ['Other'],
    profileTips: ['Add a profile photo and 3 work samples', 'Mention your city and turnaround time in your bio', 'Keep skills specific (e.g. "Logo design in Illustrator")'],
    learning: [{ topic: 'Client communication', why: 'Better reviews and repeat clients' }, { topic: 'Portfolio building', why: 'Builds trust faster' }],
    suggestedHourlyRate: 500 + (profile.experienceYears || 0) * 150,
    bioDraft: `${profile.experienceYears || 0}+ years of experience in ${(profile.skills || []).slice(0, 3).join(', ')}. Based in ${profile.city || 'Pakistan'} and ready to help.`,
  };
}

export async function explainMatches(gig, top) {
  const ai = await askJSON(
    'For each candidate write ONE short sentence (max 20 words, English) explaining why they fit the job. Return JSON: {"reasons":{"<id>":"sentence"}}',
    JSON.stringify({ gig: { title: gig.title, skills: gig.skills, budget: gig.budget, city: gig.city }, candidates: top.map((c) => ({ id: String(c.user._id), name: c.user.name, skills: c.user.skills, exp: c.user.experienceYears, km: c.distanceKm, breakdown: c.breakdown })) }));
  return ai?.reasons || {};
}

// Free-text LLM answer (used by the SkillSpot AI assistant). Returns null without a key or on failure.
export async function askText(system, messages) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 600, system, messages }),
    });
    const d = await r.json();
    const text = (d.content || []).map((c) => c.text || '').join('').trim();
    return text || null;
  } catch (e) { console.warn('AI text call failed:', e.message); return null; }
}
