import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, getCoords, isRestricted } from '../api';
import { useAuth } from '../auth';
import { Banner, Page } from '../components/ui';

const fromDraft = (r: any, city?: string) => ({ title: r.title, description: r.description, category: r.category, skills: (r.skills || []).join(', '), budget: r.suggestedBudget?.max || '', city: city || '' });

export default function PostGig() {
  const { user } = useAuth(); const nav = useNavigate(); const draft = (useLocation().state as any)?.draft;
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [gig, setGig] = useState<any>(draft ? fromDraft(draft, user?.city) : null); const [questions, setQuestions] = useState<string[]>(draft?.questions || []); const [held, setHeld] = useState(false);
  const generate = async () => {
    setBusy(true); setErr('');
    try { const r = await api('/ai/create-gig', { body: { text } }); setGig(fromDraft(r, user?.city)); setQuestions(r.questions || []); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const publish = async () => {
    setBusy(true); setErr('');
    let pos = {}; try { pos = await getCoords(); } catch { /* your profile location is used */ }
    try {
      const r = await api('/gigs', { body: { ...gig, skills: gig.skills.split(',').map((s: string) => s.trim()).filter(Boolean), budget: +gig.budget, ...pos } });
      if (r.held) setHeld(true); else nav(`/recommendations?gig=${r.gig._id}`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const set = (k: string) => (e: any) => setGig({ ...gig, [k]: e.target.value });
  return (
    <Page title="Post a gig with AI" sub="Describe the work in your own words and AI turns it into a proper job post. You can edit it before publishing.">
      {isRestricted(user) && <div className="mb-4"><Banner tone="error">Your account is restricted until {new Date(user!.restrictedUntil!).toDateString()}. You cannot post gigs right now.</Banner></div>}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="panel space-y-3">
          <label htmlFor="t" className="font-semibold">What do you need done?</label>
          <textarea id="t" className="input" rows={5} maxLength={500} placeholder="I need a logo designed for my bakery, budget 2000" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn" disabled={busy || !text.trim()} onClick={generate}>{busy && !gig ? 'AI is writing…' : 'Create gig with AI'}</button>
          <p className="text-xs text-ink/60">Fair-use rules: up to 5 active gigs, no duplicates, realistic budgets. Fake gigs are removed and can lead to a restriction.</p>
        </div>
        {gig && <div className="panel space-y-3">
          <input className="input" aria-label="Title" value={gig.title} onChange={set('title')} maxLength={120} />
          <textarea className="input" aria-label="Description" rows={5} value={gig.description} onChange={set('description')} maxLength={3000} />
          <input className="input" aria-label="Category" value={gig.category} onChange={set('category')} />
          <input className="input" aria-label="Skills" placeholder="Skills, comma separated" value={gig.skills} onChange={set('skills')} />
          <div className="grid grid-cols-2 gap-3"><input className="input" type="number" min={300} aria-label="Budget in rupees" value={gig.budget} onChange={set('budget')} /><input className="input" aria-label="City" placeholder="City" value={gig.city} onChange={set('city')} /></div>
          {questions.length > 0 && <div className="rounded-lg bg-leaf-soft p-3 text-sm"><p className="font-semibold">Consider adding this to the description:</p><ul className="list-disc pl-5">{questions.map((q) => <li key={q}>{q}</li>)}</ul></div>}
          {held && <Banner>Parts of this post were flagged for review. Our team will check it and you will be notified. <Link className="font-semibold underline" to="/dashboard">Go to dashboard</Link></Banner>}
          <button className="btn" disabled={busy || !gig.title || !gig.budget} onClick={publish}>Publish gig</button>
        </div>}
      </div>
      {err && <div className="mt-3"><Banner tone="error">{err}</Banner></div>}
    </Page>
  );
}
