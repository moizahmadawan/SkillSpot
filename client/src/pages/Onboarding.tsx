import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Banner, Page } from '../components/ui';

const CARDS = [
  { role: 'client', title: 'I want to hire', text: 'Post gigs, get AI-matched freelancers nearby, book and chat.' },
  { role: 'freelancer', title: 'I want to work', text: 'Build a profile, get verified by AI, receive hire requests and find jobs.' },
] as const;

export default function Onboarding() {
  const { user, refresh } = useAuth(); const nav = useNavigate();
  const [role, setRole] = useState<'client' | 'freelancer' | ''>(''); const [name, setName] = useState(''); const [city, setCity] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (user?.onboarded) return <Navigate to="/dashboard" />;
  const go = async () => {
    setBusy(true); setErr('');
    try { await api('/users/onboard', { body: { role, name, city } }); await refresh(); nav('/dashboard'); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Page title="Set up your account" sub="Choose how you will use SkillSpot AI.">
      <div className="grid max-w-3xl gap-4 md:grid-cols-2" role="radiogroup" aria-label="Account type">
        {CARDS.map((c) => (
          <button key={c.role} role="radio" aria-checked={role === c.role} onClick={() => setRole(c.role)} className={`panel text-left transition ${role === c.role ? 'border-leaf ring-2 ring-leaf' : 'hover:border-leaf'}`}>
            <h2 className="text-xl font-bold">{c.title}</h2><p className="mt-1 text-ink/75">{c.text}</p>
          </button>))}
      </div>
      <div className="panel mt-4 max-w-3xl space-y-3">
        <label className="block font-medium" htmlFor="nm">Full name</label>
        <input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
        <label className="block font-medium" htmlFor="ct">City</label>
        <input id="ct" className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="Lahore, Karachi, Islamabad…" />
        <Banner>This choice is permanent for your phone number. You cannot switch between client and freelancer later.</Banner>
        {err && <Banner tone="error">{err}</Banner>}
        <button className="btn" disabled={busy || !role || name.trim().length < 2 || !city.trim()} onClick={go}>Continue</button>
      </div>
    </Page>
  );
}
