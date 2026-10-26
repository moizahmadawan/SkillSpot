import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { confirmOtp, firebaseEnabled, sendOtp } from '../firebase';
import { Banner, Page } from '../components/ui';

const TEST_OTP = '123456';

export default function Login() {
  const { login, user } = useAuth(); const nav = useNavigate();
  const [phone, setPhone] = useState(''); const [code, setCode] = useState(firebaseEnabled ? '' : TEST_OTP); const [sent, setSent] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) nav(user.onboarded ? '/dashboard' : '/onboarding'); }, [user, nav]);
  const run = async (fn: () => Promise<void>) => { setErr(''); setBusy(true); try { await fn(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const finish = (r: any) => login(r.token, r.user);
  const send = () => run(async () => { await sendOtp(phone, 'recaptcha'); setSent(true); });
  const verify = () => run(async () => finish(firebaseEnabled
    ? await api('/auth/firebase', { body: { idToken: await confirmOtp(code) } })
    : await api('/auth/dev-login', { body: { phone, otp: code } })));
  const test = !firebaseEnabled;
  return (
    <Page title="Log in or sign up" sub="Your phone number is your account. One number can have only one account, either a client or a freelancer.">
      <div className="panel max-w-md space-y-3">
        {test && <p className="rounded-lg bg-saffron/30 p-3 text-sm"><b>Test mode:</b> enter any phone number and use the OTP <b>{TEST_OTP}</b>.</p>}
        <label className="block font-medium" htmlFor="ph">Phone number</label>
        <input id="ph" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567 or +923001234567" inputMode="tel" disabled={sent} autoComplete="tel" />
        {(test || sent) && <><label className="block font-medium" htmlFor="otp">OTP code</label><input id="otp" className="input" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" /></>}
        {err && <Banner tone="error">{err}</Banner>}
        <button className="btn w-full" disabled={busy || !phone.trim()} onClick={test || sent ? verify : send}>{test ? 'Log in' : sent ? 'Verify and log in' : 'Send OTP'}</button>
        <div id="recaptcha" />
      </div>
    </Page>
  );
}
