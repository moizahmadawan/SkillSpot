import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, Gig, pkr, useOpenChat } from '../api';
import { useAuth } from '../auth';
import { Avatar, Empty, Page, Score, VerifiedBadge } from '../components/ui';

const Bar = ({ label, v }: { label: string; v: number }) => (
  <div className="flex items-center gap-2 text-xs"><span className="w-20 text-ink/60">{label}</span><div className="h-1.5 flex-1 rounded bg-mist"><div className="h-1.5 rounded bg-leaf" style={{ width: `${v}%` }} /></div></div>
);
const Breakdown = ({ b }: { b: Record<string, number> }) => <div className="mt-3 space-y-1">{Object.entries(b).map(([k, v]) => <Bar key={k} label={k} v={v} />)}</div>;

export default function Recommendations() {
  const { user } = useAuth(); const openChat = useOpenChat(); const [sp, setSp] = useSearchParams();
  const [mine, setMine] = useState<Gig[]>([]); const [rows, setRows] = useState<any[]>([]); const [jobs, setJobs] = useState<any[]>([]); const [busy, setBusy] = useState(false);
  const gigId = sp.get('gig'); const client = user?.role === 'client';
  useEffect(() => { if (client) api('/gigs/mine').then((g: Gig[]) => setMine(g.filter((x) => x.status === 'open'))); else api('/ai/match/jobs').then(setJobs); }, [client]);
  useEffect(() => { if (!client || !gigId) return setRows([]); setBusy(true); api(`/ai/match/gig/${gigId}`).then(setRows).catch(() => setRows([])).finally(() => setBusy(false)); }, [gigId, client]);
  return (
    <Page title="AI matches" sub="The matching engine scores people on skills, distance, budget, experience and rating. Verified profiles get a small bonus.">
      {client ? <section>
        <h2 className="text-xl font-bold">Best freelancers for my gig</h2>
        <select className="input mt-2 max-w-md" aria-label="Select a gig" value={gigId || ''} onChange={(e) => setSp(e.target.value ? { gig: e.target.value } : {})}><option value="">Select a gig</option>{mine.map((g) => <option key={g._id} value={g._id}>{g.title}</option>)}</select>
        {busy && <p className="mt-3">Finding matches…</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <article key={r.freelancer._id} className="panel">
              <div className="flex gap-3"><Score n={r.score} /><Avatar u={r.freelancer} size={48} /><div><h3 className="flex flex-wrap items-center gap-2 font-bold">{r.freelancer.name}{r.freelancer.verified && <VerifiedBadge />}</h3><p className="text-sm text-ink/60">{r.freelancer.city} · {r.distanceKm} km · {pkr(r.freelancer.hourlyRate)}/hr</p></div></div>
              {r.reason && <p className="mt-3 text-sm">{r.reason}</p>}
              <Breakdown b={r.breakdown} />
              <div className="mt-3 flex gap-2"><Link to={`/freelancer/${r.freelancer._id}?gig=${gigId}`} className="btn">Hire</Link><button className="btn-alt" onClick={() => openChat(r.freelancer._id)}>Message</button></div>
            </article>))}
        </div>
        {gigId && !busy && !rows.length && <Empty>No matching freelancers found yet.</Empty>}
        {!mine.length && <div className="mt-4"><Empty>You have no open gigs. <Link className="underline" to="/post">Post a gig</Link> and your matches will appear here.</Empty></div>}
      </section> : <section>
        <h2 className="text-xl font-bold">Best open jobs for you</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {jobs.map((j) => (
            <article key={j.gig._id} className="panel"><div className="flex gap-3"><Score n={j.score} /><div><h3 className="font-bold">{j.gig.title}</h3><p className="text-sm text-ink/60">{pkr(j.gig.budget)} · {j.gig.city} · {j.distanceKm} km</p></div></div>
              <Breakdown b={j.breakdown} />{j.gig.owner?._id && <button className="btn mt-3" onClick={() => openChat(j.gig.owner._id)}>Message client</button>}</article>))}
        </div>
        {!jobs.length && <Empty>No matching jobs yet. Add skills in <Link className="underline" to="/settings">your profile</Link>.</Empty>}
      </section>}
    </Page>
  );
}
