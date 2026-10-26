import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getCoords, pkr, qs, User } from '../api';
import { Avatar, Empty, LoadMore, Page, VerifiedBadge } from '../components/ui';
import MapView from '../components/MapView';

export default function FindSkills() {
  const [q, setQ] = useState(''); const [city, setCity] = useState(''); const [verified, setVerified] = useState(false); const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(25); const [list, setList] = useState<User[]>([]); const [page, setPage] = useState(1); const [more, setMore] = useState(false); const [busy, setBusy] = useState(true);
  const [sel, setSel] = useState<User | null>(null); const [err, setErr] = useState('');
  const fetchPage = (p: number) => { setBusy(true); api(`/users/freelancers?${qs({ q, city, verified, ...(pos || {}), radius, page: p, limit: 12 })}`).then((r) => { setList((x) => (p === 1 ? r.items : [...x, ...r.items])); setMore(r.hasMore); setPage(p); }).finally(() => setBusy(false)); };
  useEffect(() => { const t = setTimeout(() => fetchPage(1), 250); return () => clearTimeout(t); }, [q, city, verified, pos, radius]);
  return (
    <Page title="Find freelancers" sub="Search electricians, tutors, designers and developers near you. Verified profiles passed the SkillSpot AI check.">
      <div className="grid gap-3 md:grid-cols-5">
        <input className="input" placeholder="Skill (electrician, logo…)" aria-label="Skill" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input" placeholder="City" aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <button className="btn-alt" onClick={() => getCoords().then(setPos).catch((e) => setErr(e.message))}>{pos ? 'Location set ✓' : 'Near me'}</button>
        <select className="input" aria-label="Radius" value={radius} onChange={(e) => setRadius(+e.target.value)}>{[5, 10, 25, 50, 200].map((r) => <option key={r} value={r}>{r} km</option>)}</select>
        <label className="flex items-center gap-2 rounded-lg border border-ink/20 bg-white px-3"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Verified only</label>
      </div>
      {err && <p role="alert" className="mt-2 text-danger">{err}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {list.map((u) => (
            <article key={u._id} className={`panel cursor-pointer ${sel?._id === u._id ? 'border-leaf' : ''}`} onClick={() => setSel(u)}>
              <div className="flex gap-3"><Avatar u={u} size={52} />
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-lg font-bold">{u.name}{u.verified && <VerifiedBadge />}</h3><span className="text-sm">★ {u.reviewCount ? u.rating.toFixed(1) : 'new'} · {pkr(u.hourlyRate)}/hr</span></div>
                  <p className="text-sm text-ink/60">{u.city}{u.distanceKm !== undefined && ` · ${u.distanceKm} km away`}{!u.available && ' · busy'}{u.completedJobs ? ` · ${u.completedJobs} jobs done` : ''}</p></div></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{u.skills.slice(0, 6).map((s) => <span key={s} className="chip">{s}</span>)}</div>
              <Link to={`/freelancer/${u._id}`} className="mt-3 inline-block font-semibold text-leaf underline">View profile</Link>
            </article>))}
          {!busy && !list.length && <Empty>No freelancers found here. Try a larger radius, another skill, or turn off "Verified only".</Empty>}
          <LoadMore show={more} busy={busy} onClick={() => fetchPage(page + 1)} />
        </div>
        <aside className="space-y-2 lg:sticky lg:top-20 lg:self-start">
          <MapView height={380} points={list.map((u) => ({ id: u._id, lat: u.location.coordinates[1], lng: u.location.coordinates[0], label: u.name, active: sel?._id === u._id }))} onSelect={(id) => setSel(list.find((u) => u._id === id) || null)} />
          <p className="text-xs text-ink/60">{sel ? <>Selected: <b>{sel.name}</b> ({sel.city}). </> : 'Click a circle or a card to select a freelancer. '}Circles show approximate areas only.</p>
        </aside>
      </div>
    </Page>
  );
}
