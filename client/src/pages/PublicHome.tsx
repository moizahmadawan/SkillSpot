import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function PublicHome() {
  const [text, setText] = useState('I need a logo designed for my bakery, budget 2000');
  const [out, setOut] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const run = async () => { setBusy(true); setErr(''); try { setOut(await api('/ai/create-gig', { body: { text } })); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <main>
      <section className="bg-leaf text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">Describe the job. Find the right person in your city.</h1>
            <p className="mt-4 max-w-md text-lg text-white/85">Write in English or Roman Urdu. AI turns it into a job post, then suggests the best freelancers based on skills, location, budget and availability.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/login" className="rounded-lg bg-saffron px-5 py-3 font-semibold text-ink hover:brightness-95">Get started</Link>
              <Link to="/skills" className="rounded-lg border border-white/50 px-5 py-3 font-semibold hover:bg-white/10">Find freelancers</Link>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 text-ink shadow-xl">
            <label htmlFor="demo" className="font-semibold">Try it: describe your job</label>
            <textarea id="demo" className="input mt-2" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn mt-3" onClick={run} disabled={busy || !text.trim()}>{busy ? 'AI is thinking…' : 'Create gig'}</button>
            {err && <p role="alert" className="mt-2 text-danger">{err}</p>}
            {out && <div className="mt-4 rounded-lg bg-mist p-4 text-sm">
              <p className="font-display text-lg font-bold">{out.title}</p><p className="mt-1 text-ink/80">{out.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5"><span className="chip">{out.category}</span>{out.skills?.map((s: string) => <span key={s} className="chip">{s}</span>)}</div>
              <p className="mt-2 font-semibold">Suggested budget: Rs {out.suggestedBudget?.min?.toLocaleString()} to {out.suggestedBudget?.max?.toLocaleString()}</p>
            </div>}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-12 md:grid-cols-2">
        <div className="panel"><h2 className="text-xl font-bold">I want to hire</h2><p className="mt-1 text-ink/75">Post a gig, get AI-matched freelancers nearby, send a hire request and chat privately. Verified freelancers are marked with a badge.</p></div>
        <div className="panel"><h2 className="text-xl font-bold">I want to work</h2><p className="mt-1 text-ink/75">Build a profile, get verified by AI, receive hire requests with instant notifications, and find jobs that match your skills.</p></div>
        {[['Smart matching', 'Every freelancer gets a score based on skills, distance, budget, experience and rating, with a short note on why they fit.'],
          ['Safe by design', 'One account per phone number, private chats, hidden contact details until a job is accepted, and scam and fake-gig checks with human review.']]
          .map(([t, d]) => <div key={t} className="panel"><h3 className="text-xl font-bold">{t}</h3><p className="mt-1 text-ink/75">{d}</p></div>)}
      </section>
    </main>
  );
}
