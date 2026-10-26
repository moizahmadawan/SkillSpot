import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, maskPhone } from '../api';
import { useAuth } from '../auth';
import { Avatar, Banner, Page, VerifiedBadge } from '../components/ui';
import VerificationCard from '../components/VerificationCard';
import MapView from '../components/MapView';

// Crops to a square and shrinks to 320px JPEG in the browser (keeps uploads small and fast)
async function toSquareJpeg(file: File, size = 320) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.85);
}

export default function Settings() {
  const { user, refresh, logout } = useAuth(); const nav = useNavigate(); const fileRef = useRef<HTMLInputElement>(null);
  const f = user!.role === 'freelancer';
  const [form, setForm] = useState({ name: user!.name || '', city: user!.city || '', bio: user!.bio || '', skills: (user!.skills || []).join(', '), experienceYears: user!.experienceYears || 0, hourlyRate: user!.hourlyRate || 0, available: user!.available ?? true });
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null); const [busy, setBusy] = useState(false); const [blocked, setBlocked] = useState<any[]>([]);
  const loadBlocked = () => api('/users/me/blocked').then(setBlocked).catch(() => {});
  useEffect(() => { loadBlocked(); }, []);
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const run = async (fn: () => Promise<void>, ok = 'Saved') => { setBusy(true); setMsg(null); try { await fn(); setMsg({ t: 'ok', s: ok }); } catch (e: any) { setMsg({ t: 'err', s: e.message }); } finally { setBusy(false); } };
  const save = () => run(async () => {
    await api('/users/me', { method: 'PUT', body: { name: form.name, city: form.city, ...(f ? { bio: form.bio, skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean), experienceYears: +form.experienceYears, hourlyRate: +form.hourlyRate, available: form.available } : {}) } });
    await refresh();
  });
  const shareLocation = () => run(async () => {
    const p: GeolocationPosition = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, () => no(new Error('Please allow location access'))));
    await api('/users/me', { method: 'PUT', body: { lat: p.coords.latitude, lng: p.coords.longitude } }); await refresh();
  }, 'Location updated. Others only see an approximate area (about 1 km).');
  const pick = (file?: File) => file && run(async () => {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file');
    await api('/users/me/avatar', { method: 'PUT', body: { dataUrl: await toSquareJpeg(file) } }); await refresh();
  }, 'Photo updated');
  const removePhoto = () => run(async () => { await api('/users/me/avatar', { method: 'DELETE' }); await refresh(); }, 'Photo removed');
  const logoutAll = () => run(async () => { const r = await api('/auth/logout-all', { body: {} }); localStorage.setItem('ss_token', r.token); await refresh(); }, 'Signed out of all other devices.');
  const deactivate = async () => {
    const t = prompt('This hides your account and signs you out everywhere. Type DEACTIVATE to confirm.');
    if (t !== 'DEACTIVATE') return;
    run(async () => { await api('/users/me/deactivate', { body: { confirm: t } }); logout(); nav('/'); });
  };
  const unblock = (id: string) => run(async () => { await api(`/users/me/block/${id}`, { method: 'DELETE' }); await loadBlocked(); }, 'User unblocked');
  return (
    <Page title="Profile & settings" sub={f ? 'A complete profile with a photo helps you get verified and hired.' : 'Manage your account details and privacy.'}>
      {msg && <div className="mb-4"><Banner tone={msg.t === 'err' ? 'error' : 'warn'}>{msg.s}</Banner></div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="panel flex flex-wrap items-center gap-4" aria-label="Profile photo">
            <Avatar u={user} size={88} />
            <div className="space-y-2"><p className="flex items-center gap-2 font-bold">{user!.name} {user!.verified && <VerifiedBadge />}</p>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
              <div className="flex gap-2"><button className="btn !py-1.5" disabled={busy} onClick={() => fileRef.current?.click()}>{user!.avatarVersion ? 'Change photo' : 'Add photo'}</button>{!!user!.avatarVersion && <button className="btn-alt !py-1.5" disabled={busy} onClick={removePhoto}>Remove</button>}</div>
              <p className="text-xs text-ink/60">JPG, PNG or WEBP. It is cropped to a square automatically.</p></div>
          </section>
          <section className="panel space-y-3" aria-label="Profile details">
            <h2 className="text-xl font-bold">Details</h2>
            <label className="block font-medium" htmlFor="n">Full name</label><input id="n" className="input" value={form.name} onChange={set('name')} maxLength={60} />
            <label className="block font-medium" htmlFor="c">City</label><input id="c" className="input" value={form.city} onChange={set('city')} maxLength={60} />
            {f && <>
              <label className="block font-medium" htmlFor="b">Bio</label><textarea id="b" className="input" rows={4} maxLength={600} value={form.bio} onChange={set('bio')} placeholder="What you do, how you work, how fast you deliver (at least 60 characters)" />
              <label className="block font-medium" htmlFor="s">Skills (comma separated)</label><input id="s" className="input" value={form.skills} onChange={set('skills')} placeholder="logo design, branding, illustrator" />
              <div className="grid grid-cols-2 gap-3"><div><label className="block font-medium" htmlFor="e">Years of experience</label><input id="e" className="input" type="number" min={0} max={60} value={form.experienceYears} onChange={set('experienceYears')} /></div>
                <div><label className="block font-medium" htmlFor="r">Rate per hour (Rs)</label><input id="r" className="input" type="number" min={0} value={form.hourlyRate} onChange={set('hourlyRate')} /></div></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.available} onChange={set('available')} /> I am available for new work</label>
            </>}
            <div className="flex flex-wrap gap-2"><button className="btn" disabled={busy} onClick={save}>Save changes</button><button className="btn-alt" disabled={busy} onClick={shareLocation}>Use my current location</button></div>
          </section>
          <section className="panel space-y-3" aria-label="Location">
            <h2 className="text-xl font-bold">Your location</h2>
            <p className="text-sm text-ink/70">{user!.locationSource === 'gps' ? 'Using your shared GPS location.' : user!.locationSource === 'city' ? `Using the centre of ${user!.city}. Press "Use my current location" for better matches.` : 'Not set yet. Enter your city and save, or press "Use my current location".'} Other people only see an approximate area (about 1 km), never your exact position.</p>
            <MapView height={220} points={[{ lat: user!.location.coordinates[1], lng: user!.location.coordinates[0], label: 'You (approximate)' }]} />
          </section>
        </div>
        <div className="space-y-6">
          {f && <VerificationCard />}
          <section className="panel space-y-3" aria-label="Account and security">
            <h2 className="text-xl font-bold">Account &amp; security</h2>
            <p className="text-sm">Phone: <b>{maskPhone(user!.phone)}</b> (never shown to other users)</p>
            <p className="text-sm">Account type: <b>{f ? 'Freelancer' : 'Client'}</b> <span className="text-ink/60">(locked to this phone number)</span></p>
            <div className="flex flex-wrap gap-2"><button className="btn-alt" disabled={busy} onClick={logoutAll}>Log out of all other devices</button><button className="btn-alt text-danger" disabled={busy} onClick={deactivate}>Deactivate account</button></div>
            <p className="text-xs text-ink/60">Your exact location and phone number are never shown. Chats are visible only to you and the other person.</p>
          </section>
          <section className="panel space-y-2" aria-label="Blocked users"><h2 className="text-xl font-bold">Blocked users</h2>
            {blocked.map((b) => <div key={b._id} className="flex items-center gap-3"><Avatar u={b} size={32} /><span className="flex-1">{b.name || 'User'}</span><button className="btn-alt !py-1" onClick={() => unblock(b._id)}>Unblock</button></div>)}
            {!blocked.length && <p className="text-sm text-ink/60">You have not blocked anyone.</p>}
          </section>
        </div>
      </div>
    </Page>
  );
}
