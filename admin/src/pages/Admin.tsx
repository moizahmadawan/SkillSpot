import { useCallback, useEffect, useState } from 'react';
import { api, pkr, qs, timeAgo } from '../api';
import { Avatar, Banner, Empty, LoadMore, Status, VerifiedBadge } from '../components/ui';

// ---------- small helpers ----------
function useFetch<T = any>(path: string) {
  const [data, setData] = useState<T | null>(null); const [err, setErr] = useState(''); const [n, setN] = useState(0);
  useEffect(() => { let on = true; setErr(''); api<T>(path).then((d) => on && setData(d)).catch((e) => on && setErr(e.message)); return () => { on = false; }; }, [path, n]);
  return { data, err, reload: () => setN((x) => x + 1) };
}
// Paged list: GET base?params&page=N  ->  { items, hasMore }
function usePaged(base: string, params: Record<string, any>) {
  const key = qs(params); const [items, setItems] = useState<any[]>([]); const [page, setPage] = useState(1);
  const [more, setMore] = useState(false); const [busy, setBusy] = useState(true); const [err, setErr] = useState('');
  const load = useCallback(async (p: number) => {
    setBusy(true); setErr('');
    try { const r = await api(`${base}?${key}&page=${p}`); setItems((old) => (p === 1 ? r.items : [...old, ...r.items])); setMore(r.hasMore); setPage(p); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }, [base, key]);
  useEffect(() => { load(1); }, [load]);
  return { items, more, busy, err, reload: () => load(1), next: () => load(page + 1) };
}
const ask = (q: string, def = '') => window.prompt(q, def);
const Stat = ({ label, value, warn }: { label: string; value: any; warn?: boolean }) => (
  <div className={`panel ${warn ? 'border-saffron bg-saffron/10' : ''}`}><div className="font-display text-2xl font-bold text-leaf">{value}</div><div className="text-sm text-ink/70">{label}</div></div>
);
const Row = ({ k, v }: { k: string; v: any }) => <div className="flex justify-between gap-3 border-b border-ink/5 py-1.5 text-sm"><span className="text-ink/60">{k}</span><span className="text-right font-medium">{v ?? '—'}</span></div>;

// ---------- overview ----------
function Overview({ go }: { go: (t: string) => void }) {
  const s = useFetch('/admin/stats'); const f = useFetch('/admin/finance/summary');
  if (s.err) return <Banner tone="error">{s.err}</Banner>;
  if (!s.data) return <p>Loading…</p>;
  const d = s.data; const fin = f.data;
  return (<div className="space-y-6">
    <div>
      <h2 className="mb-2 text-lg font-bold">Needs your attention</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {([['Accounts to approve', d.pendingAccounts, 'users'], ['Freelancers to verify', d.pendingVerification, 'verify'], ['Gigs in review', d.flaggedGigs, 'gigs'], ['Open reports', d.openReports, 'reports'], ['Flagged chats', d.flaggedMsgs, 'chats']] as const).map(([l, v, t]) => (
          <button key={l} className="text-left" onClick={() => go(t)}><Stat label={l} value={v} warn={v > 0} /></button>))}
      </div>
    </div>
    <div>
      <h2 className="mb-2 text-lg font-bold">Platform</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Members" value={d.users} /><Stat label="Clients" value={d.clients} /><Stat label="Freelancers" value={d.freelancers} /><Stat label="Verified" value={d.verified} /><Stat label="Bookings" value={d.bookings} />
        <Stat label="Gigs (all)" value={d.gigs} /><Stat label="Open gigs" value={d.openGigs} /><Stat label="Money volume" value={pkr(d.volume)} /><Stat label="Commission received" value={pkr(d.commissionReceived)} />
      </div>
    </div>
    {fin && <div className="grid gap-4 md:grid-cols-2">
      <div className="panel"><h3 className="mb-2 font-bold">Money</h3>
        <Row k="In escrow" v={pkr(fin.inEscrow)} /><Row k="Released" v={pkr(fin.released)} /><Row k="Refunded" v={pkr(fin.refunded)} /><Row k="Paid to freelancers" v={pkr(fin.paidToFreelancers)} />
        <Row k="Commission received / pending" v={`${pkr(fin.commissionReceived)} / ${pkr(fin.commissionPending)}`} /><Row k="Tax withheld (paid / unpaid)" v={`${pkr(fin.taxWithheld)} (${pkr(fin.taxPaid)} / ${pkr(fin.taxUnpaid)})`} /><Row k="Jobs paid" v={fin.jobsPaid} /></div>
      <div className="panel"><h3 className="mb-2 font-bold">Top earners</h3>{fin.topEarners.length ? fin.topEarners.map((x: any) => <Row key={x._id} k={x.name || 'Unknown'} v={pkr(x.earned)} />) : <p className="text-sm text-ink/60">No paid jobs yet.</p>}
        <h3 className="mb-2 mt-4 font-bold">Top spenders</h3>{fin.topSpenders.length ? fin.topSpenders.map((x: any) => <Row key={x._id} k={x.name || 'Unknown'} v={pkr(x.spent)} />) : <p className="text-sm text-ink/60">No payments yet.</p>}</div>
    </div>}
  </div>);
}

// ---------- user detail dialog ----------
function UserDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, err, reload } = useFetch(`/admin/users/${id}/detail`); const [msg, setMsg] = useState('');
  const act = async (path: string, body: any = {}) => { setMsg(''); try { await api(`/admin/users/${id}/${path}`, { body }); reload(); onChanged(); } catch (e: any) { setMsg(e.message); } };
  const u = data?.user, fin = data?.finance, risk = data?.risk;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="User details">
      <div className="panel my-6 w-full max-w-3xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          {u ? <div className="flex items-center gap-3"><Avatar u={u} size={52} /><div><h2 className="text-xl font-bold">{u.name || 'No name'} {u.verified && <VerifiedBadge />}</h2><p className="text-sm text-ink/70">{u.role} · {u.phone} · {u.city || 'no city'}</p>
            <div className="mt-1 flex flex-wrap gap-1.5"><Status s={u.accountStatus || 'pending'} />{u.banned && <span className="chip !bg-danger/10 !text-danger">banned</span>}{u.restrictedUntil && new Date(u.restrictedUntil) > new Date() && <span className="chip !bg-saffron/30 !text-ink">restricted</span>}</div></div></div> : <h2 className="text-xl font-bold">User</h2>}
          <button className="btn-alt" onClick={onClose}>Close</button>
        </div>
        {err && <Banner tone="error">{err}</Banner>}{msg && <Banner tone="error">{msg}</Banner>}{!data && !err && <p>Loading…</p>}
        {u && <>
          <div className="flex flex-wrap gap-2">
            {u.accountStatus !== 'approved' && <button className="btn" onClick={() => act('approve')}>Approve location</button>}
            {u.accountStatus !== 'approved' && u.role === 'freelancer' && <button className="btn-alt" onClick={() => act('approve', { verify: true })}>Approve + verify</button>}
            {u.accountStatus !== 'rejected' && <button className="btn-danger" onClick={() => { const r = ask('Reason for rejecting (the user will see it):'); if (r !== null) act('reject', { reason: r }); }}>Reject</button>}
            {u.role === 'freelancer' && (u.verified ? <button className="btn-alt" onClick={() => { const n = ask('Why is verification removed?'); if (n !== null) act('verification', { verified: false, note: n }); }}>Remove verified</button> : <button className="btn-alt" onClick={() => act('verification', { verified: true })}>Mark verified</button>)}
            {u.restrictedUntil && new Date(u.restrictedUntil) > new Date() ? <button className="btn-alt" onClick={() => act('restriction', { clear: true })}>Lift restriction</button>
              : <button className="btn-alt" onClick={() => { const d = ask('Restrict for how many days (1-90)?', '7'); if (d === null) return; const r = ask('Reason:'); if (r !== null) act('restriction', { days: +d, reason: r }); }}>Restrict</button>}
            {u.banned ? <button className="btn" onClick={() => act('ban', { banned: false })}>Unban</button> : <button className="btn-danger" onClick={() => { if (confirm('Ban this user? Their gigs and services will be removed and they are logged out.')) act('ban', { banned: true }); }}>Ban</button>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><h3 className="mb-1 font-bold">Profile</h3><Row k="Address" v={u.address} /><Row k="Joined" v={u.createdAt && new Date(u.createdAt).toLocaleDateString()} /><Row k="Rating" v={u.reviewCount ? `${u.rating} (${u.reviewCount})` : 'No reviews'} />
              <Row k="Location check" v={u.locationCheck ? `${u.locationCheck.distanceKm ?? '?'} km away${u.locationCheck.flag ? ' (FLAGGED)' : ''}` : '—'} />{u.locationCheck?.note && <p className="text-sm text-ink/70">{u.locationCheck.note}</p>}
              {u.accountNote && <Row k="Account note" v={u.accountNote} />}{u.skills?.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{u.skills.map((s: string) => <span key={s} className="chip">{s}</span>)}</div>}{u.bio && <p className="mt-2 text-sm text-ink/80">{u.bio}</p>}</div>
            <div><h3 className="mb-1 font-bold">Risk</h3>{risk ? <><Row k="Score" v={`${risk.score}/100 (${risk.level})`} />{risk.reasons?.length ? <ul className="mt-1 list-disc pl-5 text-sm">{risk.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul> : <p className="text-sm text-ink/60">No warning signs.</p>}</> : '—'}
              <h3 className="mb-1 mt-4 font-bold">Money</h3><Row k="Spent" v={pkr(fin.spent)} /><Row k="Orders" v={fin.orders} /><Row k="Earned" v={pkr(fin.earned)} /><Row k="In escrow" v={pkr(fin.inEscrow)} /><Row k="Commission generated" v={pkr(fin.commissionGenerated)} /><Row k="Tax withheld / unpaid" v={`${pkr(fin.taxWithheld)} / ${pkr(fin.taxUnpaid)}`} /></div>
          </div>
          {data.reports.length > 0 && <div><h3 className="mb-1 font-bold">Reports against this user</h3><ul className="space-y-1 text-sm">{data.reports.map((r: any) => <li key={r._id} className="rounded-lg bg-mist p-2"><b>{r.reason.replace('_', ' ')}</b> by {r.reporter?.name || 'someone'} · {timeAgo(r.createdAt)} · {r.status}{r.details && <> — {r.details}</>}</li>)}</ul></div>}
          <div><h3 className="mb-1 font-bold">Private admin note</h3><div className="flex gap-2"><button className="btn-alt" onClick={() => { const n = ask('Admin note (only admins see this):', u.adminNote || ''); if (n !== null) act('note', { note: n }); }}>Edit note</button><p className="self-center text-sm text-ink/70">{u.adminNote || 'No note.'}</p></div></div>
        </>}
      </div>
    </div>
  );
}

