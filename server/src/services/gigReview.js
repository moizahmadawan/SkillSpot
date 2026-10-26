import { screenText } from './safety.js';
import { askJSON } from './ai.js';
import { BUDGET_RANGE } from '../categories.js';

const PROHIBITED = /\b(porn\w*|nude|escort|weapons?|guns?|drugs?|heroin|cocaine|gambl\w+|betting|fake (cnic|degree|passport|certificate|id)|hack(ing)? (a |the )?(facebook|instagram|whatsapp|account)|money laundering|loan shark)\b/i;

// AI + rule review of every new gig. If something looks wrong the gig is held and the admin sees WHY.
export async function reviewGig({ title, description, category, budget }) {
  const reasons = []; let score = 0;
  const text = `${title}\n${description}`;
  const safety = await screenText(text);
  if (safety.score >= 20) { score += safety.score; reasons.push(...safety.reasons); }
  if (PROHIBITED.test(text)) { score += 60; reasons.push('Looks like a prohibited or illegal service'); }
  const range = BUDGET_RANGE[category];
  if (range && budget > range[1]) { score += 35; reasons.push(`Budget Rs ${budget.toLocaleString()} is unusually high for ${category}`); }
  if (String(description).trim().split(/\s+/).length < 5) { score += 10; reasons.push('Description is very short'); }
  if ((title.match(/[A-Z]/g) || []).length > title.length * 0.7 && title.length > 12) { score += 10; reasons.push('Title is written in capital letters (spam style)'); }
  if (/(.)\1{5,}/.test(text)) { score += 10; reasons.push('Repeated characters (spam style)'); }
  const ai = await askJSON(
    'You check job posts for a marketplace in Pakistan. Flag scams, illegal or unsafe requests, requests to pay before work, requests to move chat off-platform, and posts that make no sense. Return {"ok":boolean,"problems":string[] (max 3),"summary":string (max 25 words)}.',
    JSON.stringify({ title, description, category, budget }));
  if (ai && ai.ok === false) { score += 40; for (const p of (ai.problems || []).slice(0, 3)) if (p) reasons.push(`AI: ${p}`); }
  score = Math.min(100, score);
  const flagged = score >= 35;
  return { flagged, score, reasons, summary: flagged ? `AI flagged this gig: ${reasons.join('; ')}.` : 'AI found no problems with this gig.' };
}
