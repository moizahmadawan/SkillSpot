// Uses the existing server endpoint POST /api/auth/admin-login (email + password).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Banner, Page } from '../components/ui';

export default function AdminLogin() {
  const { login, user } = useAuth(); const nav = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (user?.role === 'admin') nav('/'); }, [user, nav]);
  const submit = async () => {
    setErr(''); setBusy(true);
    try { const r = await api('/auth/admin-login', { body: { email, password } }); login(r.token, r.user); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Page title="Admin login" sub="Email and password.">
      <div className="panel max-w-md space-y-3">
        <label className="block font-medium" htmlFor="em">Email</label>
        <input id="em" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <label className="block font-medium" htmlFor="pw">Password</label>
        <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === 'Enter' && email && password && submit()} />
        {err && <Banner tone="error">{err}</Banner>}
        <button className="btn w-full" disabled={busy || !email || !password} onClick={submit}>Log in</button>
      </div>
    </Page>
  );
}