// ---------- users ----------
function Users({ initial }: { initial?: string }) {
  const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [status, setStatus] = useState(initial === 'verify' ? '' : 'pending'); const [ver, setVer] = useState(initial === 'verify' ? 'pending' : '');
  const [open, setOpen] = useState<string | null>(null);
  const L = usePaged('/admin/users', { q, role, status, verification: ver });
  return (<div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <input className="input !w-64" placeholder="Search name, phone or city" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      <select className="input !w-auto" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="">All roles</option><option value="client">Clients</option><option value="freelancer">Freelancers</option></select>
      <select className="input !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setVer(''); }} aria-label="Account status"><option value="">Any status</option><option value="pending">Waiting for approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="restricted">Restricted</option><option value="banned">Banned</option></select>
      <select className="input !w-auto" value={ver} onChange={(e) => { setVer(e.target.value); setStatus(''); }} aria-label="Verification"><option value="">Any verification</option><option value="pending">To verify</option><option value="verified">Verified</option><option value="needs_changes">Needs changes</option></select>
    </div>
    {L.err && <Banner tone="error">{L.err}</Banner>}
    {!L.busy && !L.items.length && <Empty>No users match.</Empty>}
    <div className="grid gap-2">{L.items.map((u) => (
      <button key={u._id} onClick={() => setOpen(u._id)} className="panel flex items-center gap-3 text-left hover:border-leaf">
        <Avatar u={u} size={40} /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{u.name || 'No name'} {u.verified && <VerifiedBadge />}</div><div className="truncate text-sm text-ink/70">{u.role} · {u.phone} · {u.city || '—'} · joined {timeAgo(u.createdAt)}</div></div>
        <div className="flex gap-1.5">{u.banned && <span className="chip !bg-danger/10 !text-danger">banned</span>}<Status s={u.accountStatus || 'pending'} /></div>
      </button>))}</div>
    <LoadMore show={L.more} busy={L.busy} onClick={L.next} />
    {open && <UserDetail id={open} onClose={() => setOpen(null)} onChanged={L.reload} />}
  </div>);
}

