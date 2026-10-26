import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Gig, isRestricted, pkr } from '../api';
import { useAuth } from '../auth';
import LocationPrompt from '../components/LocationPrompt';
import { Banner, Empty, Page, Status } from '../components/ui';
import BookingCard from '../components/BookingCard';

const Stat = ({ n, label }: { n: number; label: string }) => <div className="panel"><p className="font-display text-3xl font-bold text-leaf">{n}</p><p className="text-sm text-ink/70">{label}</p></div>;

export default function ClientDashboard() {
  const { user } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]); const [counts, setCounts] = useState<any>({}); const [recent, setRecent] = useState<any[]>([]); const [err, setErr] = useState('');
  const load = () => { api('/gigs/mine').then(setGigs).catch(() => {}); api('/bookings/counts').then(setCounts).catch(() => {}); api('/bookings?tab=pending&limit=3').then((r) => setRecent(r.items)).catch(() => {}); };
  useEffect(load, []);
  const close = async (id: string) => { setErr(''); try { await api(`/gigs/${id}/close`, { method: 'PATCH', body: {} }); load(); } catch (e: any) { setErr(e.message); } };
  const active = gigs.filter((g) => ['open', 'in_progress', 'pending_review'].includes(g.status));
  return (
    <Page title={`Welcome, ${user?.name?.split(' ')[0] || 'there'}`} sub="Client account: post gigs, hire freelancers and track your jobs."
      action={<div className="flex flex-wrap gap-2"><Link to="/post" className="btn">Post a gig</Link><Link to="/skills" className="btn-alt">Find freelancers</Link><Link to="/ai" className="btn-alt">Ask SkillSpot AI</Link></div>}>
      <LocationPrompt />
      {isRestricted(user) && <div className="mb-4"><Banner tone="error">Your account is restricted until {new Date(user!.restrictedUntil!).toDateString()}. {user!.restrictionReason} You cannot post gigs or hire during this time.</Banner></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat n={active.length} label="Active gigs" /><Stat n={counts.requested || 0} label="Waiting for a reply" /><Stat n={counts.accepted || 0} label="Jobs in progress" /><Stat n={counts.completed || 0} label="Completed" />
      </div>
      {err && <div className="mt-4"><Banner tone="error">{err}</Banner></div>}
      <section className="mt-8"><h2 className="text-xl font-bold">Your gigs</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {gigs.map((g) => (
            <article key={g._id} className="panel">
              <div className="flex items-start justify-between gap-2"><h3 className="font-bold">{g.title}</h3><Status s={g.status} /></div>
              <p className="text-sm text-ink/60">{pkr(g.budget)} · {g.city} · {g.category}</p>
              {g.status === 'pending_review' && <p className="mt-2 text-sm">Held for a quick safety check. We will notify you when it is approved.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {g.status === 'open' && <Link className="btn !py-1.5" to={`/recommendations?gig=${g._id}`}>See best freelancers</Link>}
                {['open', 'pending_review'].includes(g.status) && <button className="btn-alt !py-1.5" onClick={() => close(g._id)}>Close gig</button>}
              </div>
            </article>))}
        </div>
        {!gigs.length && <Empty>No gigs yet. <Link className="underline" to="/post">Post your first gig</Link> and AI will suggest matching freelancers.</Empty>}
      </section>
      <section className="mt-8"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Waiting for a reply</h2><Link className="font-semibold text-leaf underline" to="/bookings">All hires</Link></div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">{recent.map((b) => <BookingCard key={b._id} b={b} role="client" onChange={load} />)}</div>
        {!recent.length && <Empty>No pending hire requests.</Empty>}
      </section>
    </Page>
  );
}
