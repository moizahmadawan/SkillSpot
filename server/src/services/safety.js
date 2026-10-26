import { askJSON } from './ai.js';
const RULES = [
  [/(advance|pehle|pehly).{0,20}(payment|paise|rupay|fee)|registration fee|security (deposit|fee)/i, 'Asks for an advance or upfront fee', 35],
  [/(easypaisa|jazzcash|bank account|iban|cnic|otp|pin code).{0,40}(bhej|send|share)|send.{0,20}(otp|cnic|pin)/i, 'Asks for sensitive financial or identity details', 60],
  [/\b(share|send|give|tell|bhej\w*)\b.{0,25}\b(otp|cnic|password|cvv|card number|atm pin)\b|\b(your|apna|apni)\s+(otp|cnic|password|cvv|atm pin)\b/i, 'Asks for an OTP, CNIC or password', 40],
  [/whatsapp|telegram|t\.me|wa\.me|\+?92\d{10}|03\d{9}/i, 'Tries to move contact off the platform', 20],
  [/guaranteed|100% (profit|income)|earn \d+.{0,15}(daily|per day)|rozana.{0,10}\d{4,}/i, 'Promises unrealistic earnings', 35],
  [/crypto|bitcoin|investment|double your money|lottery|prize/i, 'Looks like an investment scheme', 30],
  [/click (this )?link|bit\.ly|tinyurl/i, 'Suspicious link', 25],
];
export async function screenText(text) {
  const reasons = []; let score = 0;
  for (const [re, why, pts] of RULES) if (re.test(text)) { reasons.push(why); score += pts; }
  if (score >= 20 && process.env.ANTHROPIC_API_KEY) {
    const ai = await askJSON('You are a fraud analyst for a Pakistani gig marketplace. Return {"scam_likelihood":0-100,"reason":string}', text);
    if (ai?.scam_likelihood != null) { score = Math.round((score + ai.scam_likelihood) / 2); if (ai.reason) reasons.push(ai.reason); }
  }
  score = Math.min(100, score);
  return { score, reasons, flagged: score >= 35, reason: reasons.join('; ') };
}

// Phone numbers, links and handles: used to keep gigs and profiles from pushing people off the platform.
export const CONTACT_RE = /(\+?\d[\d\s-]{8,}\d)|https?:\/\/|www\.|bit\.ly|wa\.me|t\.me|@\w+\.\w+/i;
export const hasContactInfo = (t) => CONTACT_RE.test(String(t || ''));

// Hides phone numbers and links in chat until a hire request is accepted, so deals stay on the platform.
export function redactContacts(text) {
  let hidden = false;
  const hide = (label) => () => { hidden = true; return label; };
  const out = String(text)
    .replace(/https?:\/\/\S+|www\.\S+|\b(?:wa\.me|t\.me|bit\.ly|tinyurl\.com)\/\S*/gi, hide('[link hidden]'))
    .replace(/(?:\+?\d[\s-]?){10,}/g, hide('[number hidden]'));
  return { text: out, hidden };
}
