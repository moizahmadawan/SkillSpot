import { useNavigate } from 'react-router-dom';

export type Verification = { status: 'none' | 'verified' | 'needs_changes' | 'revoked'; score?: number; summary?: string; notes?: string[]; checkedAt?: string };
export type User = {
  _id: string; name: string; phone?: string; role: 'client' | 'freelancer' | 'admin'; onboarded: boolean; bio?: string; skills: string[];
  experienceYears: number; hourlyRate: number; available: boolean; city?: string; location: { coordinates: [number, number] };
  rating: number; reviewCount: number; verified?: boolean; verification?: Verification; avatarVersion?: number; restrictedUntil?: string; restrictionReason?: string;
  locationSource?: 'default' | 'city' | 'gps'; completedJobs?: number; distanceKm?: number; verificationSummary?: string; createdAt?: string;
};
export type Gig = { _id: string; title: string; description: string; category: string; skills: string[]; budget: number; city: string; status: string; owner: any; createdAt: string; location?: { coordinates: [number, number] }; risk?: { score: number; reasons: string[] } };

export const getToken = () => localStorage.getItem('ss_token');
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = getToken();
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch { throw new Error('Cannot reach the server. Check your internet, and make sure the server is running (npm run dev in the server folder).'); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && t && !path.startsWith('/auth/')) { localStorage.removeItem('ss_token'); window.location.href = '/login'; throw new Error('Session expired, please log in again'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const qs = (o: Record<string, string | number | boolean | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== false).map(([k, v]) => [k, String(v)])).toString();

export function getCoords(): Promise<{ lat: number; lng: number }> {
  return new Promise((ok, no) => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), () => no(new Error('Please allow location access')), { timeout: 8000 }) : no(new Error('Location is not supported in this browser')));
}
export const pkr = (n?: number) => (n ? `Rs ${n.toLocaleString()}` : '—');
export const maskPhone = (p = '') => (p.length > 6 ? `${p.slice(0, 3)} ${'*'.repeat(Math.max(p.length - 7, 3))} ${p.slice(-4)}` : p);
export function timeAgo(iso?: string) {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`; return new Date(iso).toLocaleDateString();
}
export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const isRestricted = (u?: User | null) => !!u?.restrictedUntil && new Date(u.restrictedUntil) > new Date();

// Opens (or creates) the private conversation with another user, then goes to the chat page.
export function useOpenChat() {
  const nav = useNavigate();
  return async (userId: string) => {
    try { const c = await api('/chat/conversations', { body: { userId } }); nav(`/chat/${c._id}`); }
    catch (e: any) { alert(e.message); }
  };
}