// ---------- gigs ----------
function Gigs({ initial }: { initial?: string }) {
  const [status, setStatus] = useState(initial === 'gigs' ? 'pending_review' : ''); const [q, setQ] = useState(''); const L = usePaged('/admin/gigs', { status, q }); const [msg, setMsg] = useState('');
  const act = async (id: string, what: 'approve' | 'remove') => {
    let body: any = {}; if (what === 'remove') { const r = ask('Reason for removing (the owner will see it):'); if (r === null) return; body = { reason: r }; }
    setMsg(''); try { await api(`/admin/gigs/${id}/${what}`, { body }); L.reload(); } catch (e: any) { setMsg(e.message); }
  };
  return (<div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <input className="input !w-64" placeholder="Search title or description" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search gigs" />
      <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Gig status"><option value="">All gigs</option>{['pending_review', 'open', 'in_progress', 'completed', 'closed', 'rejected', 'removed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
    </div>
    {(L.err || msg) && <Banner tone="error">{L.err || msg}</Banner>}{!L.busy && !L.items.length && <Empty>No gigs here.</Empty>}
    <div className="grid gap-3">{L.items.map((g) => (
      <div key={g._id} className="panel space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{g.title}</h3><p className="text-sm text-ink/70">{g.owner?.name || 'Unknown'} · {g.owner?.phone} · {g.city} · {g.category} · {pkr(g.budget)} · {timeAgo(g.createdAt)}</p></div><Status s={g.status} /></div>
        <p className="text-sm text-ink/80">{g.description}</p>
        {(g.risk?.score > 0 || g.aiReview?.summary) && <p className="rounded-lg bg-saffron/20 p-2 text-sm"><b>Safety check{g.risk?.score ? ` (risk ${g.risk.score})` : ''}:</b> {g.aiReview?.summary || g.risk?.reasons?.join(', ')}{g.aiReview?.reasons?.length ? ` — ${g.aiReview.reasons.join(', ')}` : ''}</p>}
        {g.removedReason && <p className="text-sm text-danger">Removed: {g.removedReason}</p>}
        <div className="flex gap-2">{['pending_review', 'rejected', 'removed'].includes(g.status) && <button className="btn !py-1.5" onClick={() => act(g._id, 'approve')}>Approve</button>}{!['removed', 'completed', 'closed'].includes(g.status) && <button className="btn-danger !py-1.5" onClick={() => act(g._id, 'remove')}>Remove</button>}</div>
      </div>))}</div>
    <LoadMore show={L.more} busy={L.busy} onClick={L.next} />
  </div>);
}

