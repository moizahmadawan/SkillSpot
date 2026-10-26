import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { useRealtime } from '../realtime';
import { Empty, LoadMore, Page } from '../components/ui';

export default function Notifications() {
  const nav = useNavigate(); const { socket, refresh, clearNotes } = useRealtime();
  const [items, setItems] = useState<any[]>([]); const [more, setMore] = useState(false); const [busy, setBusy] = useState(true);
  const fresh = useRef<Set<string>>(new Set()); // highlighted as "new" only while you are looking at them
  const seen = () => api('/notifications/read-all', { body: {} }).then(() => { clearNotes(); refresh(); }).catch(() => {});
  const load = (before?: string) => {
    setBusy(true);
    api(`/notifications${before ? `?before=${encodeURIComponent(before)}` : ''}`).then((r) => {
      r.items.forEach((n: any) => { if (!n.read) fresh.current.add(n._id); });
      setItems((x) => (before ? [...x, ...r.items] : r.items)); setMore(r.hasMore);
      if (r.items.some((n: any) => !n.read)) seen(); // opening the page = seen, so the bell badge clears
    }).finally(() => setBusy(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!socket) return;
    const f = (n: any) => { fresh.current.add(n._id); setItems((x) => [n, ...x]); api(`/notifications/${n._id}/read`, { method: 'PATCH', body: {} }).then(refresh).catch(() => {}); };
    socket.on('notification', f); return () => { socket.off('notification', f); };
  }, [socket, refresh]);
  return (
    <Page title="Notifications" sub="Hire requests, replies, verification results and account alerts.">
      <div className="space-y-2">
        {items.map((n) => (
          <button key={n._id} onClick={() => n.link && nav(n.link)} className={`panel block w-full text-left ${fresh.current.has(n._id) ? 'border-leaf bg-leaf-soft/50' : ''}`}>
            <span className="flex items-start justify-between gap-3"><span className={fresh.current.has(n._id) ? 'font-bold' : 'font-medium'}>{n.title}</span><span className="shrink-0 text-xs text-ink/50">{timeAgo(n.createdAt)}</span></span>
            {n.body && <span className="mt-0.5 block text-sm text-ink/70">{n.body}</span>}
          </button>))}
      </div>
      {!busy && !items.length && <Empty>No notifications yet.</Empty>}
      <LoadMore show={more} busy={busy} onClick={() => load(items[items.length - 1]?.createdAt)} />
    </Page>
  );
}
