import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Banner, Page } from '../components/ui';

type Turn = { role: 'user' | 'ai'; text: string; draft?: any; actions?: { label: string; to: string }[] };
const PROMPTS = {
  client: ['I need a logo for my bakery, budget 3000', 'How do I avoid scams when hiring?', 'How much should a plumber visit cost?'],
  freelancer: ['Find jobs for me', 'Improve my profile', 'How do I get verified?'],
};

// The SkillSpot AI assistant: role aware, uses your real gigs, jobs and profile
export default function AIAssistant() {
  const { user } = useAuth(); const nav = useNavigate(); const role = user!.role === 'freelancer' ? 'freelancer' : 'client';
  const [turns, setTurns] = useState<Turn[]>([{ role: 'ai', text: role === 'client' ? `Hi ${user!.name?.split(' ')[0] || ''}! Tell me what you need done and I will draft the gig, suggest a budget and help you find the right freelancer.` : `Hi ${user!.name?.split(' ')[0] || ''}! I can find jobs that match your skills, improve your profile and help you get verified.` }]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, busy]);
  const ask = async (q: string) => {
    const message = q.trim(); if (!message || busy) return;
    setErr(''); setText(''); setBusy(true);
    const history = turns.slice(-6).map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: 'user', text: message }]);
    try { const r = await api('/ai/assistant', { body: { message, history } }); setTurns((t) => [...t, { role: 'ai', text: r.reply, draft: r.draft, actions: r.actions }]); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Page title="SkillSpot AI" sub={role === 'client' ? 'Your hiring assistant.' : 'Your freelancing assistant.'}>
      <div className="panel flex h-[calc(100vh-14rem)] min-h-[420px] max-w-3xl flex-col !p-0">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 ${t.role === 'user' ? 'rounded-br-sm bg-leaf text-white' : 'rounded-bl-sm bg-mist'}`}>
                <p className="whitespace-pre-wrap">{t.text}</p>
                {t.draft && <div className="rounded-lg bg-white p-3 text-sm text-ink"><p className="font-bold">{t.draft.title}</p><p className="mt-1 text-ink/75">{t.draft.description}</p><p className="mt-1 font-semibold">Rs {t.draft.suggestedBudget?.min?.toLocaleString()} to {t.draft.suggestedBudget?.max?.toLocaleString()}</p>
                  <button className="btn mt-2 !py-1.5" onClick={() => nav('/post', { state: { draft: t.draft } })}>Use this draft</button></div>}
                {!t.draft && t.actions?.map((a) => <Link key={a.to + a.label} to={a.to} className="mr-2 inline-block rounded-full bg-white px-3 py-1 text-sm font-semibold text-leaf-dark">{a.label}</Link>)}
              </div>
            </div>))}
          {busy && <p className="text-sm text-ink/60">SkillSpot AI is thinking…</p>}
          <div ref={end} />
        </div>
        <div className="space-y-2 border-t border-ink/10 p-3">
          {turns.length < 3 && <div className="flex flex-wrap gap-2">{PROMPTS[role].map((p) => <button key={p} className="rounded-full border border-ink/20 px-3 py-1 text-sm hover:bg-leaf-soft" onClick={() => ask(p)}>{p}</button>)}</div>}
          {err && <Banner tone="error">{err}</Banner>}
          <div className="flex gap-2"><input className="input" aria-label="Ask SkillSpot AI" placeholder="Ask anything about your jobs or profile…" value={text} maxLength={600} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask(text)} /><button className="btn" disabled={busy || !text.trim()} onClick={() => ask(text)}>Send</button></div>
        </div>
      </div>
    </Page>
  );
}