// ---------- reports ----------
function Reports() {
  const [all, setAll] = useState(false); const { data, err, reload } = useFetch(`/admin/reports${all ? '?status=all' : ''}`); const [msg, setMsg] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const resolve = async (id: string, action: string) => { setMsg(''); try { await api(`/admin/reports/${id}/resolve`, { body: { action } }); reload(); } catch (e: any) { setMsg(e.message); } };
  return (<div className="space-y-4">
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show resolved reports too</label>
    {(err || msg) && <Banner tone="error">{err || msg}</Banner>}{data && !data.length && <Empty>No reports.</Empty>}
    <div className="grid gap-3">{(data || []).map((r: any) => (
      <div key={r._id} className="panel space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold capitalize">{r.reason.replace('_', ' ')} <span className="font-normal text-ink/60">· {r.targetType}</span></h3>
          <p className="text-sm text-ink/70">Against <button className="underline" onClick={() => setOpen(r.offender?._id)}>{r.offender?.name || 'Unknown'}</button> ({r.offender?.role}{r.offender?.banned ? ', banned' : ''}) · by {r.reporter?.name || 'Unknown'} · {timeAgo(r.createdAt)}</p></div><Status s={r.status === 'actioned' ? 'completed' : r.status} /></div>
        {r.details && <p className="text-sm">“{r.details}”</p>}{r.snippet && <p className="rounded-lg bg-mist p-2 text-sm"><b>Reported:</b> {r.snippet}</p>}
        {r.context?.length > 0 && <div className="rounded-lg bg-mist p-2 text-sm"><b>Chat before it:</b>{r.context.map((c: any, i: number) => <div key={i}><span className="text-ink/60">{c.who}:</span> {c.text}</div>)}</div>}
        {r.status === 'open' && <div className="flex flex-wrap gap-2"><button className="btn-alt !py-1.5" onClick={() => resolve(r._id, 'dismiss')}>Dismiss</button><button className="btn-alt !py-1.5" onClick={() => resolve(r._id, 'restrict')}>Restrict 7 days</button>
          {['gig', 'community'].includes(r.targetType) && <button className="btn-alt !py-1.5" onClick={() => resolve(r._id, 'remove')}>Remove content</button>}<button className="btn-danger !py-1.5" onClick={() => confirm('Ban the reported user?') && resolve(r._id, 'ban')}>Ban user</button></div>}
      </div>))}</div>
    {open && <UserDetail id={open} onClose={() => setOpen(null)} onChanged={reload} />}
  </div>);
}

