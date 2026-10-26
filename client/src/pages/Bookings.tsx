import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, LoadMore, Page } from '../components/ui';
import BookingCard from '../components/BookingCard';

const TABS = [['', 'All'], ['pending', 'Pending'], ['active', 'In progress'], ['done', 'Completed'], ['closed', 'Closed']] as const;

export default function Bookings() {
  const { user } = useAuth(); const role = user!.role as 'client' | 'freelancer';
  const [tab, setTab] = useState(''); const [items, setItems] = useState<any[]>([]); const [page, setPage] = useState(1); const [more, setMore] = useState(false); const [busy, setBusy] = useState(false);
  const load = (p = 1) => { setBusy(true); api(`/bookings?tab=${tab}&page=${p}&limit=15`).then((r) => { setItems((x) => (p === 1 ? r.items : [...x, ...r.items])); setMore(r.hasMore); setPage(p); }).finally(() => setBusy(false)); };
  useEffect(() => { load(1); }, [tab]);
  return (
    <Page title={role === 'client' ? 'My hires' : 'Job requests'} sub={role === 'client' ? 'Every freelancer you hired or asked, with live status.' : 'Hire requests from clients. Accept the ones that suit you.'}>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 font-medium ${tab === k ? 'bg-leaf text-white' : 'bg-white hover:bg-leaf-soft'}`}>{label}</button>)}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{items.map((b) => <BookingCard key={b._id} b={b} role={role} onChange={() => load(1)} />)}</div>
      {!busy && !items.length && <div className="mt-4"><Empty>Nothing here yet.</Empty></div>}
      <LoadMore show={more} busy={busy} onClick={() => load(page + 1)} />
    </Page>
  );
}
