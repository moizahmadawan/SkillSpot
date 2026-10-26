import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Gig, pkr, qs, useOpenChat } from '../api';
import { useAuth } from '../auth';
import { Empty, LoadMore, Page, ReportDialog } from '../components/ui';

const CATS = ['Graphic Design', 'Web Development', 'Writing & Translation', 'Video & Animation', 'Digital Marketing', 'Home Services', 'Electrician', 'Plumbing', 'Tutoring', 'Delivery & Errands', 'Photography', 'Other'];
export default function ExploreGigs() {
  const { user } = useAuth(); const openChat = useOpenChat();
  const [f, setF] = useState({ q: '', category: '', city: '', maxBudget: '' });
  const [gigs, setGigs] = useState<Gig[]>([]); const [page, setPage] = useState(1); const [more, setMore] = useState(false); const [busy, setBusy] = useState(true); const [report, setReport] = useState('');
  const fetchPage = (p: number) => { setBusy(true); api(`/gigs?${qs({ ...f, page: p, limit: 12 })}`).then((r) => { setGigs((x) => (p === 1 ? r.items : [...x, ...r.items])); setMore(r.hasMore); setPage(p); }).finally(() => setBusy(false)); };
  useEffect(() => { const t = setTimeout(() => fetchPage(1), 250); return () => clearTimeout(t); }, [f]);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const freelancer = user?.role === 'freelancer';
  return (
    <Page title={freelancer ? 'Find jobs' : 'Browse gigs'} sub="Open jobs from clients. Message the client to discuss, or wait for a hire request.">
      <div className="grid gap-3 md:grid-cols-4">
        <input className="input" placeholder="Search (logo, plumber…)" aria-label="Search" value={f.q} onChange={set('q')} />
        <select className="input" aria-label="Category" value={f.category} onChange={set('category')}><option value="">All categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <input className="input" placeholder="City" aria-label="City" value={f.city} onChange={set('city')} />
        <input className="input" type="number" min={0} placeholder="Max budget (Rs)" aria-label="Max budget" value={f.maxBudget} onChange={set('maxBudget')} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {gigs.map((g) => (
          <article key={g._id} className="panel">
            <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold">{g.title}</h3><span className="font-display font-bold text-leaf">{pkr(g.budget)}</span></div>
            <p className="mt-1 line-clamp-2 text-ink/75">{g.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="chip">{g.category}</span>{g.skills?.slice(0, 3).map((s) => <span key={s} className="chip">{s}</span>)}</div>
            <p className="mt-2 text-sm text-ink/60">{g.city} · {g.owner?.name} {g.owner?.completedJobs ? `· ${g.owner.completedJobs} jobs completed` : '· new client'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {freelancer && g.owner?._id && <button className="btn" onClick={() => openChat(g.owner._id)}>Message client</button>}
              {!user && <Link to="/login" className="btn-alt">Log in to message</Link>}
              {user && g.owner?._id !== user._id && user.role !== 'admin' && <button className="text-sm text-ink/50 underline hover:text-danger" onClick={() => setReport(g._id)}>Report</button>}
            </div>
          </article>))}
      </div>
      {!busy && !gigs.length && <div className="mt-4"><Empty>No gigs found. Try different filters.</Empty></div>}
      <LoadMore show={more} busy={busy} onClick={() => fetchPage(page + 1)} />
      {report && <ReportDialog targetType="gig" target={report} onClose={() => setReport('')} />}
    </Page>
  );
}