// ---------- flagged chats ----------
function Chats() {
  const { data, err, reload } = useFetch('/admin/flagged-messages'); const [msg, setMsg] = useState('');
  const done = async (id: string) => { setMsg(''); try { await api(`/admin/messages/${id}/review`, { method: 'POST', body: {} }); reload(); } catch (e: any) { setMsg(e.message); } };
  return (<div className="space-y-3">
    <p className="text-sm text-ink/70">Messages the safety rules flagged (for example asking to pay outside the app, or for OTP / CNIC). Mark them reviewed once checked.</p>
    {(err || msg) && <Banner tone="error">{err || msg}</Banner>}{data && !data.length && <Empty>Nothing flagged. All clear.</Empty>}
    {(data || []).map((m: any) => (
      <div key={m._id} className="panel flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-ink/70">{m.from?.name || '?'} → {m.to?.name || '?'} · {timeAgo(m.createdAt)}{m.flagReason && <> · <b>{m.flagReason}</b></>}</p><p className="mt-1">{m.text}</p></div><button className="btn-alt !py-1.5" onClick={() => done(m._id)}>Mark reviewed</button></div>))}
  </div>);
}

// ---------- payments ----------
function Payments() {
  const [status, setStatus] = useState(''); const L = usePaged('/admin/payments', { status }); const [msg, setMsg] = useState('');
  const taxPaid = async (id: string, paid: boolean) => { setMsg(''); try { await api(`/admin/payments/${id}/tax-paid`, { body: { paid } }); L.reload(); } catch (e: any) { setMsg(e.message); } };
  return (<div className="space-y-4">
    <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Payment status"><option value="">All payments</option>{['pending', 'held', 'released', 'refunded', 'cancelled'].map((s) => <option key={s}>{s}</option>)}</select>
    <p className="text-sm text-ink/70">Test mode: no real money moves until a payment gateway is connected.</p>
    {(L.err || msg) && <Banner tone="error">{L.err || msg}</Banner>}{!L.busy && !L.items.length && <Empty>No payments.</Empty>}
    <div className="overflow-x-auto"><table className="panel w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-ink/10 text-ink/60"><th className="p-2">Job</th><th>Client → Freelancer</th><th>Amount</th><th>Commission</th><th>Tax</th><th>Net</th><th>Status</th><th>Tax paid</th></tr></thead>
      <tbody>{L.items.map((p) => (<tr key={p._id} className="border-b border-ink/5"><td className="p-2"><div className="font-medium">{p.title || 'Job'}</div><div className="text-xs text-ink/60">{timeAgo(p.createdAt)}</div></td><td>{p.client?.name} → {p.freelancer?.name}</td><td>{pkr(p.amount)}</td><td>{pkr(p.commission)}</td><td>{pkr(p.tax)}</td><td>{pkr(p.freelancerNet)}</td><td><Status s={p.status === 'held' ? 'in_progress' : p.status === 'released' ? 'completed' : p.status} /></td>
        <td>{p.status === 'released' && p.tax > 0 ? <label className="flex items-center gap-1"><input type="checkbox" checked={!!p.taxPaid} onChange={(e) => taxPaid(p._id, e.target.checked)} />{p.taxPaid ? 'Paid' : 'Unpaid'}</label> : '—'}</td></tr>))}</tbody></table></div>
    <LoadMore show={L.more} busy={L.busy} onClick={L.next} />
  </div>);
}

