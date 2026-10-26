import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isRestricted, pkr, useOpenChat } from '../api';
import { useAuth } from '../auth';
import LocationPrompt from '../components/LocationPrompt';
import { Banner, Empty, Page, Score } from '../components/ui';
import BookingCard from '../components/BookingCard';
import VerificationCard from '../components/VerificationCard';

const Stat = ({ n, label }: { n: string | number; label: string }) => <div className="panel"><p className="font-display text-3xl font-bold text-leaf">{n}</p><p className="text-sm text-ink/70">{label}</p></div>;

export default function FreelancerDashboard() {
  const { user } = useAuth(); const openChat = useOpenChat();
  const [pending, setPending] = useState<any[]>([]); const [active, setActive] = useState<any[]>([]); const [counts, setCounts] = useState<any>({}); const [jobs, setJobs] = useState<any[]>([]);
  const load = () => {
    api('/bookings?tab=pending').then((r) => setPending(r.items)).catch(() => {});
    api('/bookings?tab=active').then((r) => setActive(r.items)).catch(() => {});
    api('/bookings/counts').then(setCounts).catch(() => {});
  };
  useEffect(() => { load(); api('/ai/match/jobs').then((r) => setJobs(r.slice(0, 4))).catch(() => {}); }, []);
  const checks = [!!user?.name, (user?.avatarVersion || 0) > 0, (user?.bio || '').length >= 60, (user?.skills || []).length >= 2, !!user?.city, (user?.hourlyRate || 0) > 0];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return (
    <Page title={`Welcome, ${user?.name?.split(' ')[0] || 'there'}`} sub="Freelancer account: get verified, answer hire requests and find jobs."
      action={<div className="flex flex-wrap gap-2"><Link to="/gigs" className="btn">Find jobs</Link><Link to="/settings" className="btn-alt">Edit profile</Link><Link to="/ai" className="btn-alt">Ask SkillSpot AI</Link></div>}>
      <LocationPrompt />
      {isRestricted(user) && <div className="mb-4"><Banner tone="error">Your account is restricted until {new Date(user!.restrictedUntil!).toDateString()}. {user!.restrictionReason} You cannot accept new jobs during this time.</Banner></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat n={pending.length} label="New hire requests" /><Stat n={counts.accepted || 0} label="Jobs in progress" /><Stat n={counts.completed || 0} label="Completed jobs" /><Stat n={user?.reviewCount ? `${user.rating.toFixed(1)} ★` : 'New'} label="Rating" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <VerificationCard />
        <section className="panel space-y-2" aria-label="Profile strength">
          <h2 className="text-xl font-bold">Profile strength: {pct}%</h2>
          <div className="h-2 rounded bg-mist" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded bg-leaf" style={{ width: `${pct}%` }} /></div>
          <p className="text-sm text-ink/70">A complete profile with a photo gets more hire requests. Missing: {['name', 'photo', 'bio (60+ characters)', '2+ skills', 'city', 'hourly rate'].filter((_, i) => !checks[i]).join(', ') || 'nothing'}.</p>
          <Link to="/settings" className="font-semibold text-leaf underline">Complete your profile</Link>
        </section>
      </div>
      <section className="mt-8"><h2 className="text-xl font-bold">Hire requests waiting for you</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">{pending.map((b) => <BookingCard key={b._id} b={b} role="freelancer" onChange={load} />)}</div>
        {!pending.length && <Empty>No new requests. Verified profiles with a photo get noticed more.</Empty>}
      </section>
      {active.length > 0 && <section className="mt-8"><h2 className="text-xl font-bold">Jobs in progress</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{active.map((b) => <BookingCard key={b._id} b={b} role="freelancer" onChange={load} />)}</div></section>}
      <section className="mt-8"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Jobs that match you</h2><Link className="font-semibold text-leaf underline" to="/recommendations">See all</Link></div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {jobs.map((j) => (
            <article key={j.gig._id} className="panel"><div className="flex gap-3"><Score n={j.score} /><div><h3 className="font-bold">{j.gig.title}</h3><p className="text-sm text-ink/60">{pkr(j.gig.budget)} · {j.gig.city} · {j.distanceKm} km</p></div></div>
              {j.gig.owner?._id && <button className="btn-alt mt-3" onClick={() => openChat(j.gig.owner._id)}>Message client</button>}</article>))}
        </div>
        {!jobs.length && <Empty>No matching jobs yet. Add more skills to your profile.</Empty>}
      </section>
    </Page>
  );
}
