import { useState } from 'react';
import { api, getCoords } from '../api';
import { useAuth } from '../auth';
import { Banner } from './ui';

// Shown until the user shares GPS once. Without it, the centre of their city is used.
export default function LocationPrompt() {
  const { user, refresh } = useAuth(); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  if (!user || user.locationSource === 'gps') return null;
  const share = async () => {
    setBusy(true); setErr('');
    try { const p = await getCoords(); await api('/users/me', { method: 'PUT', body: { lat: p.lat, lng: p.lng } }); await refresh(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-leaf-soft p-3 text-sm" role="region" aria-label="Location">
      <span className="flex-1">Get better matches nearby: share your location. Other people only ever see an approximate area.</span>
      <button className="btn !py-1.5" disabled={busy} onClick={share}>{busy ? 'Locating…' : 'Share my location'}</button>
      {err && <Banner tone="error">{err}</Banner>}
    </div>
  );
}
