import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, pkr, timeAgo, useOpenChat } from '../api';
import { useRealtime } from '../realtime';
import { Avatar, Banner, Status, VerifiedBadge } from './ui';

const hoursLeft = (iso?: string) => Math.max(0, Math.ceil((new Date(iso || 0).getTime() - Date.now()) / 36e5));

// One hire request / job, with the actions that make sense for the viewer's role
export default function BookingCard({ b, role, onChange }: { b: any; role: 'client' | 'freelancer'; onChange: () => void }) {
  const openChat = useOpenChat(); const { refresh } = useRealtime();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [rating, setRating] = useState(5); const [review, setReview] = useState(''); const [rate, setRate] = useState(false);
  const [method, setMethod] = useState('easypaisa');
  const other = role === 'client' ? b.freelancer : b.client;
  const pay = b.payment;
  const payNow = async () => {
    setBusy(true); setErr('');
    try { await api(`/payments/${pay._id}/pay`, { body: { method } }); refresh(); onChange(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const act = async (status: string, extra: object = {}) => {
    setBusy(true); setErr('');
    try { await api(`/bookings/${b._id}`, { method: 'PATCH', body: { status, ...extra } }); refresh(); onChange(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const cancelJob = () => { if (confirm(role === 'client' ? 'Cancel this accepted job? Repeated cancellations after acceptance restrict your account.' : 'Cancel this accepted job? Repeated cancellations restrict your account.')) act('cancelled'); };
  return (
    <article className="panel space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar u={other} size={48} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {role === 'client' && other?._id ? <Link className="hover:underline" to={`/freelancer/${other._id}`}>{other?.name || 'Freelancer'}</Link> : <span>{other?.name || 'Client'}</span>}
            {other?.verified && <VerifiedBadge />}
          </p>
          <p className="text-sm text-ink/70">{b.gig?.title || 'Job'} · {pkr(b.price)} · {timeAgo(b.createdAt)}</p>
          {b.note && <p className="mt-1 text-sm">“{b.note}”</p>}
        </div>
        <Status s={b.status} />
      </div>
      {b.status === 'requested' && <p className="text-sm text-ink/60">{role === 'freelancer' ? `Reply within ${hoursLeft(b.expiresAt)} hours or the request expires.` : `Waiting for a reply. Expires in ${hoursLeft(b.expiresAt)} hours.`}</p>}
      {b.status === 'completed' && b.rating && <p className="text-sm">Rated {b.rating}/5{b.review ? `: “${b.review}”` : ''}</p>}
      {err && <Banner tone="error">{err}</Banner>}
      {pay && (
        <div className="space-y-2 rounded-lg bg-mist p-3 text-sm">
          {pay.status === 'pending' && b.status === 'accepted' && (role === 'client' ? <>
            <p><b>Next step: pay {pkr(pay.amount)}.</b> Your money stays safe with SkillSpot until you confirm the job is done.</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className="input max-w-[200px]" aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option><option value="card">Card</option><option value="bank">Bank transfer</option>
              </select>
              <button className="btn" disabled={busy} onClick={payNow}>Pay {pkr(pay.amount)}</button>
            </div>
            <p className="text-ink/60">Test mode: no real money moves yet.</p>
          </> : <p>Waiting for the client to pay. Start the work once the payment is secured.</p>)}
          {pay.status === 'held' && <p><b>Payment secured:</b> {pkr(pay.amount)} is held by SkillSpot{role === 'freelancer' ? `. You receive ${pkr(pay.freelancerNet)} after commission ${pkr(pay.commission)} and tax ${pkr(pay.tax)}.` : ' until you mark the job complete.'}{pay.reference && <span className="text-ink/60"> Ref: {pay.reference}</span>}</p>}
          {pay.status === 'released' && <p>{role === 'freelancer' ? `Paid: ${pkr(pay.freelancerNet)} (${pkr(pay.amount)} minus commission ${pkr(pay.commission)} and tax ${pkr(pay.tax)}).` : `Paid ${pkr(pay.amount)}. The money was released to the freelancer.`}</p>}
          {pay.status === 'refunded' && <p>Refunded: {pkr(pay.amount)} was returned to the client.</p>}
        </div>)}
      {role === 'client' && b.status === 'accepted' && !pay && <p className="text-sm text-ink/60">No payment record was found for this job. Cancel it and send a new request to pay safely in SkillSpot.</p>}
      <div className="flex flex-wrap gap-2">
        {role === 'freelancer' && b.status === 'requested' && <><button className="btn" disabled={busy} onClick={() => act('accepted')}>Accept</button><button className="btn-alt" disabled={busy} onClick={() => act('declined')}>Decline</button></>}
        {role === 'client' && b.status === 'requested' && <button className="btn-alt" disabled={busy} onClick={() => act('cancelled')}>Withdraw request</button>}
        {role === 'client' && b.status === 'accepted' && pay?.status === 'held' && <button className="btn" disabled={busy} onClick={() => setRate(!rate)}>Mark complete &amp; rate</button>}
        {b.status === 'accepted' && <button className="btn-alt" disabled={busy} onClick={cancelJob}>Cancel job</button>}
        {['requested', 'accepted'].includes(b.status) && other?._id && <button className="btn-alt" onClick={() => openChat(other._id)}>Message</button>}
      </div>
      {rate && (
        <div className="space-y-2 rounded-lg bg-mist p-3">
          <label className="block font-medium" htmlFor={`r${b._id}`}>Rating</label>
          <select id={`r${b._id}`} className="input max-w-[140px]" value={rating} onChange={(e) => setRating(+e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select>
          <textarea className="input" rows={2} maxLength={500} placeholder="Short review (optional)" value={review} onChange={(e) => setReview(e.target.value)} />
          <button className="btn" disabled={busy} onClick={() => act('completed', { rating, review })}>Submit</button>
        </div>)}
    </article>
  );
}
