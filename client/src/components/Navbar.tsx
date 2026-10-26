import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useRealtime } from '../realtime';
import { Avatar } from './ui';
import Menu, { MenuItem } from './Menu';

const Icon = ({ d }: { d: string }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const Badge = ({ n }: { n: number }) => n > 0 ? <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-danger px-1 text-center text-xs font-bold leading-5 text-white">{n > 99 ? '99+' : n}</span> : null;

export default function Navbar() {
  const { user, logout } = useAuth(); const { unreadChat, unreadNotes, pending } = useRealtime(); const nav = useNavigate();
  const links: [string, string][] =
    user?.role === 'client' ? [['/skills', 'Find freelancers'], ['/post', 'Post a gig'], ['/bookings', 'My hires'], ['/recommendations', 'Matches']]
    : user?.role === 'freelancer' ? [['/gigs', 'Find jobs'], ['/bookings', 'Job requests'], ['/recommendations', 'Matches']]
    : [['/gigs', 'Browse gigs'], ['/skills', 'Find freelancers']];
  const member = user && user.role !== 'admin' && user.onboarded;
  if (member) links.unshift(['/dashboard', 'Dashboard']);
  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link to={user ? '/dashboard' : '/'} className="font-display text-xl font-extrabold text-leaf">SkillSpot<span className="text-saffron"> AI</span></Link>
        <nav className="flex flex-wrap gap-4 text-[15px] font-medium" aria-label="Main">
          {links.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `relative ${isActive ? 'text-leaf underline underline-offset-8 decoration-saffron decoration-2' : 'hover:text-leaf'}`}>{label}{to === '/bookings' && user?.role === 'freelancer' && <Badge n={pending} />}</NavLink>)}
          {member && <NavLink to="/ai" className="rounded-full bg-saffron px-3 py-0.5 font-semibold text-ink hover:brightness-95">SkillSpot AI</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {member && <>
            <Link to="/notifications" className="relative text-ink/80 hover:text-leaf" aria-label={`Notifications${unreadNotes ? `, ${unreadNotes} unread` : ''}`}><Icon d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /><Badge n={unreadNotes} /></Link>
            <Link to="/chat" className="relative text-ink/80 hover:text-leaf" aria-label={`Chat${unreadChat ? `, ${unreadChat} unread` : ''}`}><Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><Badge n={unreadChat} /></Link>
          </>}
          {user ? (
            <Menu label="Account menu" trigger={<><Avatar u={user} size={32} /><span className="hidden font-medium sm:inline">{user.name || 'Account'}</span></>}>
              <Link to="/dashboard" className="block rounded-lg px-3 py-2 hover:bg-leaf-soft">Dashboard</Link>
              {member && <Link to="/settings" className="block rounded-lg px-3 py-2 hover:bg-leaf-soft">Profile &amp; settings</Link>}
              <MenuItem danger onClick={() => { logout(); nav('/'); }}>Log out</MenuItem>
            </Menu>
          ) : <Link to="/login" className="btn !py-1.5">Log in</Link>}
        </div>
      </div>
    </header>
  );
}
