import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, clock, timeAgo } from '../api';
import { useAuth } from '../auth';
import { useRealtime } from '../realtime';
import { Avatar, Banner, ReportDialog, VerifiedBadge } from '../components/ui';
import Menu, { MenuItem } from '../components/Menu';

type Conv = { _id: string; other: any; lastMessage: { text: string; from: string; at: string } | null; unread: number; updatedAt: string };
type Msg = { _id: string; conversation: string; from: string; to: string; text: string; system: boolean; readAt: string | null; createdAt: string };

export default function Chat() {
  const { id } = useParams(); const { user } = useAuth(); const nav = useNavigate(); const { socket, setActiveConv, refresh } = useRealtime();
  const me = user!._id;
  const [convs, setConvs] = useState<Conv[]>([]); const [loadingList, setLoadingList] = useState(true); const [search, setSearch] = useState('');
  const [current, setCurrent] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]); const [hasMore, setHasMore] = useState(false); const [text, setText] = useState('');
  const [sending, setSending] = useState(false); const [note, setNote] = useState<{ t: 'warn' | 'error'; s: string } | null>(null);
  const [typing, setTyping] = useState(false); const [report, setReport] = useState<{ type: 'user' | 'message'; target: string } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null); const stick = useRef(true); const prevHeight = useRef<number | null>(null); const typingTimer = useRef<number>();

  const loadList = useCallback(() => api('/chat/conversations').then((r) => setConvs(r.items)).finally(() => setLoadingList(false)), []);
  useEffect(() => { loadList(); }, [loadList]);

  const markRead = useCallback(() => { if (!id) return; api(`/chat/conversations/${id}/read`, { body: {} }).then(() => { setConvs((c) => c.map((x) => (x._id === id ? { ...x, unread: 0 } : x))); refresh(); }).catch(() => {}); }, [id, refresh]);

  // open a conversation
  useEffect(() => {
    setActiveConv(id || null); setMsgs([]); setCurrent(null); setNote(null); setTyping(false); stick.current = true;
    if (!id) return;
    api(`/chat/conversations/${id}`).then(setCurrent).catch(() => nav('/chat'));
    api(`/chat/conversations/${id}/messages`).then((r) => { setMsgs(r.items); setHasMore(r.hasMore); markRead(); }).catch(() => {});
    return () => setActiveConv(null);
  }, [id]);

  // live events (only this user's private socket room delivers them)
  useEffect(() => {
    if (!socket) return;
    const onMsg = (m: Msg) => {
      setConvs((list) => {
        const i = list.findIndex((c) => c._id === m.conversation);
        if (i < 0) { loadList(); return list; }
        const c = list[i]; const incoming = m.from !== me && m.conversation !== id;
        return [{ ...c, lastMessage: { text: m.text.slice(0, 120), from: m.from, at: m.createdAt }, updatedAt: m.createdAt, unread: incoming ? c.unread + 1 : c.unread }, ...list.filter((_, j) => j !== i)];
      });
      if (m.conversation === id) { setMsgs((x) => (x.some((y) => y._id === m._id) ? x : [...x, m])); if (m.from !== me) { setTyping(false); markRead(); } }
    };
    const onRead = (e: any) => { if (e.conversationId === id && e.by !== me) setMsgs((x) => x.map((m) => (m.from === me && !m.readAt ? { ...m, readAt: e.at } : m))); };
    const onTyping = (e: any) => { if (e.conversationId === id && e.by !== me) { setTyping(true); window.clearTimeout(typingTimer.current); typingTimer.current = window.setTimeout(() => setTyping(false), 3000); } };
    socket.on('message', onMsg); socket.on('read', onRead); socket.on('typing', onTyping);
    return () => { socket.off('message', onMsg); socket.off('read', onRead); socket.off('typing', onTyping); };
  }, [socket, id, me, loadList, markRead]);

  // scrolling: stay at the bottom for new messages, keep position when older ones load
  useLayoutEffect(() => {
    const el = boxRef.current; if (!el) return;
    if (prevHeight.current != null) { el.scrollTop = el.scrollHeight - prevHeight.current; prevHeight.current = null; }
    else if (stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);
  const onScroll = () => { const el = boxRef.current!; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
  const older = async () => {
    if (!msgs.length) return;
    prevHeight.current = boxRef.current!.scrollHeight;
    const r = await api(`/chat/conversations/${id}/messages?before=${encodeURIComponent(msgs[0].createdAt)}`);
    setMsgs((x) => [...r.items, ...x]); setHasMore(r.hasMore);
  };

  const send = async () => {
    const t = text.trim(); if (!t || !id || sending) return;
    setSending(true); setNote(null);
    try {
      const r = await api(`/chat/conversations/${id}/messages`, { body: { text: t } });
      setText(''); stick.current = true; setMsgs((x) => (x.some((y) => y._id === r.message._id) ? x : [...x, r.message]));
      if (r.warning) setNote({ t: 'warn', s: r.warning });
    } catch (e: any) { setNote({ t: 'error', s: e.message }); } finally { setSending(false); }
  };
  const block = async () => {
    if (!current || !confirm(`Block ${current.other.name}? They will not be able to message you.`)) return;
    await api(`/users/me/block/${current.other._id}`, { body: {} }); nav('/chat'); loadList();
  };

  const shown = convs.filter((c) => c.other.name?.toLowerCase().includes(search.toLowerCase()));
  let lastDay = '';
  // My own bubbles are on the right: green for clients, amber for freelancers. The other person's are on the left in white.
  const MINE = user!.role === 'client' ? 'bg-leaf text-white' : 'bg-saffron text-ink';
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid h-[calc(100vh-9rem)] min-h-[480px] overflow-hidden rounded-xl border border-ink/10 bg-white md:grid-cols-[320px_1fr]">
        <aside className={`${id ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r border-ink/10`} aria-label="Conversations">
          <div className="border-b border-ink/10 p-3"><h1 className="mb-2 text-xl font-bold">Messages</h1><input className="input" placeholder="Search people" aria-label="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList && <p className="p-4 text-sm text-ink/60">Loading…</p>}
            {shown.map((c) => (
              <button key={c._id} onClick={() => nav(`/chat/${c._id}`)} className={`flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-leaf-soft ${c._id === id ? 'bg-leaf-soft' : ''}`}>
                <Avatar u={c.other} size={44} />
                <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className={`truncate ${c.unread ? 'font-bold' : 'font-semibold'}`}>{c.other.name || 'User'}</span><span className="shrink-0 text-xs text-ink/50">{timeAgo(c.updatedAt)}</span></span>
                  <span className={`block truncate text-sm ${c.unread ? 'font-semibold text-ink' : 'text-ink/60'}`}>{c.lastMessage ? `${c.lastMessage.from === me ? 'You: ' : ''}${c.lastMessage.text}` : 'No messages yet'}</span></span>
                {c.unread > 0 && <span className="min-w-5 rounded-full bg-leaf px-1.5 text-center text-xs font-bold leading-5 text-white" aria-label={`${c.unread} unread`}>{c.unread}</span>}
              </button>))}
            {!loadingList && !shown.length && <p className="p-4 text-sm text-ink/60">{convs.length ? 'No matches.' : 'No conversations yet. Message a freelancer or client from their profile, gig or hire request.'}</p>}
          </div>
        </aside>
        <section className={`${id ? 'flex' : 'hidden md:flex'} min-h-0 flex-col`} aria-label="Conversation">
          {!id && <p className="m-auto p-6 text-center text-ink/60">Select a conversation to start chatting.<br />Only you and the other person can see your messages.</p>}
          {id && <>
            <header className="flex items-center gap-3 border-b border-ink/10 p-3">
              <button className="md:hidden" onClick={() => nav('/chat')} aria-label="Back to conversations">←</button>
              {current && <><Avatar u={current.other} size={40} /><div className="min-w-0 flex-1"><p className="flex items-center gap-2 font-bold">{current.other.name}{current.other.verified && <VerifiedBadge />}</p><p className="text-xs text-ink/60">{current.other.role === 'freelancer' ? 'Freelancer' : 'Client'}{current.other.city ? `, ${current.other.city}` : ''}{typing && <span className="ml-2 font-semibold text-leaf">typing…</span>}</p></div>
                {current.other.role === 'freelancer' && <Link className="text-sm font-semibold text-leaf underline" to={`/freelancer/${current.other._id}`}>Profile</Link>}
                <Menu label="Conversation options" width="w-44" trigger={<span className="px-2 text-xl leading-none">⋯</span>}>
                  <MenuItem onClick={() => setReport({ type: 'user', target: current.other._id })}>Report user</MenuItem>
                  <MenuItem danger onClick={block}>Block user</MenuItem>
                </Menu></>}
            </header>
            <p className="bg-saffron/20 px-3 py-1.5 text-xs">Stay safe: never pay in advance outside SkillSpot or share OTP and CNIC. Phone numbers and links stay hidden until a hire request is accepted.</p>
            <div ref={boxRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-mist/60 p-4" aria-live="polite">
              {hasMore && <button className="btn-alt mx-auto block !py-1 text-sm" onClick={older}>Load earlier messages</button>}
              {msgs.map((m) => {
                const day = new Date(m.createdAt).toDateString(); const sep = day !== lastDay; lastDay = day;
                const mine = m.from === me;
                return (
                  <div key={m._id}>
                    {sep && <p className="my-2 text-center text-xs text-ink/50">{day === new Date().toDateString() ? 'Today' : day}</p>}
                    {m.system ? <p className="mx-auto max-w-md rounded-lg bg-white px-3 py-1.5 text-center text-xs text-ink/70">{m.text}</p> : mine ? (
                      <div className="flex justify-end" data-side="right">
                        <div className={`max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 ${MINE}`}>
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p className="mt-0.5 text-right text-[11px] opacity-70">{clock(m.createdAt)} · {m.readAt ? 'Seen' : 'Sent'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="group flex items-end justify-start gap-2" data-side="left">
                        <Avatar u={current?.other} size={28} />
                        <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-ink/10 bg-white px-3 py-2">
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p className="mt-0.5 text-[11px] text-ink/50">{clock(m.createdAt)}</p>
                        </div>
                        <button className="self-center text-xs text-ink/40 opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100" onClick={() => setReport({ type: 'message', target: m._id })}>Report</button>
                      </div>)}
                  </div>);
              })}
              {!msgs.length && <p className="py-8 text-center text-sm text-ink/60">No messages yet. Say hello and describe the job.</p>}
            </div>
            <div className="space-y-2 border-t border-ink/10 p-3">
              {note && <Banner tone={note.t}>{note.s}</Banner>}
              <div className="flex gap-2">
                <textarea className="input" rows={2} maxLength={1000} aria-label="Message" placeholder="Write a message…" value={text}
                  onChange={(e) => { setText(e.target.value); if (id) socket?.emit('typing', id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <button className="btn self-end" disabled={sending || !text.trim()} onClick={send}>Send</button>
              </div>
              <p className="text-right text-xs text-ink/50">{text.length}/1000 · Enter to send, Shift+Enter for a new line</p>
            </div>
          </>}
        </section>
      </div>
      {report && <ReportDialog targetType={report.type} target={report.target} onClose={() => setReport(null)} />}
    </main>
  );
}
