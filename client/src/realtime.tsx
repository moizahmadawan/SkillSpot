import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { api, getToken } from './api';
import { useAuth } from './auth';

type Toast = { id: number; title: string; body?: string; link?: string };
type Ctx = { socket: Socket | null; unreadChat: number; unreadNotes: number; pending: number; refresh: () => void; setActiveConv: (id: string | null) => void; clearNotes: () => void };
const C = createContext<Ctx>({ socket: null, unreadChat: 0, unreadNotes: 0, pending: 0, refresh: () => {}, setActiveConv: () => {}, clearNotes: () => {} });
export const useRealtime = () => useContext(C);

// One shared socket for the whole app: live chat messages, notifications and unread counters.
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth(); const nav = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadChat, setUnreadChat] = useState(0); const [unreadNotes, setUnreadNotes] = useState(0); const [pending, setPending] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const active = useRef<string | null>(null);
  const setActiveConv = useCallback((id: string | null) => { active.current = id; }, []);
  const refresh = useCallback(() => {
    if (!getToken()) return;
    api('/chat/unread').then((r) => setUnreadChat(r.unread)).catch(() => {});
    api('/notifications/unread').then((r) => setUnreadNotes(r.unread)).catch(() => {});
    api('/bookings/counts').then((r) => setPending(r.requested || 0)).catch(() => {});
  }, []);
  const push = (title: string, body?: string, link?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, title, body, link }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  };
  useEffect(() => {
    if (!user || !user.onboarded || user.role === 'admin') { setSocket(null); setUnreadChat(0); setUnreadNotes(0); setPending(0); return; }
    const s = io({ auth: { token: getToken() }, reconnectionDelayMax: 10000 });
    setSocket(s); refresh();
    s.on('connect', refresh); // re-sync counters after a reconnect
    s.on('connect_error', (e) => console.warn('Realtime connection problem:', e.message));
    s.on('notification', (n: any) => { setUnreadNotes((c) => c + 1); push(n.title, n.body, n.link); if (String(n.type).startsWith('booking_')) refresh(); });
    s.on('message', (m: any) => {
      if (m.from === user._id || active.current === m.conversation) return;
      setUnreadChat((c) => c + 1);
      if (!m.system) push('New message', m.text.slice(0, 80), `/chat/${m.conversation}`);
    });
    return () => { s.disconnect(); };
  }, [user?._id, user?.onboarded, user?.role, refresh]);
  return (
    <C.Provider value={{ socket, unreadChat, unreadNotes, pending, refresh, setActiveConv, clearNotes: () => setUnreadNotes(0) }}>
      {children}
      <div className="fixed right-4 top-20 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} onClick={() => t.link && nav(t.link)} className="rounded-xl border border-ink/10 bg-white p-3 text-left shadow-lg">
            <span className="block font-semibold">{t.title}</span>{t.body && <span className="block text-sm text-ink/70">{t.body}</span>}
          </button>))}
      </div>
    </C.Provider>
  );
}
