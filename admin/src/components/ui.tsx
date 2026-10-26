import { ReactNode, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { api, User } from '../api';

export const Page = ({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) => (
  <main className="mx-auto max-w-6xl px-4 py-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold">{title}</h1>{sub && <p className="mt-1 max-w-prose text-ink/70">{sub}</p>}</div>{action}</div>
    <div className="mt-6">{children}</div>
  </main>
);

export const Protected = ({ children, roles }: { children: ReactNode; roles?: string[] }) => {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <p className="p-8">Loading…</p>;
  if (!user) return <Navigate to="/login" />;
  if (!user.onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return <>{children}</>;
};

export const Avatar = ({ u, size = 40 }: { u?: Partial<User> | null; size?: number }) => {
  const [bad, setBad] = useState(false);
  const initial = (u?.name || '?').trim().charAt(0).toUpperCase();
  if (u?._id && u.avatarVersion && !bad) return <img src={`/api/users/${u._id}/avatar?v=${u.avatarVersion}`} alt="" width={size} height={size} loading="lazy" onError={() => setBad(true)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-leaf-soft font-display font-bold text-leaf-dark" style={{ width: size, height: size, fontSize: size * 0.42 }}>{initial}</span>;
};

export const VerifiedBadge = ({ title = 'Profile verified by SkillSpot AI' }: { title?: string }) => (
  <span title={title} className="inline-flex items-center gap-1 rounded-full bg-leaf px-2 py-0.5 text-xs font-semibold text-white">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>Verified
  </span>
);

const TONE: Record<string, string> = {
  requested: 'bg-saffron/30', pending_review: 'bg-saffron/30', accepted: 'bg-leaf-soft text-leaf-dark', in_progress: 'bg-leaf-soft text-leaf-dark', open: 'bg-leaf-soft text-leaf-dark',
  completed: 'bg-leaf text-white', declined: 'bg-ink/10', cancelled: 'bg-ink/10', expired: 'bg-ink/10', closed: 'bg-ink/10', rejected: 'bg-danger/10 text-danger',
};
export const Status = ({ s }: { s: string }) => <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${TONE[s] || 'bg-ink/10'}`}>{s.replace('_', ' ')}</span>;

export const Score = ({ n }: { n: number }) => (
  <div className="flex w-16 flex-col items-center rounded-lg bg-leaf px-2 py-1.5 text-white"><span className="font-display text-xl font-bold leading-none">{n}</span><span className="text-xs">match</span></div>
);
export const Empty = ({ children }: { children: ReactNode }) => <p className="panel text-ink/70">{children}</p>;
export const Banner = ({ tone = 'warn', children }: { tone?: 'warn' | 'error'; children: ReactNode }) => (
  <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${tone === 'error' ? 'bg-danger/10 text-danger' : 'bg-saffron/30'}`}>{children}</p>
);
export const LoadMore = ({ show, busy, onClick }: { show: boolean; busy?: boolean; onClick: () => void }) =>
  show ? <button className="btn-alt mx-auto mt-4 block" disabled={busy} onClick={onClick}>{busy ? 'Loading…' : 'Load more'}</button> : null;

// Report dialog used on profiles, gigs and chat messages
export function ReportDialog({ targetType, target, onClose }: { targetType: 'user' | 'gig' | 'message'; target: string; onClose: () => void }) {
  const [reason, setReason] = useState('scam'); const [details, setDetails] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const submit = async () => {
    setBusy(true); setMsg('');
    try { await api('/reports', { body: { targetType, target, reason, details } }); setDone(true); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Report">
      <div className="panel w-full max-w-md space-y-3">
        <h2 className="text-xl font-bold">Report this {targetType}</h2>
        {done ? <p>Thank you. Our safety team will review your report.</p> : <>
          <select className="input" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="scam">Scam or asks for money / OTP / CNIC</option><option value="fake_gig">Fake gig</option><option value="time_waster">Wastes my time</option>
            <option value="harassment">Harassment</option><option value="spam">Spam</option><option value="other">Something else</option>
          </select>
          <textarea className="input" rows={3} placeholder="Details (optional)" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
          {msg && <Banner tone="error">{msg}</Banner>}
        </>}
        <div className="flex justify-end gap-2">{!done && <button className="btn" disabled={busy} onClick={submit}>Send report</button>}<button className="btn-alt" onClick={onClose}>{done ? 'Close' : 'Cancel'}</button></div>
      </div>
    </div>
  );
}