// ---------- community moderation ----------
function Community() {
  const [room, setRoom] = useState<'clients' | 'freelancers'>('clients'); const [items, setItems] = useState<any[]>([]); const [more, setMore] = useState(false); const [busy, setBusy] = useState(true); const [err, setErr] = useState('');
  const load = useCallback(async (before?: string) => {
    setBusy(true); setErr('');
    try { const r = await api(`/admin/community/${room}${before ? `?before=${encodeURIComponent(before)}` : ''}`); setItems((o) => (before ? [...o, ...r.items] : r.items)); setMore(r.hasMore); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }, [room]);
  useEffect(() => { load(); }, [load]);
  const del = async (id: string) => { if (!confirm('Delete this message for everyone?')) return; try { await api(`/admin/community/messages/${id}`, { method: 'DELETE' }); setItems((o) => o.filter((m) => m._id !== id)); } catch (e: any) { setErr(e.message); } };
  return (<div className="space-y-3">
    <div className="flex gap-2">{(['clients', 'freelancers'] as const).map((r) => <button key={r} className={r === room ? 'btn !py-1.5' : 'btn-alt !py-1.5'} onClick={() => setRoom(r)}>{r === 'clients' ? 'Clients room' : 'Freelancers room'}</button>)}</div>
    {err && <Banner tone="error">{err}</Banner>}{!busy && !items.length && <Empty>No messages in this room.</Empty>}
    {items.map((m) => (<div key={m._id} className="panel flex items-start justify-between gap-3 !p-3"><div className="min-w-0"><p className="text-sm text-ink/70"><b className="text-ink">{m.from?.name || m.name || 'Unknown'}</b> · {timeAgo(m.createdAt)}{m.flagged && <span className="chip ml-2 !bg-saffron/30 !text-ink">flagged</span>}{m.deleted && <span className="chip ml-2 !bg-ink/10 !text-ink">deleted</span>}</p><p className="break-words">{m.text}</p></div>{!m.deleted && <button className="btn-danger !py-1.5" onClick={() => del(m._id)}>Delete</button>}</div>))}
    <LoadMore show={more} busy={busy} onClick={() => load(items[items.length - 1]?.createdAt)} />
  </div>);
}

// ---------- shell ----------
const TABS: [string, string][] = [['overview', 'Overview'], ['users', 'Users'], ['gigs', 'Gigs'], ['reports', 'Reports'], ['chats', 'Flagged chats'], ['payments', 'Payments'], ['community', 'Community']];
export default function Admin() {
  const [tab, setTab] = useState(() => (TABS.some(([t]) => t === location.hash.slice(1)) ? location.hash.slice(1) : 'overview'));
  const [seed, setSeed] = useState('');
  const go = (t: string) => { setSeed(t); setTab(t === 'chats' || t === 'reports' || t === 'gigs' ? t : 'users'); };
  const stats = useFetch('/admin/stats').data;
  const badge: Record<string, number> = { users: (stats?.pendingAccounts || 0) + (stats?.pendingVerification || 0), gigs: stats?.flaggedGigs || 0, reports: stats?.openReports || 0, chats: stats?.flaggedMsgs || 0 };
  useEffect(() => { history.replaceState(null, '', `#${tab}`); }, [tab]);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">Admin panel</h1><p className="mt-1 text-ink/70">Approve accounts, keep the marketplace safe and watch the money.</p>
      <nav className="mt-5 flex flex-wrap gap-2 border-b border-ink/10 pb-3" aria-label="Admin sections">
        {TABS.map(([t, label]) => <button key={t} onClick={() => { setSeed(''); setTab(t); }} aria-current={tab === t} className={`relative ${tab === t ? 'btn !py-1.5' : 'btn-alt !py-1.5'}`}>{label}{badge[t] > 0 && <span className="ml-1 rounded-full bg-saffron px-1.5 text-xs font-bold text-ink">{badge[t]}</span>}</button>)}
      </nav>
      <div className="mt-6">
        {tab === 'overview' && <Overview go={go} />}
        {tab === 'users' && <Users key={seed} initial={seed} />}
        {tab === 'gigs' && <Gigs key={seed} initial={seed} />}
        {tab === 'reports' && <Reports />}
        {tab === 'chats' && <Chats />}
        {tab === 'payments' && <Payments />}
        {tab === 'community' && <Community />}
      </div>
      
    </main>
  );
}
