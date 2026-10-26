import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, User } from './api';
type Ctx = { user: User | null; loading: boolean; login: (token: string, u: User) => void; logout: () => void; refresh: () => Promise<void>; update: (u: User) => void };
const C = createContext<Ctx>(null!);
export const useAuth = () => useContext(C);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => { if (!getToken()) return setLoading(false); try { setUser(await api('/auth/me')); } catch { localStorage.removeItem('ss_token'); setUser(null); } setLoading(false); };
  useEffect(() => { refresh(); }, []);
  // Hiring mode and Freelancer mode use different colour themes
  useEffect(() => { document.documentElement.dataset.mode = user?.role === 'freelancer' ? 'freelancer' : 'client'; }, [user?.role]);
  const login = (t: string, u: User) => { localStorage.setItem('ss_token', t); setUser(u); };
  const logout = () => { localStorage.removeItem('ss_token'); setUser(null); };
  return <C.Provider value={{ user, loading, login, logout, refresh, update: setUser }}>{children}</C.Provider>;
}
