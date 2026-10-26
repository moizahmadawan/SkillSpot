import Payment from '../models/Payment.js';
import Conversation from '../models/Conversation.js';
import { MONEY } from '../config.js';
import { HttpError, money } from '../utils.js';
import { notify } from './notify.js';
import { postSystemMessage } from './chat.js';

export const METHODS = ['easypaisa', 'jazzcash', 'card', 'bank'];
export function amountsFor(amount) {
  const commission = money(amount * MONEY.commissionRate), tax = money(amount * MONEY.taxRate);
  return { commissionRate: MONEY.commissionRate, commission, taxRate: MONEY.taxRate, tax, freelancerNet: money(amount) - commission - tax };
}
export async function ensurePayment(b) {
  const amount = money(b.price);
  return Payment.findOneAndUpdate({ booking: b._id }, { $setOnInsert: { booking: b._id, client: b.client, freelancer: b.freelancer, title: b.title, amount, ...amountsFor(amount), status: 'pending' } }, { upsert: true, new: true });
}
const system = async (app, pay, from, to, text) => {
  const conv = await Conversation.findOne({ key: [String(pay.client), String(pay.freelancer)].sort().join('_') });
  if (conv) await postSystemMessage(app, conv, from, to, text);
};
// TEST MODE payment: records the money as "held" by SkillSpot until the client confirms the job is done.
export async function payPayment(app, pay, method) {
  if (pay.status !== 'pending') throw new HttpError(409, `This payment is already ${pay.status}.`);
  if (!METHODS.includes(method)) throw new HttpError(400, 'Choose a payment method');
  pay.status = 'held'; pay.method = method; pay.paidAt = new Date(); pay.reference = `SSP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await pay.save();
  await notify(app, pay.freelancer, { type: 'payment_held', title: 'Payment secured', body: `Rs ${pay.amount.toLocaleString()} for "${pay.title}" is held safely by SkillSpot. You can start working.`, link: '/bookings' });
  await system(app, pay, pay.client, pay.freelancer, `Payment of Rs ${pay.amount.toLocaleString()} is secured in SkillSpot (test mode).`);
  return pay;
}
export async function releasePayment(app, pay) {
  pay.status = 'released'; pay.releasedAt = new Date(); pay.commissionStatus = 'received';
  await pay.save();
  await notify(app, pay.freelancer, { type: 'payment_released', title: 'Payment released to you', body: `Rs ${pay.freelancerNet.toLocaleString()} for "${pay.title}" (after ${Math.round(pay.commissionRate * 100)}% commission and tax).`, link: '/payments' });
  return pay;
}
export async function closePayment(app, pay, reason) {
  if (!pay || !['pending', 'held'].includes(pay.status)) return pay;
  const wasHeld = pay.status === 'held';
  pay.status = wasHeld ? 'refunded' : 'cancelled'; pay.commissionStatus = 'none'; await pay.save();
  if (wasHeld) await notify(app, pay.client, { type: 'payment_refunded', title: 'Payment refunded', body: `Rs ${pay.amount.toLocaleString()} for "${pay.title}" was refunded (${reason}).`, link: '/payments' });
  return pay;
}
