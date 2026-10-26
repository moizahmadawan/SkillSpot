import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Protected } from './components/ui';
import { useAuth } from './auth';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';

export default function App() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  return (<>
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3">
        <span className="font-display text-xl font-extrabold text-leaf">SkillSpot<span className="text-saffron"> AI</span> <span className="text-base font-semibold text-ink/60">Admin</span></span>
        {user && <button className="btn-alt ml-auto !py-1.5" onClick={() => { logout(); nav('/login'); }}>Log out</button>}
      </div>
    </header>
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route path="/" element={<Protected roles={['admin']}><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </>);
}
