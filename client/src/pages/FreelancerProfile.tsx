import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, Gig, isRestricted, pkr, useOpenChat, User } from '../api';
import { useAuth } from '../auth';
import { Avatar, Banner, Page, ReportDialog, VerifiedBadge } from '../components/ui';
import MapView from '../components/MapView';

export default function FreelancerProfile() {
  const { id } = useParams(); const [sp] = useSearchParams(); const { user } = useAuth(); const openChat = useOpenChat();
  const [u, setU] = useState<User | null>(null); const [gigs, setGigs] = useState<Gig[]>([]); const [form, setForm] = useState({ gig: sp.get('gig') || '', price: '', note: '' });
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null); const [busy, setBusy] = useState(false); const [report, setReport] = useState(false); const [missing, setMissing] = useState(false);
  useEffect(() => { api(`/users/${id}`).then(setU).catch(() => setMissing(true)); }, [id]);
  useEffect(() => { if (user?.role === 'client') api('/gigs/mine').then((g: Gig[]) => { const open = g.filter((x) => x.status === 'open'); setGigs(open); const pre = open.find((x) => x._id === form.gig); if (pre) setForm((f) => ({ ...f, price: String(pre.budget) })); }).catch(() => {}); }, [user?.role]);
  if (missing) return <Page title="Profile not found"><Link className="underline" to="/skills">Back to search</Link></Page>;
  if (!u) return <Page title="Loading…"><span /></Page>;
  const own = user?._id === u._id;
  const pickGig = (gig: string) => { const g = gigs.find((x) => x._id === gig); setForm({ ...form, gig, price: g ? String(g.budget) : form.price }); };
  const hire = async () => {
    setBusy(true); setMsg(null);
    try { await api('/bookings', { body: { freelancer: u._id, gig: form.gig, price: +form.price, note: form.note } }); setMsg({ t: 'ok', s: 'Hire request sent. The freelancer was notified and has 72 hours to reply.' }); setForm({ ...form, note: '' }); }
    catch (e: any) { setMsg({ t: 'err', s: e.message }); } finally { setBusy(false); }
  };
  return (
    <Page title={u.name || 'Freelancer'} sub={u.city ? `Freelancer in ${u.city}` : undefined}>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="panel space-y-3">
            <div className="flex items-center gap-4"><Avatar u={u} size={88} />
              <div><p className="flex flex-wrap items-center gap-2 text-lg font-bold">{u.name}{u.verified && <VerifiedBadge title={u.verificationSummary || 'Verified'} />}</p>
                <p className="text-sm text-ink/70">★ {u.reviewCount ? `${u.rating.toFixed(1)} (${u.reviewCount} reviews)` : 'New profile'} · {u.completedJobs || 0} jobs completed · {u.experienceYears} years experience</p>
                <p className="text-sm text-ink/70">{pkr(u.hourlyRate)}/hr · {u.available ? 'Available now' : 'Busy right now'}</p></div></div>
            {u.bio && <p>{u.bio}</p>}
            <div className="flex flex-wrap gap-1.5">{u.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
            {u.verified && <p className="text-sm text-ink/70">{u.verificationSummary}</p>}
          </section>
          {user?.role === 'client' && !own && (
            <section className="panel space-y-3">
              <h2 className="text-xl font-bold">Hire {u.name?.split(' ')[0]}</h2>
              {isRestricted(user) && <Banner tone="error">Your account is restricted until {new Date(user.restrictedUntil!).toDateString()}, so you cannot hire right now.</Banner>}
              {!gigs.length ? <Banner>Post an open gig first, then you can hire for it. <Link className="font-semibold underline" to="/post">Post a gig</Link></Banner> : <>
                <label className="block font-medium" htmlFor="g">Which gig is this for?</label>
                <select id="g" className="input" value={form.gig} onChange={(e) => pickGig(e.target.value)}><option value="">Select one of your open gigs</option>{gigs.map((g) => <option key={g._id} value={g._id}>{g.title}</option>)}</select>
                <label className="block font-medium" htmlFor="p">Your offer (Rs)</label>
                <input id="p" className="input" type="number" min={300} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                <textarea className="input" rows={2} maxLength={500} placeholder="Short note (optional). Do not share phone numbers or pay in advance." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                <button className="btn" disabled={busy || !form.gig || !form.price} onClick={hire}>Send hire request</button></>}
              {msg && <Banner tone={msg.t === 'err' ? 'error' : 'warn'}>{msg.s}</Banner>}
            </section>)}
          {user?.role === 'freelancer' && !own && <Banner>Only client accounts can hire. You can still message other users from gigs and requests.</Banner>}
          {own && <Banner>This is how clients see your profile. <Link className="font-semibold underline" to="/settings">Edit it</Link></Banner>}
          {!user && <Banner>Log in as a client to hire this freelancer. <Link className="font-semibold underline" to="/login">Log in</Link></Banner>}
        </div>
        <aside className="space-y-3">
          <MapView height={240} points={[{ lat: u.location.coordinates[1], lng: u.location.coordinates[0], label: u.name }]} />
          <p className="text-xs text-ink/60">Approximate area only. Exact locations and phone numbers are never shown.</p>
          {user && !own && user.role !== 'admin' && <div className="flex flex-wrap gap-2">{user.role === 'client' && <button className="btn" onClick={() => openChat(u._id)}>Message</button>}<button className="btn-alt" onClick={() => setReport(true)}>Report</button></div>}
        </aside>
      </div>
      {report && <ReportDialog targetType="user" target={u._id} onClose={() => setReport(false)} />}
    </Page>
  );
}
