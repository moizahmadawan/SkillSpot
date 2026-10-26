import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Banner, VerifiedBadge } from './ui';

// Automatic AI profile check for freelancers (profile quality and safety, not a CNIC check)
export default function VerificationCard() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  if (!user || user.role !== 'freelancer') return null;
  const v = user.verification, ok = user.verified;
  const run = async () => { setBusy(true); setErr(''); try { await api('/users/me/verify', { method: 'POST', body: {} }); await refresh(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <section className="panel space-y-3" aria-label="Profile verification">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Profile verification</h2>
        {ok ? <VerifiedBadge /> : <span className="chip">{v?.status === 'revoked' ? 'Removed' : v?.status === 'needs_changes' ? 'Needs changes' : 'Not verified'}</span>}
      </div>
      {ok
        ? <p className="text-sm">{v?.summary || 'Your profile passed the automatic check.'} Clients see a Verified badge and you rank higher in matches. Editing your name, bio or skills triggers a new check automatically.</p>
        : <p className="text-sm text-ink/75">SkillSpot AI reviews your photo, name, bio, skills and rate, and checks for scam wording. When everything passes, your profile is verified automatically.</p>}
      {!ok && !!v?.notes?.length && <div className="rounded-lg bg-saffron/25 p-3 text-sm"><p className="font-semibold">Fix these, then run the check again:</p><ul className="mt-1 list-disc pl-5">{v.notes.map((n) => <li key={n}>{n}</li>)}</ul></div>}
      {v?.score != null && <p className="text-sm text-ink/60">Last check score: {v.score}/100</p>}
      {err && <Banner tone="error">{err}</Banner>}
      {!ok && <button className="btn" disabled={busy} onClick={run}>{busy ? 'AI is reviewing your profile…' : 'Run AI profile check'}</button>}
    </section>
  );
}
